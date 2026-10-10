/**
 * QUEST WEEK UA ROTATIONS — Google Apps Script backend
 * Saves student work live to a Google Sheet you own, and powers the teacher dashboard.
 *
 * SETUP (one time):
 *  1. Go to script.google.com → New project. Name it "Quest Week UA".
 *  2. Paste this file into Code.gs (replace everything).
 *  3. Click + (Add a file) → HTML → name it exactly: Index   → paste the Index.html file.
 *  4. Optional: add co-teacher emails to EXTRA_TEACHERS below.
 *  5. Deploy → New deployment → type: Web app
 *       Execute as: Me
 *       Who has access: Anyone within your district (sbcusd.k12.ca.us)
 *     Click Deploy, approve permissions, and copy the Web app URL.
 *  6. Post the URL in Google Classroom. Open it yourself to see the Teacher Dashboard.
 */
const EXTRA_TEACHERS = []; // e.g. ["co.teacher@sbcusd.k12.ca.us"]
const WORK_HEADERS = ["id", "email", "name", "guild", "avatar", "missionId", "day", "subject", "status", "started", "updated", "itemsDone", "itemsTotal", "correct", "scored", "autoPct", "xp", "current", "legend", "responses", "reviewScore", "reviewFeedback", "reviewItems", "reviewTs", "seen"];
const PROFILE_HEADERS = ["email", "name", "hero", "avatar", "guild", "route", "updated"];

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Quest Week Rotations")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ---------- helpers ----------
function me_() { return (Session.getActiveUser().getEmail() || "").toLowerCase(); }
function isTeacher_() {
  const m = me_(), owner = (Session.getEffectiveUser().getEmail() || "").toLowerCase();
  return m && (m === owner || EXTRA_TEACHERS.map(function (e) { return String(e).toLowerCase(); }).indexOf(m) >= 0);
}
function requireTeacher_() { if (!isTeacher_()) throw new Error("Teacher access only."); }
function ss_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty("SHEET_ID"), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create("Quest Week UA — Student Work");
    props.setProperty("SHEET_ID", ss.getId());
  }
  [["Work", WORK_HEADERS], ["Profiles", PROFILE_HEADERS]].forEach(function (p) {
    let sh = ss.getSheetByName(p[0]);
    if (!sh) { sh = ss.insertSheet(p[0]); sh.appendRow(p[1]); sh.setFrozenRows(1); }
  });
  const def = ss.getSheetByName("Sheet1"); if (def && ss.getSheets().length > 2) ss.deleteSheet(def);
  return ss;
}
function rows_(name, headers) {
  const sh = ss_().getSheetByName(name), v = sh.getDataRange().getValues();
  const out = [];
  for (let r = 1; r < v.length; r++) { const o = { _row: r + 1 }; headers.forEach(function (h, c) { o[h] = v[r][c]; }); out.push(o); }
  return { sh: sh, rows: out };
}
function settings_() {
  const raw = PropertiesService.getScriptProperties().getProperty("SETTINGS");
  return raw ? JSON.parse(raw) : { tt: { 1: "math", 2: "ela", 3: "write", 4: "math", 5: "ela" } };
}
function workOut_(o) {
  return {
    id: o.id, email: o.email, name: o.name, guild: o.guild, avatar: o.avatar, missionId: o.missionId, day: Number(o.day), subject: o.subject,
    status: o.status, started: Number(o.started), updated: Number(o.updated), itemsDone: Number(o.itemsDone), itemsTotal: Number(o.itemsTotal),
    correct: Number(o.correct), scored: Number(o.scored), autoPct: Number(o.autoPct), xp: Number(o.xp), current: o.current, legend: o.legend === true || o.legend === "TRUE",
    responses: o.responses ? JSON.parse(o.responses) : [],
    review: o.reviewTs ? { score: Number(o.reviewScore) || 0, feedback: o.reviewFeedback, items: o.reviewItems ? JSON.parse(o.reviewItems) : {}, ts: Number(o.reviewTs) } : null,
    seen: o.seen === true || o.seen === "TRUE",
  };
}
function profilesMap_() {
  const m = {};
  rows_("Profiles", PROFILE_HEADERS).rows.forEach(function (p) { m[p.email] = { email: p.email, name: p.name, hero: p.hero, avatar: p.avatar, guild: p.guild, route: p.route }; });
  return m;
}

// ---------- API ----------
function api_boot() {
  const email = me_();
  if (!email) throw new Error("Please sign in with your school Google account.");
  const profile = profilesMap_()[email] || null;
  return { email: email, isTeacher: isTeacher_(), profile: profile, settings: settings_() };
}
function api_saveProfile(p) {
  const email = me_(), lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const t = rows_("Profiles", PROFILE_HEADERS), found = t.rows.filter(function (r) { return r.email === email; })[0];
    const row = [email, String(p.name || "").slice(0, 40), String(p.hero || "").slice(0, 30), p.avatar, p.guild, p.route, Date.now()];
    if (found) t.sh.getRange(found._row, 1, 1, row.length).setValues([row]); else t.sh.appendRow(row);
  } finally { lock.releaseLock(); }
  return { email: email, name: p.name, hero: p.hero, avatar: p.avatar, guild: p.guild, route: p.route };
}
function api_saveWork(json) {
  const r = JSON.parse(json), email = me_();
  if (r.email !== email) r.email = email; // students can only save their own work
  if (String(r.id).indexOf(email + "|") !== 0) throw new Error("Bad record id.");
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const t = rows_("Work", WORK_HEADERS), found = t.rows.filter(function (x) { return x.id === r.id; })[0];
    const base = [r.id, email, r.name, r.guild, r.avatar, r.missionId, r.day, r.subject, r.status, r.started, Date.now(), r.itemsDone, r.itemsTotal, r.correct, r.scored, r.autoPct, r.xp, r.current, !!r.legend, JSON.stringify(r.responses || []).slice(0, 49000)];
    if (found) t.sh.getRange(found._row, 1, 1, base.length).setValues([base]); // keeps review columns
    else t.sh.appendRow(base.concat(["", "", "", "", false]));
  } finally { lock.releaseLock(); }
  return true;
}
function api_myWork() {
  const email = me_();
  return JSON.stringify(rows_("Work", WORK_HEADERS).rows.filter(function (x) { return x.email === email; }).map(workOut_));
}
function api_markSeen(id) {
  const email = me_(), t = rows_("Work", WORK_HEADERS), f = t.rows.filter(function (x) { return x.id === id && x.email === email; })[0];
  if (f) t.sh.getRange(f._row, WORK_HEADERS.indexOf("seen") + 1).setValue(true);
  return true;
}
function api_leaderboard() {
  const tally = {};
  rows_("Work", WORK_HEADERS).rows.forEach(function (x) { tally[x.guild] = (tally[x.guild] || 0) + (Number(x.xp) || 0); });
  ["🐉 Dragons", "🦅 Eagles", "🐺 Wolves", "🦁 Lions", "🦈 Sharks", "🦉 Owls"].forEach(function (g) { if (!(g in tally)) tally[g] = 0; });
  return JSON.stringify(tally);
}
function api_teacherAll() {
  requireTeacher_();
  return JSON.stringify({ work: rows_("Work", WORK_HEADERS).rows.map(workOut_), profiles: profilesMap_(), settings: settings_() });
}
function api_saveReview(id, json) {
  requireTeacher_();
  const rv = JSON.parse(json), lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const t = rows_("Work", WORK_HEADERS), f = t.rows.filter(function (x) { return x.id === id; })[0];
    if (!f) throw new Error("Submission not found.");
    const c = WORK_HEADERS.indexOf("reviewScore") + 1;
    t.sh.getRange(f._row, c, 1, 5).setValues([[rv.score, rv.feedback || "", JSON.stringify(rv.items || {}), Date.now(), false]]);
  } finally { lock.releaseLock(); }
  return true;
}
function api_saveSettings(json) {
  requireTeacher_();
  PropertiesService.getScriptProperties().setProperty("SETTINGS", json);
  return true;
}
function api_sheetUrl() { requireTeacher_(); return ss_().getUrl(); }
