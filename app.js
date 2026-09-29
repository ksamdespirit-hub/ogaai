/* ================= OgaAI — Your Hustle Assistant ================= */
"use strict";

const LS = { lang:"ogaai_lang", uses:"ogaai_uses", day:"ogaai_day", premium:"ogaai_premium", tasks:"ogaai_tasks" };
const FREE_LIMIT = 3;

/* ===== CONFIG (edit these) ===== */
// Backend that safely holds your AI key. "" = same origin (/api/generate).
// e.g. "https://ogaai-server.onrender.com"
const API_BASE = "";
// Bank account subscribers pay into
const BANK = { name:"Moniepoint MFB", account:"5222649250", accountName:"OgaAI" };

let lang = localStorage.getItem(LS.lang) || "en"; // 'en' | 'pcm'
let currentTool = null;

/* ---------- auth + server state ---------- */
const AUTH = { token: localStorage.getItem("ogaai_token")||"", user:null, freeLeft:FREE_LIMIT };
let CFG = { monnify:false, price:1000, aiConfigured:false };
let authMode = "login"; // 'login' | 'signup'

/* ---------- helpers ---------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
function esc(t){ const d=document.createElement("div"); d.textContent=t==null?"":String(t); return d.innerHTML; }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function naira(n){ return "\u20a6"+Number(n||0).toLocaleString("en-NG"); }
function todayKey(){ return new Date().toISOString().slice(0,10); }

/* authed fetch helper */
async function api(path, opts={}){
  const headers = Object.assign({"Content-Type":"application/json"}, opts.headers||{});
  if(AUTH.token) headers["Authorization"] = "Bearer "+AUTH.token;
  let res;
  try{
    res = await fetch((API_BASE||"")+path, Object.assign({}, opts, { headers }));
  }catch(e){
    // network error: server not running / not reachable
    return { ok:false, status:0, network:true, data:{} };
  }
  let data={}; try{ data = await res.json(); }catch{}
  return { ok:res.ok, status:res.status, data };
}

function isPremium(){ return !!(AUTH.user && AUTH.user.premium); }
function usesLeft(){ return isPremium() ? 999 : (AUTH.freeLeft==null ? FREE_LIMIT : AUTH.freeLeft); }

/* ---------- i18n UI strings ---------- */
const UI = {
  en:{ tagline:"Your hustle assistant", greet:"Good day, Oga \ud83d\udc4b", greetSub:"What are we handling today?",
    dailyPill:"Money move of the day", newTip:"Another tip \u21bb", qaTitle:"Quick actions",
    back:"Back", toolsTitle:"All tools", toolsSub:"Everything for your daily hustle",
    generate:"Generate \u2728", regen:"Regenerate \u21bb", copy:"Copy", copied:"Copied!", result:"Result",
    navHome:"Home", navTools:"Tools", navAcct:"Account", accTitle:"My account",
    planName:"OgaAI Premium", perMonth:"/month", subscribe:"Subscribe for \u20a61,000/month",
    secure:"\ud83d\udd12 Secure payment \u00b7 Cancel anytime", statUses:"Tasks done", statSaved:"Est. value saved",
    trial:(n)=>`Free trial \u2014 ${n} use${n===1?"":"s"} left today`, goPrem:"Go Premium \u20a61,000",
    premiumOn:"Premium active \u2705", unlimited:"Unlimited daily use unlocked",
    renewNow:"Renew now (\u20a61,000)", cancelSub:"Cancel subscription", resumeSub:"Keep my subscription",
    activeUntil:(d)=>`Active until ${d}`, daysLeftTxt:(n)=>`${n} day${n===1?"":"s"} left`,
    willRemind:"Pay again before then to keep Premium going.",
    wontRenew:"Won't renew \u2014 Premium stops on this date.",
    cancelConfirm:"Turn off renewal? You keep Premium until it expires, then it stops.",
    cancelDone:"Renewal turned off. You keep Premium until it expires.", resumeDone:"Good \u2014 your subscription stays on.",
    payTitle:"Subscribe to OgaAI Premium", paySub:"\u20a61,000 / month \u00b7 unlimited daily use",
    payNow:"Pay \u20a61,000 now", cancel:"Cancel", paying:"Processing payment\u2026", paid:"Payment successful! Premium unlocked \ud83c\udf89",
    limitHit:"Free trial done for today. Subscribe \u20a61,000 for unlimited use.",
    needInput:"Please fill the fields first.",
    thinking:"OgaAI is thinking\u2026", offline:"(offline mode)",
    payTransfer:"Transfer \u20a61,000 to the account below, then tap the button to activate Premium.",
    iPaid:"I have sent \u20a61,000", checking:"Confirming your transfer\u2026",
    bankLbl:"Bank", acctLbl:"Account Number", nameLbl:"Account Name", amtLbl:"Amount", acctCopied:"Account number copied!",
    welcome:"Welcome to OgaAI", subLogin:"Your AI hustle assistant \u2014 log in to start.", subSignup:"Create your account \u2014 it takes 10 seconds.",
    login:"Log in", signup:"Sign up", emailLbl:"Email", pwLbl:"Password", logout:"Log out",
    opening:"Opening secure checkout\u2026", waitPay:"Waiting for your payment\u2026 tap below once you've paid.", checkNow:"I've paid \u2014 check now",
    payFail:"Could not start payment. Try again.", notPaidYet:"Payment not confirmed yet. If you've paid, wait a moment and try again.",
    authFail:"Login failed. Check your email and password.", netErr:"Can't reach the server. Make sure the app's server is running, then try again.",
    aiDown:"AI is not available right now. Please try again in a moment.",
    hello:"Hello",
    benefits:["Unlimited AI tasks every day","Replies in English & Pidgin","Sales pitches, captions, invoices & more","Daily money move + hustle tips","New tools added every week"] },
  pcm:{ tagline:"Your hustle assistant", greet:"How far, Oga \ud83d\udc4b", greetSub:"Wetin we go handle today?",
    dailyPill:"Money move for today", newTip:"Another one \u21bb", qaTitle:"Quick moves",
    back:"Go back", toolsTitle:"All di tools", toolsSub:"Everything for your daily hustle",
    generate:"Do am \u2728", regen:"Do am again \u21bb", copy:"Copy", copied:"I don copy am!", result:"See am",
    navHome:"Home", navTools:"Tools", navAcct:"Account", accTitle:"My account",
    planName:"OgaAI Premium", perMonth:"/month", subscribe:"Subscribe \u20a61,000 every month",
    secure:"\ud83d\udd12 Your money dey safe \u00b7 You fit cancel anytime", statUses:"Work wey I don do", statSaved:"Value wey you save",
    trial:(n)=>`Free trial \u2014 ${n} use${n===1?"":"s"} remain today`, goPrem:"Buy Premium \u20a61,000",
    premiumOn:"Premium dey active \u2705", unlimited:"You fit use am anyhow now",
    renewNow:"Renew now (\u20a61,000)", cancelSub:"Cancel subscription", resumeSub:"Keep my subscription",
    activeUntil:(d)=>`E dey active till ${d}`, daysLeftTxt:(n)=>`${n} day${n===1?"":"s"} remain`,
    willRemind:"Pay again before e reach make Premium continue.",
    wontRenew:"E no go renew \u2014 Premium go stop for this date.",
    cancelConfirm:"You wan off renewal? You go still get Premium till e expire, then e go stop.",
    cancelDone:"Renewal don off. You go still get Premium till e expire.", resumeDone:"Correct \u2014 your subscription still dey on.",
    payTitle:"Subscribe to OgaAI Premium", paySub:"\u20a61,000 / month \u00b7 use am anyhow",
    payNow:"Pay \u20a61,000 now", cancel:"Leave am", paying:"We dey process your money\u2026", paid:"Money enter! Premium don open \ud83c\udf89",
    limitHit:"Free trial don finish for today. Pay \u20a61,000 make you use am anyhow.",
    needInput:"Abeg fill di boxes first.",
    thinking:"OgaAI dey think\u2026", offline:"(offline mode)",
    payTransfer:"Send \u20a61,000 go di account wey dey below, then tap di button make Premium open.",
    iPaid:"I don send \u20a61,000", checking:"We dey confirm your transfer\u2026",
    bankLbl:"Bank", acctLbl:"Account Number", nameLbl:"Account Name", amtLbl:"Amount", acctCopied:"I don copy di account number!",
    welcome:"Welcome to OgaAI", subLogin:"Your AI hustle assistant \u2014 login make you start.", subSignup:"Open your account \u2014 na 10 seconds.",
    login:"Log in", signup:"Sign up", emailLbl:"Email", pwLbl:"Password", logout:"Comot (Log out)",
    opening:"We dey open secure checkout\u2026", waitPay:"We dey wait your payment\u2026 tap below when you don pay.", checkNow:"I don pay \u2014 check am now",
    payFail:"We no fit start payment. Try again.", notPaidYet:"We never see your payment. If you don pay, wait small then try again.",
    authFail:"Login no work. Check your email and password.", netErr:"We no fit reach di server. Make sure di app server dey run, then try again.",
    aiDown:"AI no dey available now. Abeg try again small time.",
    hello:"How far",
    benefits:["Use AI anyhow every day","E dey reply for English & Pidgin","Sales talk, captions, invoice & more","Money move + hustle tips every day","New tools dey enter every week"] }
};
/* ---------- TOOL DEFINITIONS ---------- */
const TOOLS = [
  { id:"pitch", icon:"\ud83d\udce2", quick:true,
    t:{en:"Sales pitch", pcm:"Sales talk"},
    d:{en:"Sell any product fast", pcm:"Sell your product sharp sharp"},
    fields:[
      {k:"product", label:{en:"What are you selling?", pcm:"Wetin you dey sell?"}, ph:{en:"e.g. fresh tomatoes, phone accessories", pcm:"e.g. fresh tomato, phone charger"}},
      {k:"price", label:{en:"Price (\u20a6)", pcm:"Price (\u20a6)"}, ph:{en:"e.g. 2500", pcm:"e.g. 2500"}, type:"number"},
      {k:"audience", label:{en:"Who are your buyers? (optional)", pcm:"Who dey buy? (optional)"}, ph:{en:"e.g. students, market women", pcm:"e.g. students, market women"}, opt:true}
    ] },
  { id:"reply", icon:"\ud83d\udcac", quick:true,
    t:{en:"Reply a customer", pcm:"Answer customer"},
    d:{en:"Smart, polite replies", pcm:"Sharp, polite reply"},
    fields:[
      {k:"message", label:{en:"Customer's message", pcm:"Wetin customer talk"}, ph:{en:"e.g. Is this still available? Last price?", pcm:"e.g. E still dey? Last price?"}, type:"area"},
      {k:"tone", label:{en:"Tone", pcm:"How you wan sound"}, type:"select",
        options:{en:["Friendly","Professional","Firm but polite"], pcm:["Friendly","Professional","Firm but polite"]}}
    ] },
  { id:"caption", icon:"\ud83d\udcf8", quick:true,
    t:{en:"Social caption", pcm:"Post caption"},
    d:{en:"WhatsApp, IG & TikTok", pcm:"For WhatsApp, IG & TikTok"},
    fields:[
      {k:"topic", label:{en:"What is the post about?", pcm:"Wetin di post be about?"}, ph:{en:"e.g. weekend promo on ankara bags", pcm:"e.g. weekend promo for ankara bag"}, type:"area"}
    ] },
  { id:"invoice", icon:"\ud83e\uddfe", quick:true,
    t:{en:"Make invoice", pcm:"Create invoice"},
    d:{en:"Clean bill in seconds", pcm:"Clean bill sharp sharp"},
    fields:[
      {k:"customer", label:{en:"Customer name", pcm:"Customer name"}, ph:{en:"e.g. Mrs. Adaeze", pcm:"e.g. Mrs. Adaeze"}},
      {k:"items", label:{en:"Items & prices (one per line)", pcm:"Items & price (one for each line)"}, ph:{en:"Bag of rice - 75000\nCooking oil - 12000", pcm:"Bag of rice - 75000\nCooking oil - 12000"}, type:"area"},
      {k:"biz", label:{en:"Your business name", pcm:"Your business name"}, ph:{en:"e.g. Ada Stores", pcm:"e.g. Ada Stores"}}
    ] },
  { id:"negotiate", icon:"\ud83e\udd1d", quick:true,
    t:{en:"Handle price cut", pcm:"\u2018Reduce am\u2019 reply"},
    d:{en:"Reply \u2018abeg reduce\u2019", pcm:"When dem say make you reduce"},
    fields:[
      {k:"product", label:{en:"Product", pcm:"Product"}, ph:{en:"e.g. Samsung earbuds", pcm:"e.g. Samsung earbuds"}},
      {k:"price", label:{en:"Your price (\u20a6)", pcm:"Your price (\u20a6)"}, type:"number", ph:{en:"e.g. 15000", pcm:"e.g. 15000"}},
      {k:"lowest", label:{en:"Lowest you can accept (\u20a6)", pcm:"Last price wey you fit collect (\u20a6)"}, type:"number", ph:{en:"e.g. 13000", pcm:"e.g. 13000"}}
    ] },
  { id:"plan", icon:"\ud83d\uddd3\ufe0f", quick:true,
    t:{en:"Plan my day", pcm:"Plan my day"},
    d:{en:"Organise your hustle", pcm:"Arrange your hustle"},
    fields:[
      {k:"tasks", label:{en:"What must you do today? (one per line)", pcm:"Wetin you must do today? (one for each line)"}, ph:{en:"restock shop\nreply customers\ndeliver 2 orders\npost on WhatsApp", pcm:"restock shop\nreply customers\ndeliver 2 orders\npost for WhatsApp"}, type:"area"}
    ] },
  { id:"study", icon:"\ud83d\udcda", quick:false,
    t:{en:"Explain / study help", pcm:"Explain / study help"},
    d:{en:"Understand any topic", pcm:"Understand any topic"},
    fields:[
      {k:"topic", label:{en:"What should I explain?", pcm:"Wetin make I explain?"}, ph:{en:"e.g. photosynthesis, compound interest", pcm:"e.g. photosynthesis, compound interest"}, type:"area"}
    ] },
  { id:"message", icon:"\u270d\ufe0f", quick:false,
    t:{en:"Write any message", pcm:"Write any message"},
    d:{en:"Emails, apologies, requests", pcm:"Email, apology, request"},
    fields:[
      {k:"about", label:{en:"What do you want to say?", pcm:"Wetin you wan talk?"}, ph:{en:"e.g. ask my landlord for 2 weeks to pay rent", pcm:"e.g. beg my landlord for 2 weeks make I pay rent"}, type:"area"},
      {k:"kind", label:{en:"Type", pcm:"Type"}, type:"select",
        options:{en:["WhatsApp message","Formal email","Apology","Request/Ask"], pcm:["WhatsApp message","Formal email","Apology","Request/Ask"]}}
    ] }
];
/* ---------- DAILY TIPS ---------- */
const TIPS = {
  en:["Separate your money from your profit. Pay yourself a small salary and let the business keep its own cash.",
    "Save your first sale of every day. Even \u20a6200 daily becomes \u20a673,000 in a year.",
    "Follow up old customers with one message today \u2014 repeat buyers are cheaper than new ones.",
    "Post what you sell EVERY day. People buy from sellers they see often.",
    "Price with a small round number ending in 500 or 000 \u2014 it looks cleaner and sells faster.",
    "Bundle two slow items with one fast-seller and sell them as a combo deal.",
    "Reply customers within 5 minutes. Speed closes more sales than low price."],
  pcm:["Separate your money from your profit. Pay yourself small salary, make di business keep im own money.",
    "Save di first sale wey you make every day. Even \u20a6200 daily go turn \u20a673,000 for one year.",
    "Message your old customers today \u2014 person wey don buy before dey cheap pass new person.",
    "Post wetin you dey sell EVERY day. People dey buy from person wey dem dey see well well.",
    "Use price wey end for 500 or 000 \u2014 e dey clean and e dey sell fast.",
    "Join two slow goods with one fast one, sell dem as combo.",
    "Answer customer sharp sharp \u2014 speed dey close sale pass cheap price."]
};

/* ---------- GENERATORS (the "AI") ---------- */
function G(en, pcm){ return lang==="pcm" ? pcm : en; }
const gens = {
  pitch(f){
    const p=f.product||"my product", pr=f.price?naira(f.price):"a great price", a=f.audience;
    const aud = a ? (lang==="pcm"?` Perfect for ${a}!`:` Perfect for ${a}!`) : "";
    return G(
`\ud83d\udd25 ${p.toUpperCase()} \u2014 grab yours today!\n\nLooking for quality ${p} that won't disappoint? This is it. Original, reliable, and worth every naira.\n\n\u2705 Top quality\n\u2705 Fair price: ${pr}\n\u2705 Fast delivery\n${aud}\nMessage me now to order \u2014 stock is limited! \ud83d\uded2`,
`\ud83d\udd25 ${p.toUpperCase()} \u2014 collect your own today!\n\nYou dey find better ${p} wey no go disappoint you? Na here e dey o. Original, correct, and e worth every naira.\n\n\u2705 Correct quality\n\u2705 Better price: ${pr}\n\u2705 Sharp delivery\n${aud}\nMessage me now make you order \u2014 di thing no plenty o! \ud83d\uded2`);
  },
  reply(f){
    const m=(f.message||"").trim(), tone=(f.tone||"Friendly");
    const wantPrice=/price|cost|how much|last|magana|nawa|reduce/i.test(m);
    const base = G(
`Hello, thank you for reaching out! \ud83d\ude4f Yes, it is still available.`,
`Hello, thank you as you message me! \ud83d\ude4f Yes, e still dey available.`);
    const priceLine = wantPrice ? G(
`\n\nThe price is fixed and very fair for the quality you're getting. I can guarantee value for your money.`,
`\n\nDi price dey fixed and e fair well well for di quality wey you dey collect. I fit guarantee say your money no go waste.`) : "";
    const close = tone==="Firm but polite" ? G(
`\n\nKindly confirm so I can reserve it for you. Thank you!`,
`\n\nAbeg confirm make I keep am for you. Thank you!`) : G(
`\n\nShall I package it for you now? \ud83d\ude0a`,
`\n\nMake I package am for you now? \ud83d\ude0a`);
    return base+priceLine+close;
  },
  caption(f){
    const t=f.topic||"our latest offer";
    const tags = G("#Naija #MadeInNigeria #ShopNow #SmallBusiness","#Naija #9ja #ShopNow #SmallBusiness");
    return G(
`\u2728 ${t} is here and you don't want to miss it! \ud83d\udd25\n\nQuality you can trust, prices that make sense. Tag a friend who needs this! \ud83d\udc47\n\nDM to order today \u2014 limited stock! \ud83d\uded2\n\n${tags}`,
`\u2728 ${t} don land, no miss am o! \ud83d\udd25\n\nQuality wey you fit trust, price wey make sense. Tag person wey need am! \ud83d\udc47\n\nDM make you order today \u2014 e no plenty! \ud83d\uded2\n\n${tags}`);
  },
  invoice(f){
    const lines=(f.items||"").split("\n").map(s=>s.trim()).filter(Boolean);
    let total=0; const rows=lines.map(l=>{
      const m=l.match(/(.+?)[\-\u2013:]\s*(\d[\d,]*)/);
      if(m){ const amt=parseInt(m[2].replace(/,/g,""),10)||0; total+=amt; return `  \u2022 ${m[1].trim()} \u2014 ${naira(amt)}`; }
      return `  \u2022 ${l}`;
    }).join("\n");
    const biz=f.biz||"My Business", cust=f.customer||"Customer";
    const dt=new Date().toLocaleDateString("en-NG",{day:"numeric",month:"short",year:"numeric"});
    return G(
`\ud83e\uddfe INVOICE\n${biz}\nDate: ${dt}\nBill to: ${cust}\n\nITEMS:\n${rows}\n\nTOTAL DUE: ${naira(total)}\n\nThank you for your patronage! \ud83d\ude4f\nPayment on delivery / transfer accepted.`,
`\ud83e\uddfe INVOICE\n${biz}\nDate: ${dt}\nBill to: ${cust}\n\nITEMS:\n${rows}\n\nTOTAL WEY YOU GO PAY: ${naira(total)}\n\nThank you for your patronage! \ud83d\ude4f\nYou fit pay on delivery / transfer.`);
  },
  negotiate(f){
    const p=f.product||"the item", price=Number(f.price)||0, low=Number(f.lowest)||Math.round(price*0.9);
    const mid=Math.round((price+low)/2);
    return G(
`I hear you \ud83d\ude4f but ${naira(price)} is already a fair price for ${p} \u2014 the quality is top-notch.\n\nBecause it's you, I can do ${naira(mid)}. That's my genuine discount.\n\nAbsolute last price is ${naira(low)} \u2014 I can't go below that or I make no profit. Shall I package it? \ud83d\ude0a`,
`I hear you \ud83d\ude4f but ${naira(price)} na correct price for ${p} \u2014 di quality na top notch.\n\nNa because na you, I fit do ${naira(mid)}. Na real discount be dat.\n\nMy last last price na ${naira(low)} \u2014 I no fit go below am if not I no go gain anything. Make I package am? \ud83d\ude0a`);
  },
  plan(f){
    const tasks=(f.tasks||"").split("\n").map(s=>s.trim()).filter(Boolean);
    const slots=["8:00 AM","10:00 AM","12:00 PM","2:00 PM","4:00 PM","6:00 PM"];
    const rows=tasks.map((t,i)=>`  ${slots[i]||"Later"} \u2014 ${t}`).join("\n");
    return G(
`\ud83d\uddd3\ufe0f YOUR HUSTLE PLAN FOR TODAY\n\n${rows}\n\n\ud83d\udca1 Tip: Do the money-making task (sales/delivery) first while your energy is high. Reply customers between tasks. You've got this! \ud83d\udcaa`,
`\ud83d\uddd3\ufe0f YOUR HUSTLE PLAN FOR TODAY\n\n${rows}\n\n\ud83d\udca1 Tip: Do di work wey dey bring money (sales/delivery) first while your body still get power. Answer customer between di work. You go make am! \ud83d\udcaa`);
  },
  study(f){
    const t=f.topic||"this topic";
    return G(
`\ud83d\udcda ${t} \u2014 explained simply:\n\nThink of it step by step. First, understand the main idea in one plain sentence. Then break it into small parts you can picture with everyday examples.\n\n\u2022 Start with the \"why\" \u2014 why does it matter?\n\u2022 Use a real-life example you already know.\n\u2022 Repeat it in your own words.\n\nWant me to give practice questions on ${t}? Just ask.`,
`\ud83d\udcda ${t} \u2014 make I explain am simple:\n\nTake am step by step. First, understand di main idea for one plain sentence. Then break am into small parts wey you fit picture with everyday example.\n\n\u2022 Start with di \"why\" \u2014 why e matter?\n\u2022 Use real-life example wey you sabi already.\n\u2022 Talk am again for your own words.\n\nYou want make I give you practice question on ${t}? Just ask.`);
  },
  message(f){
    const a=f.about||"my message", kind=f.kind||"WhatsApp message";
    const formal = /email|formal/i.test(kind);
    return G(
`${formal?"Dear Sir/Madam,":"Hello \ud83d\ude4f"}\n\nI hope this message finds you well. I am writing regarding ${a}.\n\nI would sincerely appreciate your kind understanding and support on this matter. Please let me know if any further information is needed.\n\n${formal?"Thank you for your time.\n\nBest regards,":"Thank you so much!"}`,
`${formal?"Dear Sir/Madam,":"Hello \ud83d\ude4f"}\n\nI hope say you dey fine. I dey write you about ${a}.\n\nI go really appreciate am if you fit understand and support me for dis matter. If you need any other info, just tell me.\n\n${formal?"Thank you for your time.\n\nBest regards,":"Thank you so much!"}`);
  }
};
/* ---------- RENDER UI TEXT ---------- */
function t(k){ return UI[lang][k]; }
function applyLang(){
  document.documentElement.lang = lang==="pcm" ? "en" : "en";
  $("#langLabel").textContent = lang==="pcm" ? "PIDGIN" : "EN";
  $("#tagline").textContent = t("tagline");
  $("#greetTitle").textContent = t("greet");
  $("#greetSub").textContent = t("greetSub");
  $("#dailyPill").textContent = t("dailyPill");
  $("#newTip").textContent = t("newTip");
  $("#qaTitle").textContent = t("qaTitle");
  $("#backLbl").textContent = t("back");
  $("#toolsTitle").textContent = t("toolsTitle");
  $("#toolsSub").textContent = t("toolsSub");
  $("#genBtn").textContent = t("generate");
  $("#regenBtn").textContent = t("regen");
  $("#copyBtn").textContent = t("copy");
  $("#outLabel").textContent = t("result");
  $("#navHome").textContent = t("navHome");
  $("#navTools").textContent = t("navTools");
  $("#navAcct").textContent = t("navAcct");
  $("#accTitle").textContent = t("accTitle");
  $("#planName").textContent = t("planName");
  $("#perMonth").textContent = t("perMonth");
  $("#secureNote").textContent = t("secure");
  $("#statUsesLbl").textContent = t("statUses");
  $("#statSavedLbl").textContent = t("statSaved");
  $("#payTitle").textContent = t("payTitle");
  $("#paySub").textContent = t("paySub");
  $("#confirmPay").textContent = t("iPaid");
  $("#closePay").textContent = t("cancel");
  $("#todayDate").textContent = new Date().toLocaleDateString("en-NG",{weekday:"short",day:"numeric",month:"short"});
  renderTip(); renderQuick(); renderToolsList(); renderAccount(); renderTrial();
  if(currentTool) openTool(currentTool.id);
}

function renderTip(){ $("#dailyTip").textContent = pick(TIPS[lang]); }
function renderTrial(){
  const b=$("#trialBanner");
  if(isPremium()){ b.classList.add("hidden"); return; }
  b.classList.remove("hidden");
  $("#trialText").textContent = UI[lang].trial(usesLeft());
  $("#bannerSub").textContent = t("goPrem");
}
function renderQuick(){
  const g=$("#quickGrid"); g.innerHTML="";
  TOOLS.filter(x=>x.quick).forEach(tool=>{
    const d=document.createElement("div"); d.className="qa";
    d.innerHTML=`<div class="qi">${tool.icon}</div><div class="qt">${esc(tool.t[lang])}</div><div class="qd">${esc(tool.d[lang])}</div>`;
    d.addEventListener("click",()=>{ go("tool"); openTool(tool.id); });
    g.appendChild(d);
  });
}
function renderToolsList(){
  const l=$("#toolsList"); l.innerHTML="";
  TOOLS.forEach(tool=>{
    const d=document.createElement("div"); d.className="li";
    d.innerHTML=`<div class="li-ic">${tool.icon}</div><div><div class="li-t">${esc(tool.t[lang])}</div><div class="li-d">${esc(tool.d[lang])}</div></div><div class="chev">\u203a</div>`;
    d.addEventListener("click",()=>{ go("tool"); openTool(tool.id); });
    l.appendChild(d);
  });
}
function fmtDate(ts){ try{ return new Date(ts).toLocaleDateString("en-NG",{year:"numeric",month:"short",day:"numeric"}); }catch{ return ""; } }
function renderAccount(){
  const prem=isPremium();
  const badge=$("#planStatus");
  badge.textContent = prem ? t("premiumOn") : "Free trial";
  badge.className = "plan-badge "+(prem?"active":"free");
  const ul=$("#benefitsList"); ul.innerHTML="";
  UI[lang].benefits.forEach(b=>{ const li=document.createElement("li"); li.textContent=b; ul.appendChild(li); });
  const pb=$("#payBtn"); const mg=$("#subManage");
  if(prem){
    pb.classList.add("hidden");
    mg.classList.remove("hidden");
    const u=AUTH.user||{};
    const until = u.premiumUntil ? fmtDate(u.premiumUntil) : "";
    const days = u.daysLeft!=null ? u.daysLeft : 0;
    const renews = u.autoRenew!==false;
    $("#subStatus").textContent = `${t("activeUntil")(until)} \u00b7 ${t("daysLeftTxt")(days)}. ${renews?t("willRemind"):t("wontRenew")}`;
    const cb=$("#cancelSubBtn");
    cb.textContent = renews ? t("cancelSub") : t("resumeSub");
    cb.dataset.mode = renews ? "cancel" : "resume";
    $("#renewBtn").textContent = t("renewNow");
  } else {
    mg.classList.add("hidden");
    pb.classList.remove("hidden");
    pb.textContent = t("subscribe");
    pb.disabled = false; pb.style.opacity = "1";
  }
  const done=Number(localStorage.getItem(LS.tasks)||0);
  $("#statUses").textContent = done;
  $("#statSaved").textContent = naira(done*1500);
  $("#accEmail").textContent = AUTH.user ? AUTH.user.email : "";
  $("#logoutBtn").textContent = t("logout");
}

/* ---------- TOOL SCREEN ---------- */
function openTool(id){
  const tool=TOOLS.find(x=>x.id===id); if(!tool) return;
  currentTool=tool;
  $("#toolIcon").textContent=tool.icon;
  $("#toolTitle").textContent=tool.t[lang];
  $("#toolDesc").textContent=tool.d[lang];
  const form=$("#toolForm"); form.innerHTML="";
  tool.fields.forEach(f=>{
    const wrap=document.createElement("div"); wrap.className="field";
    const lab=document.createElement("label"); lab.textContent=f.label[lang]; wrap.appendChild(lab);
    let el;
    if(f.type==="area"){ el=document.createElement("textarea"); }
    else if(f.type==="select"){ el=document.createElement("select");
      f.options[lang].forEach(o=>{ const op=document.createElement("option"); op.value=o; op.textContent=o; el.appendChild(op); }); }
    else { el=document.createElement("input"); el.type=f.type||"text"; }
    if(f.ph) el.placeholder=f.ph[lang]||"";
    el.dataset.key=f.k; el.dataset.opt=f.opt?"1":"";
    wrap.appendChild(el); form.appendChild(wrap);
  });
  $("#output").classList.add("hidden");
}
function collect(){
  const data={}; let ok=true;
  $$("#toolForm [data-key]").forEach(el=>{
    const v=(el.value||"").trim(); data[el.dataset.key]=v;
    if(!v && el.dataset.opt!=="1") ok=false;
  });
  return {data, ok};
}
/* ---------- AI CALL (real model via backend, with offline fallback) ---------- */
async function aiGenerate(tool, data){
  const { ok, status, data:j } = await api("/api/generate",{
    method:"POST",
    body:JSON.stringify({ tool:tool.id, fields:data, lang })
  });
  if(status===401){ const e=new Error("unauth"); e.code=401; throw e; }
  if(status===402){ const e=new Error("subscribe"); e.code=402; throw e; }
  if(!ok || !j || !j.text) throw new Error("HTTP "+status);
  return j.text.trim();
}
function setBusy(on){
  const b=$("#genBtn");
  b.disabled=on; b.classList.toggle("busy",on);
  b.textContent = on ? t("thinking") : t("generate");
}
async function generate(){
  if(!currentTool) return;
  const {data,ok}=collect();
  if(!ok){ toast(t("needInput")); return; }
  if(!isPremium() && usesLeft()<=0){ toast(t("limitHit")); go("account"); return; }
  setBusy(true);
  let out, usedOffline=false;
  try{
    out = await aiGenerate(currentTool, data);   // real AI model (counts against the trial on the server)
  }catch(e){
    setBusy(false);
    if(e.code===401){ showAuth(); return; }
    if(e.code===402){ toast(t("limitHit")); await refreshMe(); renderAll(); go("account"); return; }
    // Offline sample is a resilience feature for PAID users only.
    // Free users must get a real (counted) answer — never a free bypass.
    if(isPremium()){
      out = gens[currentTool.id](data);
      usedOffline=true;
    } else {
      toast(t("aiDown"));
      return;
    }
    setBusy(true);
  }
  setBusy(false);
  $("#outLabel").textContent = t("result") + (usedOffline ? " "+t("offline") : "");
  $("#outText").textContent=out;
  $("#output").classList.remove("hidden");
  $("#output").scrollIntoView({behavior:"smooth",block:"nearest"});
  localStorage.setItem(LS.tasks, String(Number(localStorage.getItem(LS.tasks)||0)+1));
  if(!usedOffline) await refreshMe();  // update trial count from server
  renderTrial(); renderAccount();
}

/* ---------- NAV ---------- */
function go(screen){
  $$(".screen").forEach(s=>s.classList.remove("active"));
  const map={home:"screen-home",tools:"screen-tools",account:"screen-account",tool:"screen-tool"};
  $("#"+map[screen]).classList.add("active");
  $$(".nav-item").forEach(n=>n.classList.toggle("active", n.dataset.nav===screen));
  $(".screens").scrollTop=0;
}

/* ---------- PAYMENT (auto-verified via Monnify / demo fallback) ---------- */
let payMode = "demo";   // 'monnify' | 'demo'
let verifyTimer = null;

function renderPayInfo(){
  $("#bankName").textContent = BANK.name;
  $("#acctNo").textContent = BANK.account;
  $("#acctName").textContent = BANK.accountName;
  $("#bankLbl").textContent = t("bankLbl");
  $("#acctLbl").textContent = t("acctLbl");
  $("#nameLbl").textContent = t("nameLbl");
  $("#amtLbl").textContent = t("amtLbl");
  $("#confirmPay").textContent = t("iPaid");
  $("#copyAcct").textContent = t("copy");
}
function showBankBox(show){ $(".bank-box").style.display = show?"flex":"none"; $("#copyAcct").style.display = show?"":"none"; }

async function openPay(force){
  if(isPremium() && !force) return;
  if(!AUTH.token){ showAuth(); return; }
  $("#payModal").classList.remove("hidden");
  const btn=$("#confirmPay"); btn.disabled=true; $("#payNote").textContent=t("opening");
  const { ok, data } = await api("/api/pay/init",{ method:"POST", body:"{}" });
  btn.disabled=false;
  if(!ok){ $("#payNote").textContent=t("payFail"); return; }
  if(data.alreadyPremium){ closePay(); await refreshMe(); renderAll(); return; }
  if(data.checkoutUrl){
    // Live gateway: money is auto-verified
    payMode="monnify";
    renderPayInfo(); showBankBox(false);
    $("#payNote").textContent = t("waitPay");
    $("#confirmPay").textContent = t("checkNow");
    window.open(data.checkoutUrl, "_blank");
    startVerifyPolling();
  } else {
    // Demo mode: manual bank transfer to your Moniepoint account
    payMode="demo";
    if(data.bank){ BANK.name=data.bank.name||BANK.name; BANK.account=data.bank.account||BANK.account; }
    renderPayInfo(); showBankBox(true);
    $("#payNote").textContent = t("payTransfer");
    $("#confirmPay").textContent = t("iPaid");
  }
}
function closePay(){ $("#payModal").classList.add("hidden"); if(verifyTimer){ clearInterval(verifyTimer); verifyTimer=null; } }

async function doVerify(silent){
  const { ok, data } = await api("/api/pay/verify");
  if(ok && data.premium){
    if(verifyTimer){ clearInterval(verifyTimer); verifyTimer=null; }
    closePay(); await refreshMe(); toast(t("paid")); renderAll();
    return true;
  }
  if(!silent) toast(t("notPaidYet"));
  return false;
}
function startVerifyPolling(){
  if(verifyTimer) clearInterval(verifyTimer);
  let n=0;
  verifyTimer=setInterval(async()=>{ n++; const done=await doVerify(true); if(done||n>40){ clearInterval(verifyTimer); verifyTimer=null; } }, 4000);
}

async function confirmPay(){
  const btn=$("#confirmPay"); btn.disabled=true; const label=btn.textContent; btn.textContent=t("checking");
  if(payMode==="monnify"){
    await doVerify(false);
  } else {
    // demo mode: activate after manual transfer
    const { ok, data } = await api("/api/pay/demo-confirm",{ method:"POST", body:"{}" });
    if(ok && data.premium){ closePay(); await refreshMe(); toast(t("paid")); renderAll(); }
    else toast(t("payFail"));
  }
  btn.disabled=false; btn.textContent=label;
}

async function cancelOrResume(){
  const u=AUTH.user||{};
  if(u.autoRenew){
    if(!confirm(t("cancelConfirm"))) return;
    const { ok, data } = await api("/api/sub/cancel",{ method:"POST", body:"{}" });
    if(ok && data.user){ AUTH.user=data.user; toast(t("cancelDone")); renderAll(); }
    else toast(t("payFail"));
  } else {
    const { ok, data } = await api("/api/sub/resume",{ method:"POST", body:"{}" });
    if(ok && data.user){ AUTH.user=data.user; toast(t("resumeDone")); renderAll(); }
    else toast(t("payFail"));
  }
}

/* ---------- AUTH UI ---------- */
function renderAuth(){
  $("#authTitle").textContent = t("welcome");
  $("#authSub").textContent = authMode==="signup" ? t("subSignup") : t("subLogin");
  $("#emailLbl").textContent = t("emailLbl");
  $("#pwLbl").textContent = t("pwLbl");
  $("#tabLogin").textContent = t("login");
  $("#tabSignup").textContent = t("signup");
  $("#authBtn").textContent = authMode==="signup" ? t("signup") : t("login");
  $("#tabLogin").classList.toggle("active", authMode==="login");
  $("#tabSignup").classList.toggle("active", authMode==="signup");
  $("#authPw").setAttribute("autocomplete", authMode==="signup"?"new-password":"current-password");
}
function showAuth(){ AUTH.token=""; localStorage.removeItem("ogaai_token"); AUTH.user=null; renderAuth(); $("#authScreen").classList.remove("hidden"); }
function hideAuth(){ $("#authScreen").classList.add("hidden"); }
function authError(msg){ const e=$("#authErr"); e.textContent=msg; e.classList.remove("hidden"); }

async function doAuth(){
  const email=$("#authEmail").value.trim();
  const pw=$("#authPw").value;
  $("#authErr").classList.add("hidden");
  const btn=$("#authBtn"); btn.disabled=true;
  const path = authMode==="signup" ? "/api/auth/signup" : "/api/auth/login";
  const { ok, data, network } = await api(path,{ method:"POST", body:JSON.stringify({ email, password:pw }) });
  btn.disabled=false;
  if(!ok){ authError(data.error || t("netErr")); return; }
  AUTH.token=data.token; localStorage.setItem("ogaai_token", AUTH.token);
  AUTH.user=data.user;
  await refreshMe();
  hideAuth(); renderAll(); go("home");
}
async function refreshMe(){
  if(!AUTH.token) return;
  const { ok, data } = await api("/api/auth/me");
  if(ok){ AUTH.user=data.user; AUTH.freeLeft = data.freeLeft; }
  else if(!ok){ showAuth(); }
}
function logout(){ showAuth(); }

/* ---------- global re-render ---------- */
function renderAll(){ renderTrial(); renderAccount(); renderQuick(); renderToolsList(); }

/* ---------- TOAST ---------- */
let toastTimer;
function toast(msg){
  const el=$("#toast"); el.textContent=msg; el.classList.remove("hidden");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.add("hidden"),2600);
}

/* ---------- WIRE EVENTS ---------- */
$("#langToggle").addEventListener("click",()=>{
  lang = lang==="en" ? "pcm" : "en";
  localStorage.setItem(LS.lang, lang); applyLang(); renderAuth();
});
$("#newTip").addEventListener("click", renderTip);
$("#backBtn").addEventListener("click",()=>go("home"));
$("#genBtn").addEventListener("click", generate);
$("#regenBtn").addEventListener("click", generate);
$("#copyBtn").addEventListener("click",()=>{
  const txt=$("#outText").textContent;
  navigator.clipboard?.writeText(txt).then(()=>toast(t("copied"))).catch(()=>toast(t("copied")));
});
$$(".nav-item").forEach(n=>n.addEventListener("click",()=>go(n.dataset.nav)));
$("#payBtn").addEventListener("click", ()=>openPay());
$("#bannerSub").addEventListener("click", ()=>openPay());
$("#renewBtn").addEventListener("click", ()=>openPay(true));
$("#cancelSubBtn").addEventListener("click", cancelOrResume);
$("#closePay").addEventListener("click", closePay);
$("#confirmPay").addEventListener("click", confirmPay);
$("#copyAcct").addEventListener("click",()=>{
  navigator.clipboard?.writeText(BANK.account).then(()=>toast(t("acctCopied"))).catch(()=>toast(t("acctCopied")));
});
$("#payModal").addEventListener("click",(e)=>{ if(e.target.id==="payModal") closePay(); });
// auth wiring
$("#tabLogin").addEventListener("click",()=>{ authMode="login"; renderAuth(); });
$("#tabSignup").addEventListener("click",()=>{ authMode="signup"; renderAuth(); });
$("#authBtn").addEventListener("click", doAuth);
$("#authPw").addEventListener("keydown",(e)=>{ if(e.key==="Enter") doAuth(); });
$("#logoutBtn").addEventListener("click", logout);

/* ---------- INIT / BOOT ---------- */
async function loadConfig(){
  try{ const { ok, data } = await api("/api/config"); if(ok) CFG=data; }catch{}
}
async function boot(){
  applyLang();
  await loadConfig();
  if(AUTH.token){
    await refreshMe();
    if(AUTH.user){ hideAuth(); renderAll(); go("home"); }
    else { showAuth(); }
  } else {
    showAuth();
  }
  // auto-verify if returning from a live checkout redirect (?paid=1)
  if(/[?&]paid=1/.test(location.search) && AUTH.token){ await doVerify(true); }
}
boot();
