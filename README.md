# 🗺️ Quest Week UA Rotations

A gamified Universal Access (UA) platform for Grade 5, Unit 2, Week 4. Students do **three 15-minute rotations a day** (ELA, Writing and Math). One rotation is the **teacher table**, and the other two are digital missions.

- **15 missions** (5 days × 3 subjects). Each one has a warm-up, quest questions and a **Boss Battle** with a health bar, plus an optional **Side Quest** for GATE students.
- **The game layer:**
  - students make a hero and join a **guild**
  - they earn **XP**, levels, combos, stars, badges and reward titles
  - a **guild leaderboard** tracks the class
  - each mission has a built-in 15:00 timer
- **Power-Ups:** 💡 Hint, ✂️ 50/50 and 🔊 Read to me. Route A/B/C sets how many uses each student gets.
- **Teacher dashboard:**
  - 📡 **Live work** (refreshes every 10 seconds)
  - 📝 **Review & score**: a 1–4 overall score, 0–4 per writing answer, and comments with one-tap phrases
  - 🔄 **Rotation board**: a projector timer and group rotation chart
  - 🧭 **Teacher table guides**: Route A/B/C, EL and GATE moves for each day
  - ⚙️ **Settings**: the teacher-table schedule and secret-code resets
- **Students see your feedback** in their 📬 Feedback inbox.

The site runs on **GitHub Pages**. Student work saves to a **Google Sheet you own** through a small Google Apps Script API. Students **don't need Google or GitHub accounts**. They sign in with a class code, their first name and last initial, and a 4-digit secret code they make up.

---

## Part 1: Put the site on GitHub Pages (about 5 minutes, no coding)

1. Sign in at **github.com** and click **New repository**. Name it `quest-week-ua`, choose **Public**, and click **Create repository**.
2. On the new repo page, click **uploading an existing file**.
3. Drag in **everything inside this folder**: `index.html`, `README.md`, `.nojekyll`, and the `css`, `js` and `apps-script` folders. Then click **Commit changes**.
   - If the `.nojekyll` file is hidden on your Mac, press **Cmd + Shift + .** in Finder to show hidden files. You can also skip it; the site works without it.
4. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select branch **main** and folder **/ (root)**, then click **Save**.
5. After a minute or two, your site is live at
   `https://YOUR-USERNAME.github.io/quest-week-ua/`

At this point the site runs in **Preview mode**: everything works, but work saves only in each student's browser. Do Part 2 to save work live to your dashboard.

## Part 2: Connect live saving (about 5 minutes)

1. Go to **script.google.com → New project** and name it `Quest Week UA API`.
2. Open `apps-script/Code.gs` from this repo, copy all of it, and paste it over the code in the editor.
3. At the top, change:
   - `CLASS_CODE` (students type this, e.g. `QUEST5`)
   - `TEACHER_PASSWORD` (you type this to open the dashboard; make it strong)
4. Click 💾 **Save**. Choose `setup` in the function menu and click **Run**, then approve the permissions. This creates your Google Sheet.
5. Click **Deploy → New deployment → ⚙️ Web app** and set:
   - **Execute as:** Me
   - **Who has access:** Anyone
   
   Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
6. On GitHub, open `js/config.js`, click ✏️ **Edit**, paste the URL into `API_URL`, and click **Commit changes**:
   ```js
   window.QUEST_CONFIG = {
     API_URL: "https://script.google.com/macros/s/XXXXXXXX/exec",
     CLASS_NAME: "Room 5 • Universal Access",
   };
   ```
7. Open your site, choose **🧭 Teacher**, and type your password. That's your dashboard. Share the site link and class code with students through Google Classroom.

**If you edit Code.gs later:** go to **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The URL stays the same.

## How students sign in

- **Class code** (from you), **first name + last initial** (e.g. `Maria G`), and a **4-digit secret code**.
- The first time a student signs in, the secret code they type becomes theirs.
- If a student forgets it, go to **⚙️ Settings → Students → Reset secret code**. The student makes a new one at their next sign-in.

## Privacy notes

- Student work is stored only in **your** Google Sheet ("Quest Week UA — Student Work" in your Drive). Nothing is stored on GitHub.
- The site stores names only as **first name + last initial**, with no emails.
- The class code and secret codes keep casual visitors out. Treat the class code like a classroom password, and change it in Code.gs (then redeploy) if it gets shared outside your class.
- Check your district's guidance on student data before using any web tool.

## Files

| File | What it does |
|---|---|
| `index.html` | The page |
| `css/style.css` | The look (night-sky quest map, Fredoka + Lexend fonts) |
| `js/config.js` | **Your settings**: the API URL and class name |
| `js/content.js` | All 15 missions and teacher-table guides. Edit questions here. |
| `js/app.js` | The game engine, student views and teacher dashboard |
| `apps-script/Code.gs` | The Google Apps Script API (paste it into script.google.com) |

### Editing questions

Each mission in `js/content.js` has `warm`, `quest` and `bossQ` lists, plus a `legend` (the Side Quest). Question types:

| Type | What students do |
|---|---|
| `mc` | multiple choice |
| `multi` | choose all that apply |
| `sym` | compare two decimals with >, < or = |
| `num` | type a number |
| `sort` | sort items into groups |
| `tap` | tap the right words |
| `order` | put pieces in order |
| `write` | open response with a checklist |
