// ===== QUEST WEEK UA PLATFORM =====
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const AVATARS = ["🦸", "🧙", "🥷", "🧝", "🦊", "🐉", "🦄", "🤖", "🦁", "🐺", "🦅", "🐢"];
const GUILDS = ["🐉 Dragons", "🦅 Eagles", "🐺 Wolves", "🦁 Lions", "🦈 Sharks", "🦉 Owls"];
const TITLES = ["Decimal Duelist", "Theme Hunter", "Evidence Expert", "Word Wizard", "Rounding Rider", "Quest Scholar", "Boss Slayer", "Plan Master"];
const SCORE_LABEL = { 4: "4 • Mastery", 3: "3 • Proficient", 2: "2 • Developing", 1: "1 • Beginning" };
const CHIPS = ["⭐ Great evidence!", "📌 Remember to cite the source.", "🧩 Add a detail to explain.", "🔤 Check capitals & punctuation.", "🎯 Strong thesis!", "🔁 Reread and try the halfway point.", "💪 Great effort — keep going!", "🗣️ Use a transition word."];
const SUBJ_ORDER = ["ela", "write", "math"];
const SUBJ_COL = { ela: ["var(--ela)", "var(--ela2)"], write: ["var(--write)", "var(--write2)"], math: ["var(--math)", "var(--math2)"] };

// ---------- storage helpers ----------
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

// ---------- API: Google Apps Script JSON API (live) or local preview ----------
const CFG = window.QUEST_CONFIG || {};
const LIVE = !!(CFG.API_URL && /^https:\/\/script\.google\.com\//.test(CFG.API_URL));
let SESSION = lsGet("questUA_session", null); // {role:"student", classCode, name, pin} or {role:"teacher", password}
async function post(action, data = {}) {
  const body = JSON.stringify({ action, auth: SESSION, ...data });
  let res;
  try { res = await fetch(CFG.API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, redirect: "follow" }); }
  catch (e) { throw new Error("Can't reach the quest server. Check your Wi-Fi."); }
  let j; try { j = await res.json(); } catch (e) { throw new Error("The quest server sent an unexpected reply. Ask your teacher to check the Apps Script deployment."); }
  if (!j.ok) { const er = new Error(j.error || "Something went wrong."); er.code = j.code; throw er; }
  return j.data;
}
const LocalDB = {
  load() { return lsGet("questUA_db", null) || this.seed(); },
  save(db) { lsSet("questUA_db", db); },
  seed() {
    const now = Date.now(), db = { profiles: {}, work: {}, settings: { tt: { ...DEFAULT_TT } } };
    const samples = [["sample.ana@demo", "Ana (sample)", "🦊", GUILDS[0]], ["sample.jayden@demo", "Jayden (sample)", "🤖", GUILDS[1]], ["sample.mia@demo", "Mia (sample)", "🦄", GUILDS[2]], ["sample.luis@demo", "Luis (sample)", "🐺", GUILDS[3]]];
    samples.forEach(([email, name, av, g], i) => {
      db.profiles[email] = { email, name, avatar: av, guild: g, route: "ABC"[i % 3] };
      const mid = ["1-math", "1-write", "1-ela", "1-math"][i];
      const m = MISSIONS[mid], total = m.warm.length + m.quest.length + m.bossQ.length;
      const done = [total, total, Math.floor(total / 2), total - 3][i];
      const resp = [];
      const items = [...m.warm, ...m.quest, ...m.bossQ];
      for (let k = 0; k < done; k++) {
        const it = items[k], ok = it.t === "write" ? null : (k + i) % 4 !== 0;
        resp.push({ k, ph: k < m.warm.length ? "warm" : k < m.warm.length + m.quest.length ? "quest" : "boss", t: it.t, q: qText(it), ans: it.t === "write" ? "According to Source 1, many families could not find work in Europe, so they came to North America to start over. This shows money problems pushed people to move." : (ok ? "(correct answer)" : "(sample wrong answer)"), ok, tries: ok ? 1 : 2, pts: ok ? 10 : 0 });
      }
      const correct = resp.filter((r) => r.ok).length, scored = resp.filter((r) => r.ok !== null).length;
      const id = email + "|" + mid + "|1";
      db.work[id] = { id, email, name, guild: g, avatar: av, missionId: mid, day: +mid[0], subject: mid.split("-")[1], status: done === total ? "submitted" : "in progress", started: now - 600000, updated: now - (i === 2 ? 30000 : 400000), itemsDone: done, itemsTotal: total, correct, scored, autoPct: scored ? Math.round(100 * correct / scored) : 0, xp: correct * 10 + 20, responses: resp, review: i === 0 ? { score: 3, feedback: "Great comparing! Remember to check the ONES place first.", items: {}, ts: now - 100000 } : null, seen: false, sample: true };
    });
    this.save(db); return db;
  },
};
let previewUser = lsGet("questUA_me", "demo.student@school.org");
const api = {
  async boot() {
    if (LIVE) return post("boot");
    const db = LocalDB.load();
    return { email: previewUser, isTeacher: false, profile: db.profiles[previewUser] || null, settings: db.settings, preview: true };
  },
  async saveProfile(p) { if (LIVE) return post("saveProfile", { profile: p }); const db = LocalDB.load(); db.profiles[previewUser] = { ...p, email: previewUser }; LocalDB.save(db); return db.profiles[previewUser]; },
  async saveWork(r) {
    if (LIVE) return post("saveWork", { record: r });
    const db = LocalDB.load(); const old = db.work[r.id] || {}; db.work[r.id] = { ...old, ...r, review: old.review || null, seen: old.seen || false }; LocalDB.save(db); return true;
  },
  async myWork() { if (LIVE) return post("myWork"); const db = LocalDB.load(); return Object.values(db.work).filter((w) => w.email === previewUser); },
  async markSeen(id) { if (LIVE) return post("markSeen", { id }); const db = LocalDB.load(); if (db.work[id]) db.work[id].seen = true; LocalDB.save(db); },
  async leaderboard() {
    if (LIVE) return post("leaderboard");
    const db = LocalDB.load(), t = {}; GUILDS.forEach((g) => (t[g] = 0)); Object.values(db.work).forEach((w) => (t[w.guild] = (t[w.guild] || 0) + (w.xp || 0))); return t;
  },
  async teacherAll() { if (LIVE) return post("teacherAll"); const db = LocalDB.load(); return { work: Object.values(db.work), profiles: db.profiles, settings: db.settings }; },
  async saveReview(id, review) { if (LIVE) return post("saveReview", { id, review }); const db = LocalDB.load(); if (db.work[id]) { db.work[id].review = { ...review, ts: Date.now() }; db.work[id].seen = false; } LocalDB.save(db); },
  async saveSettings(s) { if (LIVE) return post("saveSettings", { settings: s }); const db = LocalDB.load(); db.settings = s; LocalDB.save(db); },
  async sheetUrl() { if (LIVE) return post("sheetUrl"); return null; },
  async resetPin(key) { if (LIVE) return post("resetPin", { key }); return true; },
};

// ---------- sign-in (live mode only) ----------
function signIn(msg) {
  $("#app").innerHTML = `<header class="topbar"><div class="brand"><div class="logo" aria-hidden="true">🗺️</div><div><small>${esc(CFG.CLASS_NAME || "Universal Access")}</small><h1>Quest Week Rotations</h1></div></div></header>
  <section class="card" style="max-width:560px;margin:20px auto">
    <div class="row" role="tablist" style="margin-bottom:12px"><button class="tab" role="tab" id="tabS" aria-selected="true" style="color:var(--night)">🦸 Student</button><button class="tab" role="tab" id="tabT" aria-selected="false" style="background:var(--line);color:var(--ink)">🧭 Teacher</button></div>
    <div id="sForm">
      <h2 style="font-size:28px">Sign in to your quest</h2>
      <p class="muted" style="margin-top:4px">First time? Make up a 4-digit secret code and remember it. Your teacher can reset it.</p>
      <div class="grid" style="gap:10px">
        <label>Class code<input id="inCode" autocomplete="off" autocapitalize="characters" value="${esc((SESSION && SESSION.classCode) || "")}"></label>
        <label>First name + last initial<input id="inName" autocomplete="off" placeholder="Maria G" value="${esc((SESSION && SESSION.name) || "")}"></label>
        <label>4-digit secret code<input id="inPin" inputmode="numeric" maxlength="4" autocomplete="off" type="password"></label>
      </div>
      <button class="btn" id="goS" style="margin-top:14px">Start my quest ➜</button>
    </div>
    <div id="tForm" class="hidden">
      <h2 style="font-size:28px">Teacher sign in</h2>
      <label style="margin-top:10px;display:block">Teacher password<input id="inPw" type="password" autocomplete="current-password"></label>
      <button class="btn" id="goT" style="margin-top:14px">Open dashboard ➜</button>
    </div>
    <p id="siErr" class="feedback no ${msg ? "" : "hidden"}">${esc(msg || "")}</p>
  </section>`;
  const tabs = (t) => { $("#sForm").classList.toggle("hidden", t !== "s"); $("#tForm").classList.toggle("hidden", t !== "t"); $("#tabS").setAttribute("aria-selected", t === "s"); $("#tabT").setAttribute("aria-selected", t === "t"); $("#tabS").style.cssText = t === "s" ? "color:var(--night)" : "background:var(--line);color:var(--ink)"; $("#tabT").style.cssText = t === "t" ? "color:var(--night)" : "background:var(--line);color:var(--ink)"; };
  $("#tabS").onclick = () => tabs("s"); $("#tabT").onclick = () => tabs("t");
  const err = (m) => { const e = $("#siErr"); e.textContent = m; e.classList.remove("hidden"); };
  $("#goS").onclick = () => {
    const classCode = $("#inCode").value.trim(), name = $("#inName").value.trim().replace(/\s+/g, " "), pin = $("#inPin").value.trim();
    if (!classCode || !name) return err("Type the class code and your first name + last initial.");
    if (!/^\d{4}$/.test(pin)) return err("Your secret code must be exactly 4 numbers.");
    SESSION = { role: "student", classCode, name, pin }; lsSet("questUA_session", SESSION); boot();
  };
  $("#inPin").onkeydown = (e) => { if (e.key === "Enter") $("#goS").click(); };
  $("#goT").onclick = () => { const password = $("#inPw").value; if (!password) return err("Type your teacher password."); SESSION = { role: "teacher", password }; lsSet("questUA_session", SESSION); boot(); };
  $("#inPw").onkeydown = (e) => { if (e.key === "Enter") $("#goT").click(); };
}
function signOut() { const keep = SESSION && SESSION.role === "student" ? { role: "student", classCode: SESSION.classCode, name: "", pin: "" } : null; SESSION = null; lsSet("questUA_session", keep); SESSION = keep; signIn(); SESSION = null; }

// ---------- app state ----------
const S = { me: null, profile: null, settings: { tt: { ...DEFAULT_TT } }, work: [], day: lsGet("questUA_day", 1), view: "hub", teacher: false, preview: false };
function qText(it) { return it.t === "sym" ? `Compare ${it.l} and ${it.r}` : it.q; }
function totalXP() { return S.work.reduce((a, w) => a + (w.xp || 0), 0); }
function level(xp) { return { lvl: Math.floor(xp / 150) + 1, pct: (xp % 150) / 150 * 100 }; }
function workFor(mid) { return S.work.filter((w) => w.missionId === mid).sort((a, b) => b.updated - a.updated)[0]; }
function stars(p) { return p >= 90 ? 3 : p >= 70 ? 2 : 1; }
function ago(t) { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? s + "s ago" : s < 3600 ? Math.round(s / 60) + "m ago" : Math.round(s / 3600) + "h ago"; }

// ---------- sounds + confetti ----------
let AC = null, muted = lsGet("questUA_mute", false);
function beep(type) {
  if (muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { ok: [660, 880], no: [220, 160], boss: [180, 120, 90], win: [523, 659, 784, 1046] }[type] || [440];
    notes.forEach((f, i) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = type === "no" ? "sawtooth" : "triangle"; o.frequency.value = f; g.gain.setValueAtTime(0.12, AC.currentTime + i * 0.09); g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + i * 0.09 + 0.18); o.connect(g).connect(AC.destination); o.start(AC.currentTime + i * 0.09); o.stop(AC.currentTime + i * 0.09 + 0.2); });
  } catch (e) {}
}
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = $("#confetti"), x = c.getContext("2d"); c.width = innerWidth; c.height = innerHeight;
  const cols = ["#FFB703", "#7B2CBF", "#00A6A6", "#FF6B35", "#4CC9F0", "#EF476F"];
  const ps = Array.from({ length: 140 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.5, v: 2 + Math.random() * 4, r: 4 + Math.random() * 6, c: cols[Math.floor(Math.random() * 6)], s: Math.random() * 6 }));
  let f = 0; (function tick() { x.clearRect(0, 0, c.width, c.height); ps.forEach((p) => { p.y += p.v; p.x += Math.sin((f + p.s) / 10) * 2; x.fillStyle = p.c; x.fillRect(p.x, p.y, p.r, p.r * 0.6); }); if (++f < 160) requestAnimationFrame(tick); else x.clearRect(0, 0, c.width, c.height); })();
}
function speak(t) { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.rate = 0.92; speechSynthesis.speak(u); } catch (e) {} }

// ---------- boot ----------
async function boot() {
  if (LIVE && (!SESSION || (SESSION.role === "student" && !SESSION.pin) )) return signIn();
  $("#app").innerHTML = `<div class="card" style="max-width:420px;margin:60px auto;text-align:center"><div style="font-size:48px">🗺️</div><h2>Loading your quest…</h2></div>`;
  try {
    const b = await api.boot();
    S.me = b.email; S.profile = b.profile; S.settings = b.settings || S.settings; S.teacher = !!b.isTeacher; S.preview = !!b.preview;
    if (!S.settings.tt) S.settings.tt = { ...DEFAULT_TT };
    S.work = S.teacher ? [] : await api.myWork();
  } catch (e) {
    if (LIVE && (e.code === "auth" || e.code === "pin")) { const keep = { ...SESSION, pin: "", password: "" }; SESSION = null; lsSet("questUA_session", keep); SESSION = keep; signIn(e.message); SESSION = null; return; }
    $("#app").innerHTML = `<div class="card" style="max-width:520px;margin:60px auto"><h2>We couldn't load your quest.</h2><p>${esc(e && e.message)}</p><p class="muted">Check your internet connection and refresh. If it keeps happening, tell your teacher.</p>${LIVE ? `<button class="btn" id="so">Sign in again</button>` : ""}</div>`;
    const so = $("#so"); if (so) so.onclick = signOut;
    return;
  }
  if (S.teacher) return teacherHome();
  if (!S.profile) return welcome();
  hub();
}

// ---------- shared top bar ----------
function topbar(extra = "") {
  const xp = totalXP(), L = level(xp), p = S.profile || {};
  const unread = S.work.filter((w) => w.review && !w.seen).length;
  return `<header class="topbar">
    <div class="brand"><div class="logo" aria-hidden="true">🗺️</div><div><small>Universal Access • Week 4</small><h1>Quest Week Rotations</h1></div></div>
    <div class="row">${extra}
      ${S.profile ? `<button class="btn ghost sm" id="inboxBtn">📬 Feedback ${unread ? `<span class="pill" style="background:var(--bad);color:#fff">${unread} new</span>` : ""}</button>
      <div class="hero"><div class="avatar" aria-hidden="true">${p.avatar || "🦸"}</div><div><div class="fh">${esc(p.hero || p.name)} <span style="color:var(--gold)">Lv ${L.lvl}</span></div>
      <div class="row" style="gap:8px"><div class="xpbar" aria-label="Level progress"><i style="width:${L.pct}%"></i></div><span class="fh" style="font-size:13px">${xp} XP</span></div>
      <div style="font-size:12px;opacity:.8">${esc(p.guild || "")} • Route ${esc(p.route || "B")}</div></div></div>` : ""}
      <button class="btn ghost sm" id="muteBtn" aria-label="Sound on or off">${muted ? "🔇" : "🔊"}</button>${LIVE ? `<button class="btn ghost sm" id="signOut">Sign out</button>` : ""}
    </div></header>
    ${S.preview ? `<div class="card" style="background:var(--gold2);padding:10px 14px;margin-bottom:12px;font-size:14px">👀 <b>Preview mode.</b> Work is saved only in this browser. To save work live to your teacher dashboard, connect the Google Apps Script API in js/config.js (see README). <button class="btn dark sm" id="toTeacher" style="margin-left:6px">Open Teacher Dashboard (preview)</button></div>` : ""}`;
}
function wireTop() {
  const m = $("#muteBtn"); if (m) m.onclick = () => { muted = !muted; lsSet("questUA_mute", muted); m.textContent = muted ? "🔇" : "🔊"; };
  const ib = $("#inboxBtn"); if (ib) ib.onclick = inbox;
  const tt = $("#toTeacher"); if (tt) tt.onclick = () => { S.teacher = true; teacherHome(); };
  const so = $("#signOut"); if (so) so.onclick = signOut;
}

// ---------- welcome / profile ----------
function welcome() {
  const p = S.profile || { avatar: "🦸", guild: GUILDS[0], route: "B" };
  $("#app").innerHTML = `${topbar()}
  <section class="card" style="max-width:760px;margin:20px auto">
    <h2 style="font-size:30px">Create your hero 🦸</h2>
    <p class="muted">Your teacher sees your first name. Your hero name shows on your quest card.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
      <label>First name<input id="fName" value="${esc(p.name || (SESSION && SESSION.name) || "")}" maxlength="30" autocomplete="given-name" ${LIVE ? "readonly" : ""}></label>
      <label>Hero name<input id="fHero" value="${esc(p.hero || "")}" maxlength="24" placeholder="Captain Decimal"></label>
    </div>
    <h3 style="margin-top:14px">Pick your avatar</h3>
    <div class="row" id="avs">${AVATARS.map((a) => `<button class="avatar" style="width:54px;height:54px;font-size:30px;border:3px solid ${a === p.avatar ? "var(--gold)" : "transparent"}" data-a="${a}" aria-label="Avatar ${a}">${a}</button>`).join("")}</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:14px">
      <label>My guild<select id="fGuild">${GUILDS.map((g) => `<option ${g === p.guild ? "selected" : ""}>${g}</option>`).join("")}</select></label>
      <label>My route (your teacher tells you)<select id="fRoute">${[["A", "🧭 Route A: Guide Squad"], ["B", "🥾 Route B: Trail Team"], ["C", "🏔️ Route C: Solo Climber"]].map(([v, t]) => `<option value="${v}" ${v === p.route ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    </div>
    <p id="fErr" class="feedback no hidden"></p>
    <div class="row" style="margin-top:16px"><button class="btn" id="fGo">Start my quest ➜</button></div>
  </section>`;
  wireTop();
  let av = p.avatar;
  $("#avs").onclick = (e) => { const b = e.target.closest("[data-a]"); if (!b) return; av = b.dataset.a; [...$("#avs").children].forEach((c) => (c.style.borderColor = c === b ? "var(--gold)" : "transparent")); };
  $("#fGo").onclick = async () => {
    const name = $("#fName").value.trim();
    if (!name) { const er = $("#fErr"); er.textContent = "Type your first name so your teacher knows it's you."; er.classList.remove("hidden"); return; }
    $("#fGo").disabled = true;
    S.profile = await api.saveProfile({ name, hero: $("#fHero").value.trim() || name, avatar: av, guild: $("#fGuild").value, route: $("#fRoute").value });
    hub();
  };
}

// ---------- hub ----------
let hubTimer = null;
async function hub() {
  clearInterval(hubTimer);
  S.view = "hub";
  const d = S.day, tt = S.settings.tt[d];
  const order = [tt, ...SUBJ_ORDER.filter((s) => s !== tt)];
  $("#app").innerHTML = `${topbar()}
  <nav class="daytabs" aria-label="Choose a day">${[1, 2, 3, 4, 5].map((n) => `<button class="tab" role="tab" aria-selected="${n === d}" data-day="${n}">Day ${n}</button>`).join("")}
    <button class="tab" id="editProf" style="margin-left:auto">✏️ My hero</button></nav>
  <h2 style="font-size:26px;margin-bottom:4px">Day ${d} Rotations</h2>
  <p style="margin:0 0 12px;opacity:.85">3 stations × 15 minutes. Follow the rotation board on the big screen. Finish each mission's Boss Battle before the timer ends!</p>
  <div class="stations">${order.map((sub) => stationCard(d, sub, sub === tt)).join("")}</div>
  <div class="side">
    <section class="card"><h3>🏅 My badges</h3><div class="row" style="margin-top:8px">${badgeShelf()}</div></section>
    <section class="card"><h3>🏆 Guild leaderboard</h3><div class="list" id="lb" style="margin-top:8px"><span class="muted">Loading…</span></div></section>
  </div>`;
  wireTop();
  $(".daytabs").onclick = (e) => { const b = e.target.closest("[data-day]"); if (!b) return; S.day = +b.dataset.day; lsSet("questUA_day", S.day); hub(); };
  $("#editProf").onclick = welcome;
  document.querySelectorAll("[data-start]").forEach((b) => (b.onclick = () => startMission(b.dataset.start)));
  document.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => openFeedback(b.dataset.open)));
  document.querySelectorAll("[data-tt]").forEach((b) => (b.onclick = () => ttStudent(b.dataset.tt)));
  try { const lb = await api.leaderboard(); $("#lb").innerHTML = Object.entries(lb).sort((a, b) => b[1] - a[1]).map(([g, x], i) => `<div class="lb-row"><span>${["🥇", "🥈", "🥉"][i] || "•"} ${esc(g)}</span><b>${x} XP</b></div>`).join(""); } catch (e) { $("#lb").textContent = "Leaderboard unavailable right now."; }
}
function stationCard(d, sub, isTT) {
  const mid = `${d}-${sub}`, m = MISSIONS[mid], w = workFor(mid), info = SUBJECTS[sub], [col] = SUBJ_COL[sub];
  let status = `<span class="pill" style="background:var(--line);color:var(--ink)">Not started</span>`;
  if (w) status = w.status === "submitted" ? `<span class="stars" aria-label="${stars(w.autoPct)} stars">${"★".repeat(stars(w.autoPct))}${"☆".repeat(3 - stars(w.autoPct))}</span> <span class="pill" style="background:var(--good2);color:#155E35">${w.autoPct}% • +${w.xp} XP</span>` : `<span class="pill" style="background:var(--gold2);color:#6B4A00">In progress ${w.itemsDone}/${w.itemsTotal}</span>`;
  const fb = w && w.review ? `<button class="btn dark sm" data-open="${esc(w.id)}">📬 Teacher feedback ${w.seen ? "" : "• NEW"}</button>` : "";
  const g = TT[mid];
  return `<article class="station">
    <div class="band" style="background:${col}"><div><div class="rot">${info.icon} ${info.name} • ${info.label}</div><h3 style="color:#fff;margin-top:4px">${isTT ? "Teacher Table" : esc(m.title)}</h3></div><div class="big" aria-hidden="true">${isTT ? "🧭" : m.boss[1]}</div></div>
    <div class="body">
      ${isTT ? `<span class="pill tt-flag">🧭 With your teacher today</span><div><b>Focus:</b> ${esc(g.focus)}</div><div style="font-size:14px"><b>Bring:</b> ${esc(g.mats)}</div>
        <div class="row" style="margin-top:auto"><button class="btn sm" data-tt="${mid}">See the plan</button><button class="btn ghost sm" style="color:var(--ink);border-color:var(--line)" data-start="${mid}">Digital practice</button></div>`
      : `<div style="font-size:14px" class="muted">${esc(m.skill)}</div><div>⚔️ Boss: <b>${esc(m.boss[0])}</b> ${m.boss[1]}</div><div>${status}</div>
        <div class="row" style="margin-top:auto"><button class="btn" data-start="${mid}">${w ? (w.status === "submitted" ? "Replay for XP" : "Restart mission") : "Start mission ⏱️ 15:00"}</button>${fb}</div>`}
    </div></article>`;
}
function badgeShelf() {
  const done = S.work.filter((w) => w.status === "submitted");
  const b = [];
  if (done.length) b.push(["⚔️", "First Boss"]);
  if (done.some((w) => w.autoPct >= 90)) b.push(["🌟", "Perfect Run"]);
  if (done.filter((w) => w.subject === "math").length >= 2) b.push(["🐊", "Decimal Duelist"]);
  if (done.filter((w) => w.subject === "ela").length >= 2) b.push(["💡", "Theme Hunter"]);
  if (done.filter((w) => w.subject === "write").length >= 2) b.push(["🔎", "Evidence Expert"]);
  if (done.length >= 5) b.push(["🐉", "Boss Slayer"]);
  if (S.work.some((w) => w.legend)) b.push(["🚀", "Side Quester"]);
  if (!b.length) return `<span class="muted">Beat your first Boss Battle to earn a badge!</span>`;
  return b.map(([e, n]) => `<span class="pill" style="background:var(--night);color:var(--cream);font-size:14px;padding:6px 12px">${e} ${n}</span>`).join("");
}
function ttStudent(mid) {
  const g = TT[mid], m = MISSIONS[mid];
  $("#app").innerHTML = `${topbar()}<section class="card" style="max-width:760px;margin:10px auto">
  <span class="pill tt-flag">🧭 Teacher Table • Day ${mid[0]} • ${SUBJECTS[mid.split("-")[1]].name}</span>
  <h2 style="font-size:28px;margin-top:8px">${esc(g.focus)}</h2>
  <p><b>Bring:</b> ${esc(g.mats)}</p>
  <h3>Today at the table</h3><ol>${g.plan.map((s) => `<li style="margin:6px 0">${esc(s.replace(/^\d+ min — /, ""))}</li>`).join("")}</ol>
  <p class="muted">Waiting for your turn? Your teacher may ask you to play the digital mission "${esc(m.title)}".</p>
  <div class="row"><button class="btn" id="back">⬅ Back to stations</button></div></section>`;
  wireTop(); $("#back").onclick = hub;
}

// ---------- mission engine ----------
let M = null, mTimer = null;
function startMission(mid) {
  const m = MISSIONS[mid];
  const items = [...m.warm.map((x) => ({ ...x, ph: "warm" })), ...m.quest.map((x) => ({ ...x, ph: "quest" })), ...m.bossQ.map((x) => ({ ...x, ph: "boss" }))];
  const prev = S.work.filter((w) => w.missionId === mid);
  const attempt = prev.length + 1;
  const route = (S.profile && S.profile.route) || "B";
  M = { mid, m, items, i: 0, resp: [], combo: 0, xp: 0, bossHP: m.bossQ.length, powers: { A: 6, B: 4, C: 3 }[route], end: Date.now() + 15 * 60000, id: `${S.me}|${mid}|${attempt}`, started: Date.now(), state: null };
  clearInterval(mTimer);
  mTimer = setInterval(tickTimer, 1000);
  renderItem();
  save("in progress");
}
function tickTimer() {
  if (!M) return clearInterval(mTimer);
  const left = Math.max(0, M.end - Date.now()), el = $("#timer");
  if (el) { const mm = Math.floor(left / 60000), ss = Math.floor(left / 1000) % 60; el.textContent = `⏱️ ${mm}:${String(ss).padStart(2, "0")}`; el.classList.toggle("low", left < 120000); }
  if (left <= 0) { clearInterval(mTimer); timeUp(); }
}
function timeUp() {
  beep("boss");
  const ov = document.createElement("div"); ov.className = "overlay";
  ov.innerHTML = `<div class="card"><div style="font-size:64px">⏰</div><h2 style="font-size:32px">ROTATE!</h2><p>Time's up for this station. Your work is saved and sent to your teacher.</p><button class="btn" id="tuGo">See my results</button></div>`;
  document.body.appendChild(ov); $("#tuGo").onclick = () => { ov.remove(); finish(true); };
}
function counts() {
  const scored = M.resp.filter((r) => r.ok !== null), correct = scored.filter((r) => r.ok).length;
  return { scored: scored.length, correct, pct: scored.length ? Math.round(100 * correct / scored.length) : 0 };
}
function record(status) {
  const c = counts(), p = S.profile || {};
  return { id: M.id, email: S.me, name: p.name, guild: p.guild, avatar: p.avatar, missionId: M.mid, day: +M.mid[0], subject: M.mid.split("-")[1], status, started: M.started, updated: Date.now(), itemsDone: M.resp.filter((r) => r.ph !== "legend").length, itemsTotal: M.items.filter((x) => x.ph !== "legend").length, correct: c.correct, scored: c.scored, autoPct: c.pct, xp: M.xp, responses: M.resp, legend: M.resp.some((r) => r.ph === "legend"), current: M.items[M.i] ? M.items[M.i].ph : "done" };
}
let saveQ = Promise.resolve();
function save(status) {
  const r = record(status);
  const local = S.work.findIndex((w) => w.id === r.id);
  if (local >= 0) S.work[local] = { ...S.work[local], ...r }; else S.work.push(r);
  saveQ = saveQ.then(() => api.saveWork(r)).catch(() => showToast("⚠️ Couldn't save — check Wi-Fi. We'll try again on your next answer."));
}
function showToast(t) { const d = document.createElement("div"); d.className = "combo"; d.style.background = "var(--night2)"; d.style.fontSize = "16px"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }

function renderItem() {
  const it = M.items[M.i], m = M.m, sub = M.mid.split("-")[1], [col] = SUBJ_COL[sub];
  M.state = { tries: 0, sel: it.t === "multi" ? new Set() : it.t === "tap" ? new Set() : it.t === "order" ? [] : it.t === "sort" ? {} : null, done: false, hidden: new Set() };
  const phaseLab = { warm: ["🔥 Warm-Up", "var(--write)"], quest: ["🗺️ Quest", col], boss: ["⚔️ Boss Battle", "var(--bad)"], legend: ["🚀 Side Quest", "var(--ela)"] }[it.ph];
  const dots = M.items.map((x, k) => { const r = M.resp.find((z) => z.k === k); return `<span class="${x.ph === "boss" ? "boss " : ""}${k === M.i ? "now" : r ? (r.ok === false ? "no" : "ok") : ""}"></span>`; }).join("");
  $("#app").innerHTML = `
  <div class="mbar"><button class="btn ghost sm" id="quit">⬅ Stations</button><div class="dots" aria-label="Progress">${dots}</div><div class="row"><span class="pill" style="background:var(--gold);color:var(--night)">⭐ ${M.xp} XP</span><span class="timer" id="timer">⏱️ 15:00</span></div></div>
  ${it.ph === "boss" ? `<div class="bossbox" id="bossbox"><div class="face" id="bossface">${m.boss[1]}</div><div style="flex:1"><div class="fh">${esc(m.boss[0])}</div><div class="hp"><i style="width:${100 * M.bossHP / m.bossQ.length}%"></i></div></div></div>` : ""}
  <section class="qcard" id="qcard">
    <div class="row" style="justify-content:space-between"><span class="phase" style="background:${phaseLab[1]}">${phaseLab[0]}</span>
      <div class="power"><button id="pRead" aria-label="Read aloud">🔊 Read to me</button><button id="pHint" ${it.t === "write" ? "disabled" : ""}>💡 Hint (${M.powers})</button>${it.t === "mc" ? `<button id="p50">✂️ 50/50 (${M.powers})</button>` : ""}</div></div>
    ${it.p ? `<div class="passage">${esc(it.p)}</div>` : ""}
    <div class="q">${esc(qText(it))}</div>
    ${it.viz ? viz(it.viz) : ""}
    <div id="body">${bodyFor(it)}</div>
    <div id="fb"></div>
    <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn" id="next" disabled>Next ➜</button></div>
  </section>`;
  tickTimer();
  $("#quit").onclick = () => { if (confirmQuit()) { clearInterval(mTimer); save("in progress"); M = null; hub(); } };
  $("#pRead").onclick = () => speak((it.p ? it.p + ". " : "") + qText(it) + (it.opts ? ". Choices: " + it.opts.join(". ") : ""));
  const ph = $("#pHint"); if (ph) ph.onclick = () => { if (M.powers <= 0) return fb("info", "No power-ups left. Try your best — you've got this!"); M.powers--; ph.textContent = `💡 Hint (${M.powers})`; fb("info", "💡 " + (it.hint || hintFor(it))); };
  const p5 = $("#p50"); if (p5) p5.onclick = () => { if (M.powers <= 0 || M.state.hidden.size) return; M.powers--; p5.disabled = true; const wrong = it.opts.map((_, k) => k).filter((k) => k !== it.a).sort(() => Math.random() - 0.5).slice(0, Math.min(2, it.opts.length - 2)); wrong.forEach((k) => { M.state.hidden.add(k); const b = document.querySelector(`[data-o="${k}"]`); if (b) b.classList.add("gone"); }); };
  $("#next").onclick = nextItem;
  wireItem(it);
}
let quitArmed = false;
function confirmQuit() { if (quitArmed) { quitArmed = false; return true; } quitArmed = true; showToast("Tap ⬅ Stations again to leave. Your work is saved."); setTimeout(() => (quitArmed = false), 3000); return false; }
function hintFor(it) {
  if (it.t === "sym") return "Line up the decimal points. Add zeros so they're the same length, then compare from the LEFT.";
  if (it.t === "num") return "Find the place you're rounding to, then look at the digit to its right: 0–4 stays, 5–9 rounds up.";
  if (it.t === "sort") return "Read each one slowly. Ask: which group does it belong to?";
  if (it.t === "order") return "Which one has to happen FIRST?";
  return "Reread the question and look for clue words.";
}
function viz(v) {
  if (v.grid != null) {
    let cells = ""; for (let k = 0; k < 100; k++) { const col = Math.floor(k / 10), row = k % 10; const on = col * 10 + row < v.grid; cells += `<rect x="${col * 14}" y="${row * 14}" width="14" height="14" fill="${on ? "#00A6A6" : "#FFFFFF"}" stroke="#9CA3AF" stroke-width=".6"/>`; }
    return `<div class="row" style="margin-bottom:10px"><svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label="Decimal grid with ${v.grid} hundredths shaded">${cells}</svg><span class="muted">${v.grid} hundredths shaded = 0.${String(v.grid).padStart(2, "0")}</span></div>`;
  }
  if (v.nl) {
    const [a, b, n, pt, lab] = v.nl, W = 600, x0 = 30, x1 = 570, X = (val) => x0 + (x1 - x0) * (val - a) / (b - a);
    let t = ""; for (let k = 0; k <= n; k++) { const val = a + (b - a) * k / n, x = X(val), big = k === 0 || k === n || k === n / 2; t += `<line x1="${x}" y1="${big ? 38 : 44}" x2="${x}" y2="${big ? 70 : 64}" stroke="#1F2933" stroke-width="${big ? 3 : 2}"/>`; if (big) t += `<text x="${x}" y="92" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="18" fill="#1F2933">${+val.toFixed(3)}</text>`; }
    const px = X(pt);
    return `<div style="overflow-x:auto"><svg viewBox="0 0 ${W} 110" width="100%" style="max-width:640px" role="img" aria-label="Number line from ${a} to ${b} with ${lab} marked">
      <line x1="${x0}" y1="54" x2="${x1}" y2="54" stroke="#1F2933" stroke-width="4"/>${t}
      <line x1="${X((a + b) / 2)}" y1="22" x2="${X((a + b) / 2)}" y2="54" stroke="#FF6B35" stroke-width="3" stroke-dasharray="4 3"/><text x="${X((a + b) / 2)}" y="16" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="14" fill="#FF6B35">halfway</text>
      <circle cx="${px}" cy="54" r="9" fill="#7B2CBF"/><text x="${px}" y="${Math.abs(px - X((a + b) / 2)) < 50 ? 108 : 32}" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="16" font-weight="700" fill="#7B2CBF">${esc(lab)}</text></svg></div>`;
  }
  return "";
}
function shuffled(arr) { const a = arr.map((v, k) => [v, k]); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } if (a.length > 1 && a.every((x, k) => x[1] === k)) a.push(a.shift()); return a; }
function bodyFor(it) {
  switch (it.t) {
    case "mc": return `<div class="opts">${it.opts.map((o, k) => `<button class="opt" data-o="${k}">${"ABCDEF"[k]}. ${esc(o)}</button>`).join("")}</div>`;
    case "multi": return `<p class="muted" style="margin-top:0">Choose ALL that are correct, then press Check.</p><div class="opts">${it.opts.map((o, k) => `<button class="opt" data-o="${k}" aria-pressed="false">☐ ${esc(o)}</button>`).join("")}</div><div class="row" style="margin-top:10px"><button class="btn dark" id="check">Check ✔</button></div>`;
    case "sym": return `<div class="sym"><span class="n">${esc(it.l)}</span><span class="slot" id="slot">?</span><span class="n">${esc(it.r)}</span></div><div class="symbtns">${[">", "<", "="].map((s) => `<button data-s="${s}" aria-label="${s === ">" ? "greater than" : s === "<" ? "less than" : "equal to"}">${s}</button>`).join("")}</div>`;
    case "num": return `<div class="numin"><input id="numIn" inputmode="decimal" autocomplete="off" aria-label="Your answer" placeholder="?"><button class="btn dark" id="check">Check ✔</button></div>`;
    case "sort": return `<div class="grid" style="gap:8px">${it.items.map(([t], k) => `<div class="sortrow" id="sr${k}"><span class="t">${esc(t)}</span><div class="seg" data-row="${k}">${it.bins.map((b, j) => `<button data-b="${j}">${esc(b)}</button>`).join("")}</div></div>`).join("")}</div><div class="row" style="margin-top:10px"><button class="btn dark" id="check">Check ✔</button></div>`;
    case "tap": return `<p class="muted" style="margin-top:0">Tap the word(s), then press Check.</p><div class="words">${it.s.split(" ").map((w, k) => `<button class="word" data-w="${k}">${esc(w)}</button>`).join("")}</div><div class="row" style="margin-top:10px"><button class="btn dark" id="check">Check ✔</button></div>`;
    case "order": return `<p class="muted" style="margin-top:0">Tap the pieces in the right order. Tap a placed piece to send it back.</p><div class="built" id="built" aria-label="Your order"></div><div class="tiles" id="pool" style="margin-top:10px">${shuffled(it.tiles).map(([t, k]) => `<button class="tile" data-t="${k}">${esc(t)}</button>`).join("")}</div><div class="row" style="margin-top:10px"><button class="btn dark" id="check" disabled>Check ✔</button></div>`;
    case "write": return `<div class="row" style="margin-bottom:8px"><button class="btn ghost sm" id="useFrame" style="color:var(--ink);border-color:var(--line)">🧩 Use the sentence frame</button><span class="muted" style="font-size:14px">Frame: ${esc(it.frame || "")}</span></div><textarea id="wr" rows="6" aria-label="Your writing" placeholder="Type your answer here…"></textarea><div class="checklist" id="cl"></div><div class="row" style="margin-top:10px"><button class="btn dark" id="check" disabled>Submit writing ✍️</button><span class="muted" style="font-size:14px">Your teacher will score this and send feedback.</span></div>`;
  }
  return "";
}
function wireItem(it) {
  const B = $("#body"), st = M.state;
  if (it.t === "mc") B.onclick = (e) => { const b = e.target.closest("[data-o]"); if (!b || st.done) return; judge(+b.dataset.o === it.a, it.opts[+b.dataset.o], () => { b.classList.add(+b.dataset.o === it.a ? "ok" : "no"); }); };
  if (it.t === "multi") { B.onclick = (e) => { const b = e.target.closest("[data-o]"); if (!b || st.done) return; const k = +b.dataset.o; st.sel.has(k) ? st.sel.delete(k) : st.sel.add(k); b.classList.toggle("sel"); b.setAttribute("aria-pressed", st.sel.has(k)); b.textContent = (st.sel.has(k) ? "☑ " : "☐ ") + it.opts[k]; }; $("#check").onclick = () => { if (st.done) return; const ok = st.sel.size === it.a.length && it.a.every((k) => st.sel.has(k)); judge(ok, [...st.sel].map((k) => it.opts[k]).join("; ") || "(none)", () => { document.querySelectorAll("[data-o]").forEach((b) => { const k = +b.dataset.o; if (it.a.includes(k) && (ok || st.tries >= 2)) b.classList.add("ok"); else if (st.sel.has(k) && !it.a.includes(k)) b.classList.add("no"); }); }); }; }
  if (it.t === "sym") { const ans = Number(it.l) > Number(it.r) ? ">" : Number(it.l) < Number(it.r) ? "<" : "="; B.onclick = (e) => { const b = e.target.closest("[data-s]"); if (!b || st.done) return; $("#slot").textContent = b.dataset.s; judge(b.dataset.s === ans, `${it.l} ${b.dataset.s} ${it.r}`, null, `${it.l} ${ans} ${it.r}. Line up the decimals and compare from the left.`); }; }
  if (it.t === "num") { const go = () => { if (st.done) return; const v = $("#numIn").value.trim(); if (!v) return; const n = parseFloat(v.replace(/[^\d.\-]/g, "")); let ok; if (isNaN(n)) ok = false; else if (it.range) ok = it.incl ? (n >= it.range[0] - 1e-9 && n <= it.range[1] + 1e-9) : (n > it.range[0] + 1e-9 && n < it.range[1] - 1e-9); else ok = [it.a, ...(it.accept || [])].some((a) => Math.abs(parseFloat(a) - n) < 1e-9); judge(ok, v, null, it.a ? `The answer is ${it.a}.` : ""); }; $("#check").onclick = go; $("#numIn").onkeydown = (e) => { if (e.key === "Enter") go(); }; setTimeout(() => { const n = $("#numIn"); if (n) n.focus(); }, 50); }
  if (it.t === "sort") { B.onclick = (e) => { const b = e.target.closest("[data-b]"); if (!b || st.done) return; const row = +b.parentElement.dataset.row; st.sel[row] = +b.dataset.b; [...b.parentElement.children].forEach((c) => c.classList.toggle("sel", c === b)); }; $("#check").onclick = () => { if (st.done) return; if (Object.keys(st.sel).length < it.items.length) return fb("info", "Sort every row first!"); let allOk = true; it.items.forEach(([, bin], k) => { const ok = st.sel[k] === bin; if (!ok) allOk = false; $("#sr" + k).classList.remove("ok", "no"); $("#sr" + k).classList.add(ok ? "ok" : "no"); }); judge(allOk, it.items.map(([t], k) => `${t} → ${it.bins[st.sel[k]]}`).join("; "), null, "Green rows are right. Fix the red ones!"); }; }
  if (it.t === "tap") { B.onclick = (e) => { const b = e.target.closest("[data-w]"); if (!b || st.done) return; const k = +b.dataset.w; st.sel.has(k) ? st.sel.delete(k) : st.sel.add(k); b.classList.toggle("sel"); }; $("#check").onclick = () => { if (st.done) return; const sets = [it.a, ...(it.alt || [])]; const ok = sets.some((a) => a.length === st.sel.size && a.every((k) => st.sel.has(k))); const words = it.s.split(" "); judge(ok, [...st.sel].sort((a, b) => a - b).map((k) => words[k]).join(", ") || "(none)", () => { if (ok || st.tries >= 2) it.a.forEach((k) => document.querySelector(`[data-w="${k}"]`).classList.add("ok")); }); }; }
  if (it.t === "order") { const pool = $("#pool"), built = $("#built"); B.onclick = (e) => { const b = e.target.closest("[data-t]"); if (!b || st.done) return; if (b.parentElement === pool) { built.appendChild(b); st.sel.push(+b.dataset.t); } else { pool.appendChild(b); st.sel = st.sel.filter((x) => x !== +b.dataset.t); } $("#check").disabled = st.sel.length !== it.tiles.length; }; $("#check").onclick = () => { if (st.done) return; const ok = st.sel.every((v, k) => v === k); judge(ok, st.sel.map((k) => it.tiles[k]).join(" → "), null, "Not quite. Tap pieces to move them back and try a new order."); }; }
  if (it.t === "write") {
    const ta = $("#wr"), cl = $("#cl");
    const upd = () => { const t = ta.value, wc = (t.trim().match(/\S+/g) || []).length; const checks = [[`${wc}/${it.min} words`, wc >= it.min], ...(it.need || []).map(([, re, n, lab]) => { const mm = t.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g")) || []; const uniq = new Set(mm.map((x) => x.toLowerCase())); return [lab, (n > 1 ? uniq.size : mm.length) >= n && (re.source.startsWith("^(?!") ? re.test(t) : true)]; })]; cl.innerHTML = checks.map(([l, ok]) => `<div>${ok ? "✅" : "⬜"} ${esc(l)}</div>`).join(""); $("#check").disabled = wc < it.min; st.checks = checks; };
    ta.oninput = upd; upd();
    $("#useFrame").onclick = () => { if (!ta.value.trim()) ta.value = it.frame || ""; ta.focus(); upd(); };
    $("#check").onclick = () => { if (st.done) return; st.done = true; const met = st.checks.filter((c) => c[1]).length; const pts = 10 + met * 5; M.xp += pts; M.resp.push({ k: M.i, ph: it.ph, t: "write", q: qText(it), ans: ta.value, ok: null, tries: 1, pts, checks: st.checks }); ta.readOnly = true; beep("ok"); fb("ok", `✍️ Submitted! +${pts} XP. Checklist met: ${met}/${st.checks.length}. Your teacher will send feedback.`); if (it.ph === "boss") hitBoss(); afterJudge(); };
  }
}
function judge(ok, ansText, mark, wrongMsg) {
  const it = M.items[M.i], st = M.state; st.tries++;
  if (mark) mark();
  if (ok) {
    st.done = true; M.combo = st.tries === 1 ? M.combo + 1 : 0;
    let pts = it.ph === "boss" ? (st.tries === 1 ? 15 : 8) : it.ph === "legend" ? 25 : (st.tries === 1 ? 10 : 5);
    let msg = `✅ ${["Nice!", "Boom!", "You got it!", "Excellent!", "Legendary!"][Math.floor(Math.random() * 5)]} +${pts} XP`;
    if (M.combo >= 3) { pts += 5; comboPop(M.combo); msg += ` • 🔥 Combo ×${M.combo} +5`; }
    M.xp += pts; beep("ok");
    fb("ok", msg + (it.why ? `<br><span style="font-weight:400">${esc(it.why)}</span>` : ""));
    M.resp.push({ k: M.i, ph: it.ph, t: it.t, q: qText(it), ans: ansText, ok: true, tries: st.tries, pts });
    if (it.ph === "boss") hitBoss();
    afterJudge();
  } else {
    M.combo = 0; beep("no"); const q = $("#qcard"); q.classList.remove("shake"); void q.offsetWidth; q.classList.add("shake");
    if (it.ph === "boss") { const bb = $("#bossbox"); if (bb) { bb.classList.remove("shake"); void bb.offsetWidth; bb.classList.add("shake"); } }
    if (st.tries < 2) { fb("no", `❌ Not yet — try once more! ${it.hint ? "💡 " + esc(it.hint) : ""}`); if (it.t === "mc") document.querySelectorAll(".opt.no").forEach((b) => (b.disabled = true)); }
    else {
      st.done = true; let right = wrongMsg || "";
      if (it.t === "mc") { right = `The answer is: ${it.opts[it.a]}`; document.querySelector(`[data-o="${it.a}"]`).classList.add("ok"); }
      if (it.t === "multi") right = `Correct: ${it.a.map((k) => it.opts[k]).join("; ")}`;
      if (it.t === "order") { right = "Correct order: " + it.tiles.join(" → "); }
      if (it.t === "sort") right = "Correct: " + it.items.map(([t, b]) => `${t} → ${it.bins[b]}`).join(" • ");
      if (it.t === "tap") right = "Correct word(s): " + it.a.map((k) => it.s.split(" ")[k]).join(", ");
      fb("no", `💪 Good try. ${esc(right)}${it.why ? `<br><span style="font-weight:400">${esc(it.why)}</span>` : ""}`);
      M.resp.push({ k: M.i, ph: it.ph, t: it.t, q: qText(it), ans: ansText, ok: false, tries: st.tries, pts: 0 });
      afterJudge();
    }
  }
}
function afterJudge() { $("#next").disabled = false; $("#next").focus(); save("in progress"); }
function fb(kind, html) { $("#fb").innerHTML = `<div class="feedback ${kind}" role="status">${html}</div>`; }
function comboPop(n) { document.querySelectorAll(".combo").forEach((x) => x.remove()); const d = document.createElement("div"); d.className = "combo pop"; d.textContent = `🔥 COMBO ×${n}!`; document.body.appendChild(d); setTimeout(() => d.remove(), 1200); }
function hitBoss() { M.bossHP = Math.max(0, M.bossHP - 1); const f = $("#bossface"); if (f) { f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake"); } const hp = document.querySelector(".hp i"); if (hp) hp.style.width = `${100 * M.bossHP / M.m.bossQ.length}%`; beep("boss"); }
function nextItem() {
  const it = M.items[M.i];
  if (it.ph === "quest" && M.items[M.i + 1] && M.items[M.i + 1].ph === "boss") { M.i++; return bossIntro(); }
  M.i++;
  if (M.i >= M.items.length) return finish(false);
  renderItem();
}
function bossIntro() {
  const m = M.m;
  $("#app").innerHTML = `<section class="card" style="max-width:620px;margin:40px auto;text-align:center;background:var(--night2);color:var(--cream)">
    <div style="font-size:110px" class="pop">${m.boss[1]}</div><h2 style="font-size:34px;color:var(--gold)">BOSS BATTLE!</h2>
    <p style="font-size:20px">${esc(m.boss[0])} blocks your path. Every right answer is a hit. Boss answers are worth <b>15 XP</b>!</p>
    <button class="btn" id="fight">⚔️ Fight!</button></section>`;
  beep("boss"); $("#fight").onclick = renderItem;
}
function finish(timeout) {
  clearInterval(mTimer);
  const c = counts(), st = stars(c.pct), bossWin = M.bossHP === 0;
  if (!M.finished) { M.xp += 20 + (bossWin ? 15 : 0); M.finished = true; }
  save("submitted");
  const pool = { math: ["Decimal Duelist", "Rounding Rider", "Place Value Pro", "Zero Hero"], ela: ["Theme Hunter", "Word Wizard", "Prediction Pro", "Story Sage"], write: ["Evidence Expert", "Citation Champion", "Thesis Architect", "Transition Titan"] }[M.mid.split("-")[1]] || TITLES;
  const loot = pool[Math.floor(Math.random() * pool.length)];
  beep("win"); confetti();
  const m = M.m, legendDone = M.resp.some((r) => r.ph === "legend");
  $("#app").innerHTML = `${topbar()}<section class="card" style="max-width:720px;margin:10px auto;text-align:center">
    <div style="font-size:72px">${bossWin ? "🏆" : "⭐"}</div>
    <h2 style="font-size:34px">${bossWin ? `${esc(m.boss[0])} defeated!` : timeout ? "Time to rotate!" : "Mission complete!"}</h2>
    <div class="stars" style="font-size:44px">${"★".repeat(st)}${"☆".repeat(3 - st)}</div>
    <div class="row" style="justify-content:center;margin:10px 0"><span class="pill" style="background:var(--good2);color:#155E35;font-size:16px">${c.correct}/${c.scored} correct • ${c.pct}%</span><span class="pill" style="background:var(--gold);color:var(--night);font-size:16px">+${M.xp} XP for ${esc((S.profile || {}).guild || "your guild")}</span></div>
    <p>🎁 Loot drop: you unlocked the title <b>"${loot}"</b>!</p>
    <p class="muted">✅ Your work was sent to your teacher. Check 📬 Feedback later for your score and comments.</p>
    <div class="row" style="justify-content:center">
      ${m.legend && !legendDone && !timeout ? `<button class="btn dark" id="legend">🚀 Try the Side Quest (+25 XP)</button>` : ""}
      <button class="btn" id="home">Back to stations</button></div></section>`;
  wireTop();
  $("#home").onclick = () => { M = null; hub(); };
  const lg = $("#legend"); if (lg) lg.onclick = () => { M.items.push({ ...m.legend, ph: "legend" }); M.i = M.items.length - 1; M.end = Math.max(M.end, Date.now() + 4 * 60000); mTimer = setInterval(tickTimer, 1000); renderItem(); const n = $("#next"); n.onclick = () => finish(false); };
}

// ---------- student inbox ----------
function inbox() {
  const rev = S.work.filter((w) => w.review).sort((a, b) => (b.review.ts || 0) - (a.review.ts || 0));
  $("#app").innerHTML = `${topbar()}<section class="card" style="max-width:820px;margin:10px auto"><h2 style="font-size:28px">📬 My Feedback</h2>
  <p class="muted">Your teacher's scores and comments on your missions.</p>
  <div class="list">${rev.length ? rev.map((w) => `<button class="li ${w.seen ? "" : "unread"}" data-open="${esc(w.id)}"><span><b>Day ${w.day} • ${SUBJECTS[w.subject].icon} ${esc(MISSIONS[w.missionId].title)}</b><br><span class="muted" style="font-size:14px">${esc((w.review.feedback || "").slice(0, 90))}${(w.review.feedback || "").length > 90 ? "…" : ""}</span></span><span class="score s${w.review.score || 3}">${w.review.score ? SCORE_LABEL[w.review.score] : "Reviewed"}</span></button>`).join("") : `<p>No feedback yet. Finish a mission and your teacher's comments will show up here.</p>`}</div>
  <div class="row" style="margin-top:14px"><button class="btn" id="back">⬅ Back to stations</button></div></section>`;
  wireTop(); $("#back").onclick = hub;
  document.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => openFeedback(b.dataset.open)));
}
async function openFeedback(id) {
  const w = S.work.find((x) => x.id === id); if (!w) return;
  if (!w.seen) { w.seen = true; api.markSeen(id); }
  const r = w.review || {};
  $("#app").innerHTML = `${topbar()}<section class="card" style="max-width:820px;margin:10px auto">
    <span class="pill" style="background:${SUBJ_COL[w.subject][0]};color:#fff">Day ${w.day} • ${SUBJECTS[w.subject].name}</span>
    <h2 style="font-size:28px;margin-top:8px">${esc(MISSIONS[w.missionId].title)}</h2>
    <div class="row" style="margin:10px 0">${r.score ? `<span class="score s${r.score}" style="font-size:20px">${SCORE_LABEL[r.score]}</span>` : ""}<span class="pill" style="background:var(--good2);color:#155E35">Auto score ${w.autoPct}%</span></div>
    <div class="feedback info" style="font-size:18px">💬 ${esc(r.feedback || "Your teacher reviewed this mission.")}</div>
    <h3 style="margin-top:16px">My answers</h3>
    ${(w.responses || []).map((x) => `<div class="ans"><div style="font-size:14px" class="muted">${esc(x.q)}</div><div>${x.ok === true ? "✅" : x.ok === false ? "❌" : "✍️"} ${esc(x.ans)}</div>${r.items && r.items[x.k] ? `<div style="margin-top:6px"><span class="score s${Math.max(1, Math.min(4, r.items[x.k].score || 3))}">${r.items[x.k].score}/4</span> ${esc(r.items[x.k].note || "")}</div>` : ""}</div>`).join("")}
    <div class="row" style="margin-top:14px"><button class="btn" id="back">⬅ Back</button></div></section>`;
  wireTop(); $("#back").onclick = inbox;
}

// =================== TEACHER ===================
let T = { tab: "live", data: null, poll: null, filterDay: "all", filterSub: "all", sel: null, rb: { day: 1, rot: 0, end: null, paused: 900000, groups: ["Group 1", "Group 2", "Group 3"] } };
function teacherHome() {
  clearInterval(T.poll);
  $("#app").innerHTML = `<header class="topbar"><div class="brand"><div class="logo">🧭</div><div><small>Teacher Dashboard</small><h1>Quest Week Rotations</h1></div></div>
    <div class="row">${S.preview ? `<button class="btn ghost sm" id="toStudent">👀 Student view</button>` : ""}<button class="btn ghost sm" id="refresh">🔄 Refresh</button>${LIVE ? `<button class="btn ghost sm" id="tSignOut">Sign out</button>` : ""}</div></header>
    ${S.preview ? `<div class="card" style="background:var(--gold2);padding:10px 14px;margin-bottom:12px;font-size:14px">👀 <b>Preview mode:</b> you're seeing sample students plus anything you play in Student view on this device. Live student data appears once you connect the Apps Script API in js/config.js (see README).</div>` : ""}
    <nav class="daytabs" role="tablist">${[["live", "📡 Live work"], ["review", "📝 Review & score"], ["board", "🔄 Rotation board"], ["guides", "🧭 Teacher table guides"], ["settings", "⚙️ Settings"]].map(([k, l]) => `<button class="tab" role="tab" aria-selected="${T.tab === k}" data-tab="${k}">${l}</button>`).join("")}</nav>
    <div id="tbody"></div>`;
  $(".daytabs").onclick = (e) => { const b = e.target.closest("[data-tab]"); if (!b) return; T.tab = b.dataset.tab; teacherHome(); };
  $("#refresh").onclick = () => loadTeacher(true);
  const tso = $("#tSignOut"); if (tso) tso.onclick = () => { clearInterval(T.poll); SESSION = null; lsSet("questUA_session", null); signIn(); };
  const ts = $("#toStudent"); if (ts) ts.onclick = async () => { S.teacher = false; clearInterval(T.poll); S.work = await api.myWork(); S.profile ? hub() : welcome(); };
  loadTeacher(true);
  T.poll = setInterval(() => { if (T.tab === "live" || (T.tab === "review" && !T.dirty)) loadTeacher(false); }, LIVE ? 10000 : 4000);
}
async function loadTeacher(full) {
  try { T.data = await api.teacherAll(); if (T.data.settings && T.data.settings.tt) S.settings = T.data.settings; } catch (e) { $("#tbody").innerHTML = `<div class="card">Couldn't load student work: ${esc(e.message)}. Press Refresh to try again.</div>`; return; }
  ({ live: tLive, review: tReview, board: tBoard, guides: tGuides, settings: tSettings })[T.tab](full);
}
function filtered() { return T.data.work.filter((w) => (T.filterDay === "all" || w.day == T.filterDay) && (T.filterSub === "all" || w.subject === T.filterSub)); }
function filterBar() {
  return `<div class="row" style="margin-bottom:12px"><label style="width:auto">Day <select id="fD" style="width:auto">${["all", 1, 2, 3, 4, 5].map((d) => `<option value="${d}" ${T.filterDay == d ? "selected" : ""}>${d === "all" ? "All days" : "Day " + d}</option>`).join("")}</select></label>
  <label style="width:auto">Station <select id="fS" style="width:auto">${["all", ...SUBJ_ORDER].map((s) => `<option value="${s}" ${T.filterSub === s ? "selected" : ""}>${s === "all" ? "All stations" : SUBJECTS[s].name}</option>`).join("")}</select></label></div>`;
}
function wireFilter(fn) { $("#fD").onchange = (e) => { T.filterDay = e.target.value; fn(true); }; $("#fS").onchange = (e) => { T.filterSub = e.target.value; fn(true); }; }
function tLive() {
  const ws = filtered(), latest = {};
  ws.forEach((w) => { if (!latest[w.email] || w.updated > latest[w.email].updated) latest[w.email] = w; });
  const stus = Object.values(latest).sort((a, b) => b.updated - a.updated);
  const working = stus.filter((w) => w.status === "in progress" && Date.now() - w.updated < 180000).length;
  const needs = T.data.work.filter((w) => w.status === "submitted" && !w.review).length;
  $("#tbody").innerHTML = `${filterBar()}
  <div class="row" style="margin-bottom:12px"><span class="pill" style="background:var(--good);color:#fff;font-size:15px;padding:6px 12px">🟢 ${working} working now</span><span class="pill" style="background:var(--gold);color:var(--night);font-size:15px;padding:6px 12px">📝 ${needs} need review</span><span class="pill" style="background:var(--night2);color:var(--cream);font-size:15px;padding:6px 12px">👥 ${Object.keys(T.data.profiles).length} students</span></div>
  ${stus.length ? `<div class="tgrid">${stus.map((w) => { const live = w.status === "in progress" && Date.now() - w.updated < 180000; const m = MISSIONS[w.missionId]; return `<button class="stu ${live ? "live" : ""}" data-id="${esc(w.id)}">
    <div class="row" style="gap:8px"><span class="avatar" style="width:38px;height:38px;font-size:22px">${w.avatar || "🦸"}</span><div style="min-width:0"><b class="fh">${esc(w.name)}</b><div style="font-size:12px" class="muted">${esc(w.guild || "")}</div></div></div>
    <div style="font-size:14px"><span class="pill" style="background:${SUBJ_COL[w.subject][0]};color:#fff">D${w.day} ${SUBJECTS[w.subject].name}</span> ${esc(m ? m.title : w.missionId)}</div>
    <div class="prog" aria-label="Progress"><i style="width:${Math.round(100 * w.itemsDone / Math.max(1, w.itemsTotal))}%"></i></div>
    <div class="row" style="justify-content:space-between;font-size:13px"><span>${w.itemsDone}/${w.itemsTotal} • ${w.autoPct}%</span><span>${live ? `<span class="dot" style="background:var(--good)"></span> ${w.current === "boss" ? "⚔️ Boss" : "Working"}` : w.review ? "✅ Reviewed" : w.status === "submitted" ? "📝 Submitted" : "⏸ " + ago(w.updated)}</span></div></button>`; }).join("")}</div>` : `<div class="card"><h3>No student work yet</h3><p>When students start a mission, their progress shows up here live (refreshes every 10 seconds).</p></div>`}`;
  wireFilter(tLive);
  document.querySelectorAll(".stu[data-id]").forEach((b) => (b.onclick = () => { T.tab = "review"; T.sel = b.dataset.id; teacherHome(); }));
}
function tReview(full) {
  if (!full && T.sel) return; // don't disrupt an open review
  const ws = filtered().sort((a, b) => (a.review ? 1 : 0) - (b.review ? 1 : 0) || b.updated - a.updated);
  if (!T.sel && ws.length) T.sel = ws[0].id;
  const w = T.data.work.find((x) => x.id === T.sel);
  $("#tbody").innerHTML = `${filterBar()}<div class="split">
    <div class="card" style="padding:12px"><h3 style="margin-bottom:8px">Submissions</h3><div class="list" style="max-height:70vh;overflow:auto">${ws.map((x) => `<button class="li ${x.id === T.sel ? "unread" : ""}" data-id="${esc(x.id)}"><span style="min-width:0"><b>${esc(x.name)}</b> <span style="font-size:13px" class="muted">D${x.day} ${SUBJECTS[x.subject].name}</span><br><span style="font-size:13px">${x.autoPct}% • ${x.status}${x.responses && x.responses.some((r) => r.t === "write") ? " • ✍️ writing" : ""}</span></span>${x.review ? `<span class="score s${x.review.score || 3}">${x.review.score || "✓"}</span>` : `<span class="pill" style="background:var(--gold);color:var(--night)">New</span>`}</button>`).join("") || `<p class="muted">Nothing here yet.</p>`}</div></div>
    <div class="card" id="rv">${w ? reviewPane(w) : "<p>Pick a submission to review.</p>"}</div></div>`;
  wireFilter(tReview);
  document.querySelectorAll(".li[data-id]").forEach((b) => (b.onclick = () => { T.sel = b.dataset.id; T.dirty = false; tReview(true); }));
  if (w) wireReview(w);
}
function reviewPane(w) {
  const r = w.review || { score: 0, feedback: "", items: {} }, m = MISSIONS[w.missionId];
  return `<div class="row" style="justify-content:space-between"><div><span class="pill" style="background:${SUBJ_COL[w.subject][0]};color:#fff">Day ${w.day} • ${SUBJECTS[w.subject].name}</span><h2 style="font-size:24px;margin-top:6px">${esc(w.name)} — ${esc(m.title)}</h2>
    <div class="muted" style="font-size:14px">${esc(w.email)} • ${esc(w.guild || "")} • ${w.status} • updated ${ago(w.updated)}</div></div>
    <div style="text-align:right"><div class="fh" style="font-size:28px">${w.autoPct}%</div><div class="muted" style="font-size:13px">${w.correct}/${w.scored} auto-scored • ${w.xp} XP</div></div></div>
  <div class="list" style="margin-top:12px">${(w.responses || []).map((x) => `<div class="ans"><div class="row" style="justify-content:space-between"><span style="font-size:13px" class="muted">${x.ph.toUpperCase()} • ${esc(x.q)}</span><span>${x.ok === true ? `✅ ${x.tries > 1 ? "(2nd try)" : ""}` : x.ok === false ? "❌" : "✍️ needs score"}</span></div>
    <div style="white-space:pre-wrap;margin-top:4px">${esc(x.ans)}</div>
    ${x.checks ? `<div style="font-size:13px;margin-top:4px" class="muted">${x.checks.map(([l, ok]) => (ok ? "✅ " : "⬜ ") + esc(l)).join(" • ")}</div>` : ""}
    ${x.t === "write" ? `<div class="row" style="margin-top:8px"><label style="width:auto">Score <select data-is="${x.k}" style="width:auto">${["", 4, 3, 2, 1, 0].map((v) => `<option value="${v}" ${r.items && r.items[x.k] && String(r.items[x.k].score) === String(v) ? "selected" : ""}>${v === "" ? "—" : v + "/4"}</option>`).join("")}</select></label><input data-in="${x.k}" placeholder="Comment on this answer" value="${esc(r.items && r.items[x.k] ? r.items[x.k].note : "")}" style="flex:1;min-width:180px"></div>` : ""}</div>`).join("") || `<p class="muted">No answers yet.</p>`}</div>
  <h3 style="margin-top:14px">Overall score</h3>
  <div class="row" id="sc">${[4, 3, 2, 1].map((v) => `<button class="score s${v}" data-sc="${v}" style="opacity:${r.score == v ? 1 : 0.45};font-size:15px;padding:8px 12px">${SCORE_LABEL[v]}</button>`).join("")}</div>
  <h3 style="margin-top:12px">Feedback for the student</h3>
  <div class="chips" style="margin:6px 0">${CHIPS.map((c) => `<button data-chip="${esc(c)}">${esc(c)}</button>`).join("")}</div>
  <textarea id="fbText" rows="4" placeholder="Write feedback the student will see in their 📬 Feedback inbox.">${esc(r.feedback || "")}</textarea>
  <div class="row" style="margin-top:10px"><button class="btn" id="saveRv">💾 Save & send to student</button><button class="btn ghost sm" id="nextRv" style="color:var(--ink);border-color:var(--line)">Next ➜</button><span id="rvMsg" class="muted"></span></div>`;
}
function wireReview(w) {
  const r = { score: (w.review && w.review.score) || 0, feedback: "", items: { ...((w.review && w.review.items) || {}) } };
  $("#rv").oninput = () => (T.dirty = true);
  $("#sc").onclick = (e) => { const b = e.target.closest("[data-sc]"); if (!b) return; r.score = +b.dataset.sc; T.dirty = true; [...$("#sc").children].forEach((c) => (c.style.opacity = c === b ? 1 : 0.45)); };
  document.querySelectorAll("[data-chip]").forEach((b) => (b.onclick = () => { const t = $("#fbText"); t.value = (t.value.trim() ? t.value.trim() + " " : "") + b.dataset.chip; T.dirty = true; }));
  $("#saveRv").onclick = async () => {
    document.querySelectorAll("[data-is]").forEach((s) => { const k = s.dataset.is; const note = document.querySelector(`[data-in="${k}"]`).value; if (s.value !== "" || note) r.items[k] = { score: s.value === "" ? null : +s.value, note }; });
    r.feedback = $("#fbText").value.trim();
    if (!r.score) { $("#rvMsg").textContent = "Pick an overall score (1–4) first."; return; }
    $("#saveRv").disabled = true; $("#rvMsg").textContent = "Saving…";
    try { await api.saveReview(w.id, r); w.review = { ...r, ts: Date.now() }; T.dirty = false; $("#rvMsg").textContent = "✅ Sent! The student will see it in their Feedback inbox."; } catch (e) { $("#rvMsg").textContent = "Couldn't save: " + e.message; }
    $("#saveRv").disabled = false;
  };
  $("#nextRv").onclick = () => { const ws = filtered().filter((x) => !x.review && x.id !== w.id); if (ws.length) { T.sel = ws[0].id; T.dirty = false; loadTeacher(true); } else $("#rvMsg").textContent = "🎉 All caught up — nothing left to review."; };
}
// rotation board
let rbTimer = null;
function tBoard() {
  const rb = T.rb, tt = S.settings.tt[rb.day], subs = [tt, ...SUBJ_ORDER.filter((s) => s !== tt)];
  const name = (s) => (s === tt ? "🧭 Teacher Table" : "💻 " + MISSIONS[`${rb.day}-${s}`].title);
  const left = rb.end ? Math.max(0, rb.end - Date.now()) : rb.paused;
  $("#tbody").innerHTML = `<div class="row" style="margin-bottom:10px">${[1, 2, 3, 4, 5].map((d) => `<button class="tab" aria-selected="${d === rb.day}" data-rd="${d}">Day ${d}</button>`).join("")}</div>
  <div class="card" style="background:var(--night2);color:var(--cream);text-align:center">
    <div class="fh" style="color:var(--gold);letter-spacing:2px">ROTATION ${rb.rot + 1} OF 3</div>
    <div class="bigtimer" id="bt">${fmt(left)}</div>
    <div class="row" style="justify-content:center;margin-top:10px"><button class="btn" id="bStart">${rb.end ? "⏸ Pause" : "▶ Start"}</button><button class="btn dark" id="bReset">↺ Reset 15:00</button><button class="btn dark" id="bNext">⏭ Next rotation</button></div></div>
  <div class="tablewrap" style="margin-top:14px"><table class="rot"><tr><th style="background:var(--night2)">Group</th>${[0, 1, 2].map((k) => `<th style="background:${k === rb.rot ? "var(--gold)" : "var(--night2)"};color:${k === rb.rot ? "var(--night)" : "var(--cream)"}">Rotation ${k + 1}</th>`).join("")}</tr>
  ${rb.groups.map((g, gi) => `<tr><td style="background:var(--cream);color:var(--ink)"><input data-g="${gi}" value="${esc(g)}" aria-label="Group name" style="text-align:center;font-family:var(--fh)"></td>${[0, 1, 2].map((k) => { const s = subs[(gi + k) % 3]; return `<td style="background:${s === tt ? "var(--gold)" : SUBJ_COL[s][0]};color:${s === tt ? "var(--night)" : "#fff"};${k === rb.rot ? "outline:4px solid var(--cream)" : "opacity:.75"}">${SUBJECTS[s].icon} ${SUBJECTS[s].name}<br><span style="font-size:14px">${esc(name(s))}</span></td>`; }).join("")}</tr>`).join("")}</table></div>
  <p style="opacity:.8">Group 1 starts at the Teacher Table. Rename groups to match your guilds or reading groups.</p>`;
  document.querySelectorAll("[data-rd]").forEach((b) => (b.onclick = () => { rb.day = +b.dataset.rd; tBoard(); }));
  document.querySelectorAll("[data-g]").forEach((i) => (i.onchange = () => (rb.groups[+i.dataset.g] = i.value)));
  $("#bStart").onclick = () => { if (rb.end) { rb.paused = Math.max(0, rb.end - Date.now()); rb.end = null; } else { rb.end = Date.now() + rb.paused; } tBoard(); };
  $("#bReset").onclick = () => { rb.end = null; rb.paused = 900000; tBoard(); };
  $("#bNext").onclick = () => { rb.rot = (rb.rot + 1) % 3; rb.end = null; rb.paused = 900000; tBoard(); };
  clearInterval(rbTimer);
  rbTimer = setInterval(() => { const el = $("#bt"); if (!el || T.tab !== "board") return clearInterval(rbTimer); const l = rb.end ? Math.max(0, rb.end - Date.now()) : rb.paused; el.textContent = fmt(l); if (rb.end && l <= 0) { rb.end = null; rb.paused = 0; beep("win"); confetti(); el.textContent = "ROTATE!"; } }, 500);
}
function fmt(ms) { const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60; return `${m}:${String(s).padStart(2, "0")}`; }
function tGuides() {
  const d = T.gDay || 1;
  $("#tbody").innerHTML = `<div class="row" style="margin-bottom:10px">${[1, 2, 3, 4, 5].map((n) => `<button class="tab" aria-selected="${n === d}" data-gd="${n}">Day ${n}</button>`).join("")}</div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">${SUBJ_ORDER.map((s) => { const g = TT[`${d}-${s}`], on = S.settings.tt[d] === s; return `<article class="card" style="${on ? "outline:4px solid var(--gold)" : ""}">
    <div class="row" style="justify-content:space-between"><span class="pill" style="background:${SUBJ_COL[s][0]};color:#fff">${SUBJECTS[s].icon} ${SUBJECTS[s].name}</span>${on ? `<span class="pill tt-flag">🧭 Today's teacher table</span>` : ""}</div>
    <h3 style="margin-top:8px">${esc(g.focus)}</h3><p style="font-size:14px"><b>Materials:</b> ${esc(g.mats)}</p>
    <ol style="padding-left:20px">${g.plan.map((p) => `<li style="margin:4px 0">${esc(p)}</li>`).join("")}</ol>
    <div style="font-size:14px"><p><b>🧭 Route A:</b> ${esc(g.A)}</p><p><b>🥾 Route B:</b> ${esc(g.B)}</p><p><b>🏔️ Route C:</b> ${esc(g.C)}</p><p><b>🗣️ EL scaffold:</b> ${esc(g.el)}</p><p><b>🚀 GATE:</b> ${esc(g.gate)}</p></div></article>`; }).join("")}</div>`;
  document.querySelectorAll("[data-gd]").forEach((b) => (b.onclick = () => { T.gDay = +b.dataset.gd; tGuides(); }));
}
async function tSettings() {
  $("#tbody").innerHTML = `<div class="card" style="max-width:760px"><h3>Teacher table subject for each day</h3><p class="muted">Students see this on their station board. The other two subjects are digital missions.</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">${[1, 2, 3, 4, 5].map((d) => `<label>Day ${d}<select data-tt="${d}">${SUBJ_ORDER.map((s) => `<option value="${s}" ${S.settings.tt[d] === s ? "selected" : ""}>${SUBJECTS[s].name}</option>`).join("")}</select></label>`).join("")}</div>
  <div class="row" style="margin-top:12px"><button class="btn" id="saveSet">💾 Save schedule</button><span id="setMsg" class="muted"></span></div>
  <h3 style="margin-top:20px">Your data</h3><p id="sheetLine">${LIVE ? "Loading your Google Sheet link…" : "Connect the Apps Script API (see README) and every answer, score, and comment is saved in a Google Sheet you own."}</p>
  ${S.preview ? `<button class="btn dark sm" id="resetDemo">Reset preview data</button>` : ""}</div>
  <div class="card" style="max-width:760px;margin-top:14px"><h3>Students</h3><p class="muted">Forgot a secret code? Reset it, and the student makes a new one at their next sign-in.</p>
  <div class="list">${Object.values(T.data.profiles).sort((a, b) => String(a.name).localeCompare(b.name)).map((p) => `<div class="li"><span>${esc(p.avatar || "🦸")} <b>${esc(p.name)}</b> <span class="muted" style="font-size:13px">${esc(p.guild || "")} • Route ${esc(p.route || "B")}</span></span><button class="btn dark sm" data-reset="${esc(p.email)}">Reset secret code</button></div>`).join("") || `<p class="muted">No students have signed in yet.</p>`}</div><p id="rpMsg" class="muted"></p></div>`;
  document.querySelectorAll("[data-reset]").forEach((b) => (b.onclick = async () => { b.disabled = true; try { await api.resetPin(b.dataset.reset); $("#rpMsg").textContent = "✅ Secret code reset."; } catch (e) { $("#rpMsg").textContent = "Couldn't reset: " + e.message; } b.disabled = false; }));
  $("#saveSet").onclick = async () => { const tt = {}; document.querySelectorAll("[data-tt]").forEach((s) => (tt[s.dataset.tt] = s.value)); S.settings = { ...S.settings, tt }; $("#setMsg").textContent = "Saving…"; try { await api.saveSettings(S.settings); $("#setMsg").textContent = "✅ Saved. Students see the new schedule next time they open the app."; } catch (e) { $("#setMsg").textContent = "Couldn't save: " + e.message; } };
  const rd = $("#resetDemo"); if (rd) rd.onclick = () => { try { localStorage.removeItem("questUA_db"); } catch (e) {} S.work = []; S.profile = null; loadTeacher(true); };
  if (LIVE) { try { const u = await api.sheetUrl(); $("#sheetLine").innerHTML = `📊 <a href="${esc(u)}" target="_blank" rel="noopener" style="color:var(--math)">Open your Quest Week data sheet</a>`; } catch (e) {} }
}

boot();
