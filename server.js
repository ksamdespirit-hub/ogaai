/* ============================================================
   OgaAI backend
   - Real AI model (key stays on server)
   - User login (email + password, hashed)
   - Automatic payment verification via Monnify (Moniepoint)
   Run:  npm install && npm start
   ============================================================ */
"use strict";
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit:"64kb", verify:(req,_res,buf)=>{ req.rawBody = buf; } }));

/* ---------------- config ---------------- */
const PORT     = process.env.PORT || 3000;
const SECRET   = process.env.SESSION_SECRET || "change-this-secret";
// AI
const API_KEY  = process.env.OPENAI_API_KEY || "";
const BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const MODEL    = process.env.OPENAI_MODEL || "gpt-4o-mini";
// Monnify (Moniepoint merchant API)
const MON_KEY      = process.env.MONNIFY_API_KEY || "";
const MON_SECRET   = process.env.MONNIFY_SECRET_KEY || "";
const MON_CONTRACT = process.env.MONNIFY_CONTRACT_CODE || "";
const MON_BASE     = process.env.MONNIFY_BASE_URL || "https://sandbox.monnify.com";
const APP_URL      = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const PRICE        = 1000; // NGN / month
const FREE_LIMIT   = 3;
const monnifyOn = !!(MON_KEY && MON_SECRET && MON_CONTRACT);

/* ---------------- tiny JSON user store ---------------- */
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
function loadUsers(){ try{ return JSON.parse(fs.readFileSync(USERS_FILE,"utf8")); }catch{ return {}; } }
function saveUsers(u){ fs.writeFileSync(USERS_FILE, JSON.stringify(u,null,2)); }

/* ---------------- auth helpers (built-in crypto) ---------------- */
function hashPw(pw){ const s=crypto.randomBytes(16).toString("hex"); const h=crypto.scryptSync(pw,s,64).toString("hex"); return s+":"+h; }
function checkPw(pw,stored){ try{ const [s,h]=stored.split(":"); const hh=crypto.scryptSync(pw,s,64).toString("hex"); return crypto.timingSafeEqual(Buffer.from(h,"hex"),Buffer.from(hh,"hex")); }catch{ return false; } }
function b64u(x){ return Buffer.from(x).toString("base64url"); }
function signToken(p){ const h=b64u(JSON.stringify({alg:"HS256",typ:"JWT"})); const b=b64u(JSON.stringify(p)); const d=h+"."+b; const sig=crypto.createHmac("sha256",SECRET).update(d).digest("base64url"); return d+"."+sig; }
function verifyToken(tok){ try{ const [h,b,s]=String(tok).split("."); if(!h||!b||!s) return null; const sig=crypto.createHmac("sha256",SECRET).update(h+"."+b).digest("base64url"); if(sig!==s) return null; const p=JSON.parse(Buffer.from(b,"base64url").toString()); if(p.exp&&Date.now()>p.exp) return null; return p; }catch{ return null; } }
function auth(req,res,next){ const tok=(req.headers.authorization||"").replace(/^Bearer\s+/i,""); const p=verifyToken(tok); if(!p) return res.status(401).json({error:"Please log in."}); const users=loadUsers(); const u=users[p.email]; if(!u) return res.status(401).json({error:"Account not found."}); req.user=u; req.users=users; next(); }
function publicUser(u){ return { email:u.email, premium:!!u.premium, premiumSince:u.premiumSince||null }; }
function today(){ return new Date().toISOString().slice(0,10); }

/* ---------------- CORS ---------------- */
app.use((req,res,next)=>{ res.header("Access-Control-Allow-Origin","*"); res.header("Access-Control-Allow-Headers","Content-Type, Authorization"); res.header("Access-Control-Allow-Methods","GET, POST, OPTIONS"); if(req.method==="OPTIONS") return res.sendStatus(204); next(); });

/* ---------------- rate limit ---------------- */
const hits=new Map();
function rateLimited(ip){ const now=Date.now(),win=60000,max=40; const r=hits.get(ip)||{n:0,t:now}; if(now-r.t>win){r.n=0;r.t=now;} r.n++; hits.set(ip,r); return r.n>max; }
/* ---------------- AUTH ROUTES ---------------- */
const TOKEN_TTL = 1000*60*60*24*30; // 30 days
function issue(u){ return signToken({ email:u.email, exp:Date.now()+TOKEN_TTL }); }
function validEmail(e){ return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e||"")); }

app.post("/api/auth/signup",(req,res)=>{
  const email=String(req.body?.email||"").trim().toLowerCase();
  const pw=String(req.body?.password||"");
  if(!validEmail(email)) return res.status(400).json({error:"Enter a valid email."});
  if(pw.length<6) return res.status(400).json({error:"Password must be at least 6 characters."});
  const users=loadUsers();
  if(users[email]) return res.status(409).json({error:"Account already exists. Please log in."});
  users[email]={ email, pass:hashPw(pw), premium:false, freeDay:today(), freeUses:0, created:Date.now() };
  saveUsers(users);
  res.json({ token:issue(users[email]), user:publicUser(users[email]) });
});

app.post("/api/auth/login",(req,res)=>{
  const email=String(req.body?.email||"").trim().toLowerCase();
  const pw=String(req.body?.password||"");
  const users=loadUsers(); const u=users[email];
  if(!u || !checkPw(pw,u.pass)) return res.status(401).json({error:"Wrong email or password."});
  res.json({ token:issue(u), user:publicUser(u) });
});

app.get("/api/auth/me", auth, (req,res)=>{
  const left = req.user.premium ? null : Math.max(0, FREE_LIMIT - (req.user.freeDay===today()?req.user.freeUses:0));
  res.json({ user:publicUser(req.user), freeLeft:left, freeLimit:FREE_LIMIT });
});
/* ---------------- AI ROUTES ---------------- */
function buildMessages(tool, fields, lang){
  const pidgin = lang==="pcm";
  const langRule = pidgin
    ? "Reply ONLY in natural Nigerian Pidgin English \u2014 the way real Nigerians chat. Warm, street-smart but respectful."
    : "Reply in clear, simple English suited to everyday Nigerians. Warm and confident.";
  const system = [
    "You are OgaAI, an AI assistant for Nigerian small traders, students and everyday hustlers.",
    "You help them sell more, reply customers, write things, plan their day and understand topics.",
    langRule,
    "Use Naira (\u20a6) for money. Be practical and concise. Do NOT add disclaimers or mention that you are an AI.",
    "Return only the finished result the user can copy and use \u2014 no preamble like 'Sure, here is'."
  ].join(" ");
  const f=fields||{};
  const T={
    pitch:`Write a short, punchy sales pitch for WhatsApp/social media.\nProduct: ${f.product||""}\nPrice: \u20a6${f.price||""}\nTarget buyers: ${f.audience||"general public"}`,
    reply:`Write a smart, ${f.tone||"friendly"} reply to this customer message. Keep it short.\nCustomer said: "${f.message||""}"`,
    caption:`Write an engaging social caption with a few relevant hashtags about:\n${f.topic||""}`,
    invoice:`Create a clean plain-text invoice.\nBusiness: ${f.biz||"My Business"}\nCustomer: ${f.customer||"Customer"}\nItems and prices (one per line):\n${f.items||""}\nCalculate and show the TOTAL in Naira.`,
    negotiate:`A customer wants a price cut. Reply politely but firmly: hold value, offer a small genuine discount, state a final price.\nProduct: ${f.product||""}\nMy price: \u20a6${f.price||""}\nLowest I accept: \u20a6${f.lowest||""}`,
    plan:`Turn this to-do list into a simple time-blocked hustle plan for today, money tasks first. Add one motivating tip.\nTasks:\n${f.tasks||""}`,
    study:`Explain this topic simply with an everyday Nigerian example. End by offering practice questions.\nTopic: ${f.topic||""}`,
    message:`Write a ${f.kind||"message"} for me, well-worded and appropriate.\nWhat I want to say: ${f.about||""}`
  };
  const user=T[tool]||(f.topic||f.about||"Help me.");
  return [{role:"system",content:system},{role:"user",content:user}];
}

app.post("/api/generate", auth, async (req,res)=>{
  try{
    const ip=req.headers["x-forwarded-for"]||req.socket.remoteAddress||"ip";
    if(rateLimited(String(ip))) return res.status(429).json({error:"Too many requests, slow down small."});
    // free-trial gate (server-side, per user)
    const u=req.user;
    if(!u.premium){
      if(u.freeDay!==today()){ u.freeDay=today(); u.freeUses=0; }
      if(u.freeUses>=FREE_LIMIT){ saveUsers(req.users); return res.status(402).json({error:"Free trial done for today. Subscribe \u20a61,000 for unlimited use.", needSubscribe:true}); }
    }
    if(!API_KEY) return res.status(503).json({error:"AI not configured: set OPENAI_API_KEY."});
    const { tool, fields, lang } = req.body||{};
    const messages=buildMessages(tool,fields,lang);
    const r=await fetch(`${BASE_URL}/chat/completions`,{ method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${API_KEY}`},
      body:JSON.stringify({ model:MODEL, messages, temperature:0.8, max_tokens:600 }) });
    if(!r.ok){ const d=await r.text(); return res.status(502).json({error:"AI upstream error", detail:d.slice(0,300)}); }
    const data=await r.json();
    const text=data?.choices?.[0]?.message?.content?.trim()||"";
    if(!text) return res.status(502).json({error:"Empty AI response"});
    if(!u.premium){ u.freeUses++; saveUsers(req.users); }
    res.json({ text });
  }catch(err){ res.status(500).json({error:"Server error", detail:String(err).slice(0,300)}); }
});
/* ---------------- PAYMENT ROUTES (Monnify / Moniepoint) ---------------- */
async function monnifyToken(){
  const basic=Buffer.from(`${MON_KEY}:${MON_SECRET}`).toString("base64");
  const r=await fetch(`${MON_BASE}/api/v1/auth/login`,{ method:"POST", headers:{ Authorization:`Basic ${basic}` } });
  const j=await r.json();
  const tok=j?.responseBody?.accessToken;
  if(!tok) throw new Error("Monnify auth failed");
  return tok;
}

// 1) start a subscription payment -> returns a checkout link
app.post("/api/pay/init", auth, async (req,res)=>{
  try{
    const u=req.user;
    if(u.premium) return res.json({ alreadyPremium:true });
    if(!monnifyOn){
      // DEMO mode: no gateway configured -> caller shows manual bank transfer
      return res.json({ demo:true, bank:{ name:"Moniepoint MFB", account:"5222649250" }, amount:PRICE });
    }
    const token=await monnifyToken();
    const paymentReference="OGA-"+Date.now()+"-"+crypto.randomBytes(3).toString("hex");
    const r=await fetch(`${MON_BASE}/api/v1/merchant/transactions/init-transaction`,{
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body:JSON.stringify({
        amount:PRICE, customerName:u.email.split("@")[0], customerEmail:u.email,
        paymentReference, paymentDescription:"OgaAI Premium (monthly)",
        currencyCode:"NGN", contractCode:MON_CONTRACT,
        redirectUrl:`${APP_URL}/?paid=1`,
        paymentMethods:["ACCOUNT_TRANSFER","CARD"]
      })
    });
    const j=await r.json();
    const body=j?.responseBody;
    if(!body?.checkoutUrl) return res.status(502).json({ error:"Could not start payment", detail:JSON.stringify(j).slice(0,300) });
    u.pendingRef=body.transactionReference; u.pendingPayRef=paymentReference; saveUsers(req.users);
    res.json({ checkoutUrl:body.checkoutUrl, transactionReference:body.transactionReference });
  }catch(err){ res.status(500).json({ error:"Payment init failed", detail:String(err).slice(0,300) }); }
});

// 2) verify (called after redirect / polling) -> unlocks premium if PAID
app.get("/api/pay/verify", auth, async (req,res)=>{
  try{
    const u=req.user;
    if(u.premium) return res.json({ status:"PAID", premium:true });
    if(!monnifyOn) return res.json({ status:"PENDING", premium:false, demo:true });
    const ref=u.pendingRef; if(!ref) return res.json({ status:"NONE", premium:false });
    const token=await monnifyToken();
    const r=await fetch(`${MON_BASE}/api/v2/transactions/${encodeURIComponent(ref)}`,{ headers:{ Authorization:`Bearer ${token}` } });
    const j=await r.json();
    const status=j?.responseBody?.paymentStatus||"PENDING";
    if(status==="PAID"){ u.premium=true; u.premiumSince=Date.now(); delete u.pendingRef; saveUsers(req.users); }
    res.json({ status, premium:!!u.premium });
  }catch(err){ res.status(500).json({ error:"Verify failed", detail:String(err).slice(0,300) }); }
});

// 3) webhook -> Monnify calls this automatically when money lands
app.post("/api/pay/webhook", (req,res)=>{
  try{
    if(!monnifyOn) return res.sendStatus(200);
    const sig=req.headers["monnify-signature"]||"";
    const computed=crypto.createHmac("sha512",MON_SECRET).update(req.rawBody||Buffer.from("")).digest("hex");
    if(sig!==computed) return res.status(401).json({ error:"bad signature" });
    const ev=req.body||{};
    const paid = ev?.eventType==="SUCCESSFUL_TRANSACTION" || ev?.eventData?.paymentStatus==="PAID";
    const email=(ev?.eventData?.customer?.email||ev?.eventData?.customerEmail||"").toLowerCase();
    if(paid && email){
      const users=loadUsers(); const u=users[email];
      if(u && !u.premium){ u.premium=true; u.premiumSince=Date.now(); delete u.pendingRef; saveUsers(users); }
    }
    res.sendStatus(200);
  }catch{ res.sendStatus(200); }
});

// DEMO-only manual confirm (used when Monnify not configured)
app.post("/api/pay/demo-confirm", auth, (req,res)=>{
  if(monnifyOn) return res.status(400).json({ error:"Live payments active; use gateway verification." });
  const u=req.user; u.premium=true; u.premiumSince=Date.now(); saveUsers(req.users);
  res.json({ premium:true, demo:true });
});

/* ---------------- static front-end ---------------- */
app.get("/api/config", (_req,res)=> res.json({ monnify:monnifyOn, price:PRICE, aiConfigured:!!API_KEY }));
app.get("/api/health", (_req,res)=> res.json({ ok:true, model:MODEL, aiConfigured:!!API_KEY, monnify:monnifyOn }));
app.use(express.static(path.join(__dirname)));
app.get("*", (_req,res)=> res.sendFile(path.join(__dirname,"index.html")));
if(process.env.NO_LISTEN!=="1"){
  app.listen(PORT,"0.0.0.0",()=> console.log(`OgaAI on http://localhost:${PORT}  AI:${API_KEY?"on":"OFF"}  Monnify:${monnifyOn?"on":"OFF(demo)"}`));
}
module.exports = app;
