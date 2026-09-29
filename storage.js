/* ============================================================
   OgaAI storage layer
   - If MONGODB_URI is set  -> use MongoDB (accounts persist online)
   - Otherwise              -> use local data/users.json (localhost)
   Same async interface either way, so server.js doesn't care which.
   ============================================================ */
"use strict";
const path = require("path");
const fs = require("fs");

const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB  = process.env.MONGODB_DB  || "ogaai";

let mode = "file";
let coll = null;              // mongo collection
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

/* ---------- file backend (localhost fallback) ---------- */
function fileLoadAll(){ try{ return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")); }catch{ return {}; } }
function fileSaveAll(o){ if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR); fs.writeFileSync(USERS_FILE, JSON.stringify(o, null, 2)); }

/* ---------- init ---------- */
async function init(){
  if(MONGODB_URI){
    const { MongoClient } = require("mongodb");
    const client = new MongoClient(MONGODB_URI, { maxPoolSize: 10 });
    await client.connect();
    coll = client.db(MONGODB_DB).collection("users");
    await coll.createIndex({ email: 1 }, { unique: true });
    mode = "mongo";
  } else {
    if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    mode = "file";
  }
  return mode;
}

/* ---------- get one user by email ---------- */
async function getUser(email){
  if(mode === "mongo"){
    const doc = await coll.findOne({ email });
    if(doc) delete doc._id;   // keep our object clean for later $set
    return doc || null;
  }
  const all = fileLoadAll();
  return all[email] || null;
}

/* ---------- create or update a user (upsert by email) ---------- */
async function saveUser(u){
  if(!u || !u.email) throw new Error("saveUser: missing email");
  if(mode === "mongo"){
    const doc = Object.assign({}, u);
    delete doc._id;
    await coll.updateOne({ email: u.email }, { $set: doc }, { upsert: true });
    return u;
  }
  const all = fileLoadAll();
  all[u.email] = u;
  fileSaveAll(all);
  return u;
}

function backend(){ return mode; }

module.exports = { init, getUser, saveUser, backend };
