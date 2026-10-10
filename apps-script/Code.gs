/**
 * QUEST WEEK UA ROTATIONS — data API for the GitHub Pages site
 * Saves student work to a Google Sheet you own and powers the teacher dashboard.
 *
 * SETUP (one time — see README.md for screenshots-free steps):
 *  1. script.google.com → New project → name it "Quest Week UA API".
 *  2. Replace everything in Code.gs with this file.
 *  3. Change CLASS_CODE and TEACHER_PASSWORD below. Save.
 *  4. Deploy → New deployment → ⚙️ Web app
 *       Execute as: Me
 *       Who has access: Anyone
 *     (Students do NOT need Google accounts; they sign in with the class code,
 *      their first name + last initial, and a 4-digit secret code.)
 *  5. Copy the Web app URL (ends in /exec) into js/config.js on GitHub.
 *  After you edit this file later: Deploy → Manage deployments → ✏️ → Version: New version → Deploy.
 */
const CLASS_CODE = "QUEST5";            // students type this to join (not case-sensitive)
const TEACHER_PASSWORD = "change-me-now"; // you type this to open the teacher dashboard

const WORK_HEADERS = ["id", "student", "name", "guild", "avatar", "missionId", "day", "subject", "status", "started", "updated", "itemsDone", "itemsTotal", "correct", "scored", "autoPct", "xp", "current", "legend", "responses", "reviewScore", "reviewFeedback", "reviewItems", "reviewTs", "seen"];
const PROFILE_HEADERS = ["student", "name", "hero", "avatar", "guild", "route", "pinHash", "updated"];
const GUILDS = ["🐉 Dragons", "🦅 Eagles", "🐺 Wolves", "🦁 Lions", "🦈 Sharks", "🦉 Owls"];

// ---------- web entry points ----------
function doGet() { return json_({ ok: true, data: { app: "Quest Week UA API", status: "running" } }); }
function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const fn = ACTIONS[req.action];
    if (!fn) return json_({ ok: false, error: "Unknown action." });
    return json_({ ok: true, data: fn(req) });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err), code: err.code || "" });
  }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fail_(msg, code) { const e = new Error(msg); e.code = code || ""; throw e; }

// ---------- auth ----------
function key_(name) { return String(name || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 .'-]/g, "").slice(0, 40); }
function hash_(s) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s + "|" + CLASS_CODE)); }
function isTeacher_(auth) { return auth && auth.role === "teacher" && String(auth.password) === TEACHER_PASSWORD; }
function requireTeacher_(req) { if (!isTeacher_(req.auth)) fail_("Teacher password is incorrect.", "auth"); }
/** Returns the signed-in student's key. Creates the profile row (with the PIN) on first sign-in. */
function student_(req) {
  const a = req.auth || {};
  if (a.role !== "student") fail_("Please sign in.", "auth");
  if (String(a.classCode || "").trim().toUpperCase() !== CLASS_CODE.toUpperCase()) fail_("That class code doesn't match. Check with your teacher.", "auth");
  const k = key_(a.name);
  if (!k) fail_("Type your first name and last initial.", "auth");
  if (!/^\d{4}$/.test(String(a.pin || ""))) fail_("Your secret code must be 4 numbers.", "pin");
  const t = rows_("Profiles", PROFILE_HEADERS), p = t.rows.filter(function (r) { return r.student === k; })[0];
  if (!p) {
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try { t.sh.appendRow([k, String(a.name).trim().slice(0, 40), "", "", "", "", hash_(a.pin), Date.now()]); } finally { lock.releaseLock(); }
  } else if (!p.pinHash) {
    t.sh.getRange(p._row, PROFILE_HEADERS.indexOf("pinHash") + 1).setValue(hash_(a.pin)); // after a teacher reset
  } else if (p.pinHash !== hash_(a.pin)) {
    fail_("That secret code doesn't match. Ask your teacher to reset it if you forgot.", "pin");
  }
  return k;
}

// ---------- sheet helpers ----------
function ss_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty("SHEET_ID"), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create("Quest Week UA — Student Work"); props.setProperty("SHEET_ID", ss.getId()); }
  [["Work", WORK_HEADERS], ["Profiles", PROFILE_HEADERS]].forEach(function (p) {
    let sh = ss.getSheetByName(p[0]);
    if (!sh) { sh = ss.insertSheet(p[0]); sh.appendRow(p[1]); sh.setFrozenRows(1); }
  });
  const def = ss.getSheetByName("Sheet1"); if (def && ss.getSheets().length > 2) ss.deleteSheet(def);
  return ss;
}
function rows_(name, headers) {
  const sh = ss_().getSheetByName(name), v = sh.getDataRange().getValues(), out = [];
  for (let r = 1; r < v.length; r++) { const o = { _row: r + 1 }; headers.forEach(function (h, c) { o[h] = v[r][c]; }); out.push(o); }
  return { sh: sh, rows: out };
}
function settings_() {
  const raw = PropertiesService.getScriptProperties().getProperty("SETTINGS");
  return raw ? JSON.parse(raw) : { tt: { 1: "math", 2: "ela", 3: "write", 4: "math", 5: "ela" } };
}
function bool_(v) { return v === true || v === "TRUE" || v === "true"; }
function workOut_(o) {
  return {
    id: o.id, email: o.student, name: o.name, guild: o.guild, avatar: o.avatar, missionId: o.missionId, day: Number(o.day), subject: o.subject,
    status: o.status, started: Number(o.started), updated: Number(o.updated), itemsDone: Number(o.itemsDone), itemsTotal: Number(o.itemsTotal),
    correct: Number(o.correct), scored: Number(o.scored), autoPct: Number(o.autoPct), xp: Number(o.xp), current: o.current, legend: bool_(o.legend),
    responses: o.responses ? JSON.parse(o.responses) : [],
    review: o.reviewTs ? { score: Number(o.reviewScore) || 0, feedback: o.reviewFeedback, items: o.reviewItems ? JSON.parse(o.reviewItems) : {}, ts: Number(o.reviewTs) } : null,
    seen: bool_(o.seen),
  };
}
function profileOut_(p) { return { email: p.student, name: p.name, hero: p.hero, avatar: p.avatar, guild: p.guild, route: p.route }; }

// ---------- actions ----------
const ACTIONS = {
  boot: function (req) {
    if (isTeacher_(req.auth)) return { email: "teacher", isTeacher: true, profile: null, settings: settings_() };
    if (req.auth && req.auth.role === "teacher") fail_("That teacher password is incorrect.", "auth");
    const k = student_(req), p = rows_("Profiles", PROFILE_HEADERS).rows.filter(function (r) { return r.student === k; })[0];
    return { email: k, isTeacher: false, profile: p && p.avatar ? profileOut_(p) : null, settings: settings_() };
  },
  saveProfile: function (req) {
    const k = student_(req), p = req.profile || {}, lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      const t = rows_("Profiles", PROFILE_HEADERS), f = t.rows.filter(function (r) { return r.student === k; })[0];
      const route = ["A", "B", "C"].indexOf(p.route) >= 0 ? p.route : "B", guild = GUILDS.indexOf(p.guild) >= 0 ? p.guild : GUILDS[0];
      t.sh.getRange(f._row, 2, 1, 5).setValues([[f.name, String(p.hero || f.name).slice(0, 30), String(p.avatar || "🦸").slice(0, 4), guild, route]]);
      t.sh.getRange(f._row, PROFILE_HEADERS.indexOf("updated") + 1).setValue(Date.now());
      return { email: k, name: f.name, hero: String(p.hero || f.name).slice(0, 30), avatar: p.avatar, guild: guild, route: route };
    } finally { lock.releaseLock(); }
  },
  saveWork: function (req) {
    const k = student_(req), r = req.record || {};
    if (String(r.id).indexOf(k + "|") !== 0) r.id = k + "|" + r.missionId + "|" + String(r.id).split("|").pop();
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      const t = rows_("Work", WORK_HEADERS), f = t.rows.filter(function (x) { return x.id === r.id; })[0];
      const base = [r.id, k, r.name, r.guild, r.avatar, r.missionId, r.day, r.subject, r.status, r.started, Date.now(), r.itemsDone, r.itemsTotal, r.correct, r.scored, r.autoPct, r.xp, r.current, !!r.legend, JSON.stringify(r.responses || []).slice(0, 49000)];
      if (f) t.sh.getRange(f._row, 1, 1, base.length).setValues([base]); // review columns are kept
      else t.sh.appendRow(base.concat(["", "", "", "", false]));
    } finally { lock.releaseLock(); }
    return true;
  },
  myWork: function (req) {
    const k = student_(req);
    return rows_("Work", WORK_HEADERS).rows.filter(function (x) { return x.student === k; }).map(workOut_);
  },
  markSeen: function (req) {
    const k = student_(req), t = rows_("Work", WORK_HEADERS), f = t.rows.filter(function (x) { return x.id === req.id && x.student === k; })[0];
    if (f) t.sh.getRange(f._row, WORK_HEADERS.indexOf("seen") + 1).setValue(true);
    return true;
  },
  leaderboard: function (req) {
    if (!isTeacher_(req.auth)) student_(req);
    const tally = {}; GUILDS.forEach(function (g) { tally[g] = 0; });
    rows_("Work", WORK_HEADERS).rows.forEach(function (x) { tally[x.guild] = (tally[x.guild] || 0) + (Number(x.xp) || 0); });
    return tally;
  },
  teacherAll: function (req) {
    requireTeacher_(req);
    const profiles = {};
    rows_("Profiles", PROFILE_HEADERS).rows.forEach(function (p) { profiles[p.student] = profileOut_(p); });
    return { work: rows_("Work", WORK_HEADERS).rows.map(workOut_), profiles: profiles, settings: settings_() };
  },
  saveReview: function (req) {
    requireTeacher_(req);
    const rv = req.review || {}, lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      const t = rows_("Work", WORK_HEADERS), f = t.rows.filter(function (x) { return x.id === req.id; })[0];
      if (!f) fail_("Submission not found.");
      t.sh.getRange(f._row, WORK_HEADERS.indexOf("reviewScore") + 1, 1, 5).setValues([[rv.score, rv.feedback || "", JSON.stringify(rv.items || {}), Date.now(), false]]);
    } finally { lock.releaseLock(); }
    return true;
  },
  saveSettings: function (req) { requireTeacher_(req); PropertiesService.getScriptProperties().setProperty("SETTINGS", JSON.stringify(req.settings || {})); return true; },
  sheetUrl: function (req) { requireTeacher_(req); return ss_().getUrl(); },
  resetPin: function (req) {
    requireTeacher_(req);
    const t = rows_("Profiles", PROFILE_HEADERS), f = t.rows.filter(function (r) { return r.student === req.key; })[0];
    if (!f) fail_("Student not found.");
    t.sh.getRange(f._row, PROFILE_HEADERS.indexOf("pinHash") + 1).setValue("");
    return true;
  },
};

/** Optional: run once from the editor to create the Sheet and approve permissions before class. */
function setup() { Logger.log("Your data sheet: " + ss_().getUrl()); }
