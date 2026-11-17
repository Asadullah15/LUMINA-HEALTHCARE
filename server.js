"use strict";
/* =====================================================================
   Lumina Health — web server (no external packages needed)
   Start:  node server.js      (or double-click start.bat)
   Open:   http://localhost:3000
   Data is saved in data.json next to this file (created on first run).
   All roles & permission rules live in lumina-core.js.
   ===================================================================== */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Core = require("./lumina-core.js");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, "data.json");
// Only these files are served to browsers. data.json and server.js are never exposed.
const FILES = {
  "index.html": "text/html", "emr.html": "text/html", "pricing.html": "text/html", "contact.html": "text/html",
  "login.html": "text/html", "app.html": "text/html", "lumina-core.js": "text/javascript",
};
const SESSION_HOURS = 12;

const core = Core.create({
  rand: (n) => crypto.randomBytes(n).toString("hex"),
  hash: (pw) => { const salt = crypto.randomBytes(16).toString("hex"); return salt + ":" + crypto.scryptSync(String(pw), salt, 64).toString("hex"); },
  verify: (pw, stored) => {
    const [salt, h] = String(stored || "").split(":");
    if (!salt || !h || salt === "demo") return false;
    const a = Buffer.from(h, "hex"), b = crypto.scryptSync(String(pw), salt, 64);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },
});

/* ---------------- database ---------------- */
let db;
function save() { const tmp = DB_FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, DB_FILE); }
function load() {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    if (!db.settings || !db.vitals) { // data.json from an older version: upgrade by re-seeding
      fs.renameSync(DB_FILE, DB_FILE.replace(/\.json$/, "-old-" + Date.now() + ".json"));
      db = core.seed(); save(); return true;
    }
    return false;
  }
  db = core.seed(); save(); return true;
}

/* ---------------- sessions & rate limits ---------------- */
const sessions = new Map();
const parseCookies = (h) => { const o = {}; (h || "").split(";").forEach((p) => { const i = p.indexOf("="); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; };
function getAuth(req) {
  const token = parseCookies(req.headers.cookie).lh_sid;
  const s = token && sessions.get(token);
  if (!s) return null;
  if (s.exp < Date.now()) { sessions.delete(token); return null; }
  const user = db.users.find((x) => x.id === s.userId && x.active);
  return user ? { user, token } : null;
}
const sessionCookie = (token, maxAge) => `lh_sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
const dropSessions = (userId, keep) => { for (const [t, s] of sessions) if (s.userId === userId && t !== keep) sessions.delete(t); };
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const n = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < n) { b = { count: 0, reset: n + windowMs }; buckets.set(key, b); }
  if (++b.count > max) { const e = new Error("Too many attempts. Please wait a few minutes and try again."); e.status = 429; throw e; }
}

/* ---------------- HTTP ---------------- */
function sendJson(res, status, obj) {
  if (res.headersSent) return;
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 200 * 1024) { const e = new Error("Request too large"); e.status = 413; reject(e); req.destroy(); } else chunks.push(c); });
    req.on("end", () => {
      try { const v = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}; resolve(v && typeof v === "object" && !Array.isArray(v) ? v : {}); }
      catch { const e = new Error("Invalid JSON"); e.status = 400; reject(e); }
    });
    req.on("error", reject);
  });
}
async function handleApi(req, res, url) {
  const p = url.pathname, ip = req.socket.remoteAddress;
  if (p === "/api/health") return sendJson(res, 200, { ok: true, lumina: true, mode: "server" });
  let body = {};
  if (req.method !== "GET") {
    // Requiring JSON blocks cross-site form posts (CSRF); cookies are also SameSite=Strict.
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) { const e = new Error("Content-Type must be application/json"); e.status = 415; throw e; }
    body = await readBody(req);
  }
  const auth = getAuth(req);
  if (p === "/api/login" && req.method === "POST") {
    rateLimit("login:" + ip, 10, 15 * 60e3);
    const user = core.login(db, body.email, body.password);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { userId: user.id, exp: Date.now() + SESSION_HOURS * 3600e3 });
    save();
    res.setHeader("Set-Cookie", sessionCookie(token, SESSION_HOURS * 3600));
    return sendJson(res, 200, { user: core.pub(user) });
  }
  if (p === "/api/logout") {
    if (auth) sessions.delete(auth.token);
    res.setHeader("Set-Cookie", sessionCookie("", 0));
    return sendJson(res, 200, { ok: true });
  }
  if (p === "/api/leads" && req.method === "POST") rateLimit("lead:" + ip, 20, 60 * 60e3);
  const query = Object.fromEntries(url.searchParams);
  let out;
  try { out = core.handle(db, auth && auth.user, req.method, p, body, query); }
  catch (e) { if (req.method !== "GET") db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); throw e; } // undo any half-applied change
  if (req.method !== "GET") {
    save();
    if (out.changedUser) dropSessions(out.changedUser, auth && auth.token); // log out a user whose account was changed/deleted
    if (p === "/api/me/password" && auth) dropSessions(auth.user.id, auth.token);
  }
  sendJson(res, 200, out.data);
}

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") { const e = new Error("Method not allowed"); e.status = 405; throw e; }
    let name = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    if (!name.includes(".")) name += ".html"; // /pricing -> pricing.html
    if (!FILES[name]) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      return res.end('<!doctype html><meta charset="utf-8"><title>Not found</title><body style="font-family:system-ui;padding:40px"><h1>Page not found</h1><p><a href="/">Back to Lumina Health</a></p>');
    }
    const content = fs.readFileSync(path.join(ROOT, name));
    res.writeHead(200, { "Content-Type": FILES[name] + "; charset=utf-8", "Cache-Control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch (e) {
    if (!e.status) console.error(e);
    sendJson(res, e.status || 500, { error: e.status ? e.message : "Something went wrong on the server" });
  }
});

const fresh = load();
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") console.error("\n  Port " + PORT + " is already in use. Lumina may already be running. Open http://localhost:" + PORT + "\n");
  else console.error(e);
  process.exit(1);
});
server.listen(PORT, () => {
  console.log("\n  Lumina Health is running at  http://localhost:" + PORT);
  console.log("  Login page:                   http://localhost:" + PORT + "/login.html\n");
  if (fresh) console.log("  Created data.json with demo data.\n");
  console.log("  Demo accounts (change these passwords before real use):");
  console.log("    Admin      admin@lumina.local      Admin@123");
  console.log("    Doctor     doctor@lumina.local     Doctor@123");
  console.log("    Nurse      nurse@lumina.local      Nurse@123");
  console.log("    Reception  reception@lumina.local  Reception@123");
  console.log("    Patient    patient@lumina.local    Patient@123\n");
  console.log("  Press Ctrl+C to stop.\n");
});
