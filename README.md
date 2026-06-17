# Alaska 737 CQ 2026 — Offline Oral Prep

A private, offline study app for your Day 3 ILE/CLE oral. Built from the
materials in `Resources/`. No internet needed in use; nothing leaves your
devices.

---

## What's in it (v2026.1)

Everything is drawn straight from your source PDFs, and **every card cites its
source** (SH = System Handbook, FH = Flight Handbook §2.020, QRH = Quick
Reaction Handbook):

| Deck | Cards | Format | Source |
|------|-------|--------|--------|
| **Memory / Recall Items** | 4 | Read scenario → recall aloud → reveal QRH gold standard → self-grade | Day 3 slides 5–8 → QRH E3/E4/E5/E6 |
| **Limitations** | 29 | Multiple choice + fill-recall | Day 3 slides 9–22 → FH §2.020 |
| **Systems Oral — Flight A** | 14 | Answer aloud → reveal model answer | Day 3 slides 26–39 |
| **Systems Oral — Flight B** | 15 | Answer aloud → reveal model answer | Day 3 slides 42–55 |
| **Systems Oral — Flight C** | 14 | Answer aloud → reveal model answer | Day 3 slides 58–71 |
| **Systems Deep-Dive** | 10 | Multiple choice | SH, oral-focus systems |

**Simulate the Oral** mirrors the real spinner — draws Flight A, B, or C, runs
it in flight-phase order, with a memory-item + limitations warm-up.

### The learning engine
- **Spaced repetition (SM-2):** every card schedules its own next review. The
  Home screen shows what's *due*. Honest self-grading drives it — "Again" brings
  a card back today; "Easy" pushes it out weeks.
- **Active recall:** memory items and orals make you answer *out loud first*,
  then reveal — retrieval practice, not re-reading.
- **Interleaving:** "Quick mix" and the oral sim shuffle systems and phases.
- **Streak + progress:** daily 🔥 streak and per-deck mastery rings.

All progress is stored on-device (localStorage). Fully offline, survives
restarts.

---

## Getting it on your iPhone 16 Pro + iPad

You have two options. **Option A** is the proper installable app (best). **Option
B** needs nothing at all and is a great fallback.

### Option A — Installable PWA (recommended, full offline)
This is the `app/` folder. It needs to be served over https once so iOS will
install it as a real home-screen app with a service worker (true offline after
that). Easiest free host is **GitHub Pages**:

1. (When you're back online) I'll help you push `app/` to a private/public
   GitHub repo and enable Pages — 5 minutes, free, no Apple fee.
2. On each device, open the Pages URL in **Safari** → Share → **Add to Home
   Screen**.
3. Open it once with signal so it caches. After that it runs with **no
   internet** — including at altitude.
4. To refresh content later (new cards, scenario updates), just open it once
   with signal; the service worker pulls the update.

### Option B — Single file, zero setup (works right now)
`737-CQ-Study.html` (89 KB) is the entire app inlined into one file.
- AirDrop / email it to yourself → open in Safari on the iPhone/iPad.
- Add to Home Screen for an app-style icon.
- Works offline. Progress saves per device.
- Trade-off vs. Option A: re-opening a local file on iOS is slightly less
  seamless than an installed PWA, and content updates mean re-sending the file.

> Both builds share the same content and engine. Start with Option B today;
> we'll set up Option A when you're back online if you want the cleaner install.

---

## Sharing with trusted friends (password-protected hosted build)

`docs/` is a **password-gated** build for GitHub Pages. The question bank ships
**encrypted** (`docs/js/data.locked.js`), so the proprietary content is never
readable on the public URL — a shared password decrypts it in the browser.

- Build it: `python3 build_locked.py "your-shared-password"`
- It outputs `docs/` (Pages serves from `main` / `/docs`).
- You + friends open the Pages URL once online → enter the password → Add to
  Home Screen → fully offline thereafter. The password is remembered for the
  session.

**Honest scope:** this is *deterrent-grade* protection for sharing among trusted
colleagues — it keeps the content off the open web and out of search engines.
It is not bank-grade security against someone who already has the password.
Because GitHub Free serves Pages only from **public** repos, the repo will hold
the *encrypted* bank + code (not the readable content); the password is what
protects the material. Keep the password to trusted people. Personal study aid —
not for redistribution.

Crypto: PBKDF2-HMAC-SHA256 (150k iterations) → HMAC-SHA256 keystream → XOR, with
a verification tag. Build (`build_locked.py`) and runtime (`app/js/lock.js`)
implement the identical scheme.

## Previewing on your Mac
```
python3 serve.py        # serves app/ at http://127.0.0.1:8753
```
(Or use the Claude Code preview — `.claude/launch.json` is set up.)

To rebuild the single file after any content change:
```
python3 build_singlefile.py
```

---

## Scope notes / what's next (your call)
- **Focused on Day 3** as you asked — it's the scored oral, verbatim.
- **Not yet added:** the Day 1 (CLO) / Day 2 (CMV/CQM) **sim scenarios** as a
  quiz deck, deeper Systems Handbook drilling beyond the oral's focus, and the
  Alaska training **videos/podcasts** (these would bloat the offline bundle —
  better linked or transcribed; tell me and I'll wire them in).
- Content lives in one file — `app/js/data.js` — so adding/editing cards is
  quick and low-risk.

*Personal study aid. Always defer to current Alaska manuals and your instructor.
Not a controlled document.*
