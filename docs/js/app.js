/* ============================================================================
 *  app.js — UI + quiz engine for Alaska 737 CQ Study
 * ==========================================================================*/

// Resolved at boot — in the locked build the bank doesn't exist until the
// password decrypts it, so we can't bind this at parse time.
let BANK;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const State = {
  mode: null,        // 'study' | 'exam' | 'cram'
  queue: [],         // array of card objects
  idx: 0,
  deckId: null,
  revealed: false,
  session: { correct: 0, total: 0, again: 0 }
};

/* ---------- tiny markdown (bold + line breaks + bullets) ---------- */
function md(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .split("\n")
    .map(l => l.trim().startsWith("•") || /^\d+\./.test(l.trim())
      ? `<div class="li">${l}</div>` : `<div>${l}</div>`)
    .join("");
}

function deckById(id) { return BANK.decks.find(d => d.id === id); }
function allCards() { return BANK.decks.flatMap(d => d.cards.map(c => ({ ...c, _deck: d.id }))); }
function cardsOfDeck(id) { return deckById(id).cards.map(c => ({ ...c, _deck: id })); }

// "Weak spots": cards you've actually struggled with — lapsed (tapped Again)
// or marked Hard (which lowers ease below the 2.5 default). Ignores the
// spaced-repetition schedule so you can grind your worst items on demand.
function weakCards() {
  return allCards().filter(c => {
    const s = SRS.cardState(c.id);
    if (s.seen === 0) return false;
    const struggled = s.lapses > 0 || s.ease < 2.5;     // tapped Again or Hard
    return struggled && SRS.mastery(c.id) < 0.6;          // and not yet relearned
  });
}

function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ===================== HOME ===================== */
function renderHome() {
  State.mode = null;
  const dueTotal = allCards().filter(c => SRS.isDue(c.id)).length;
  const weakN = weakCards().length;
  const streak = SRS.streak();

  const deckCards = BANK.decks.map(d => {
    const st = SRS.deckStats(d);
    const pct = Math.round((st.mastered / st.total) * 100);
    return `
      <button class="deck" data-deck="${d.id}" style="--accent:${d.color}">
        <div class="deck-bar"></div>
        <div class="deck-body">
          <div class="deck-title">${d.title}</div>
          <div class="deck-blurb">${d.blurb}</div>
          <div class="deck-stats">
            <span class="chip ${st.due ? 'chip-due' : ''}">${st.due} due</span>
            <span class="chip">${st.total} cards</span>
            <span class="chip chip-mastery">${pct}% mastered</span>
          </div>
        </div>
        <div class="deck-go">›</div>
      </button>`;
  }).join("");

  app.innerHTML = `
    <header class="home-hero">
      <div class="hero-top">
        <div>
          <div class="kicker">Alaska Airlines · 737 MAX/NG</div>
          <h1>CQ 2026 Oral Prep</h1>
        </div>
        <div class="streak" title="Daily study streak">🔥 ${streak}</div>
      </div>
      <p class="hero-sub">Day 3 ILE/CLE oral — memory items, limitations & systems. Optimized for offline study at altitude.</p>
      <div class="hero-actions">
        <button class="primary big" id="btn-due">
          ${dueTotal ? `Review ${dueTotal} due` : `Quick mix`} <span>→</span>
        </button>
        <button class="ghost big" id="btn-exam">🎲 Simulate Oral</button>
      </div>
      ${weakN ? `<button class="weak-btn" id="btn-weak">⚠️ Drill ${weakN} weak spot${weakN === 1 ? "" : "s"} <span>→</span></button>` : ""}
    </header>

    <section class="decks">${deckCards}</section>

    <footer class="home-foot">
      <button class="link" id="btn-howto">How this app helps you study →</button>
      <div class="ver">v${BANK.meta.version} · MAX unless NG specified · offline</div>
    </footer>`;

  $("#btn-due").onclick = () => startSession(
    dueTotal ? allCards().filter(c => SRS.isDue(c.id)) : shuffle(allCards()).slice(0, 15),
    "study", "Quick mix");
  $("#btn-exam").onclick = renderExamPicker;
  if (weakN) $("#btn-weak").onclick = () => startSession(shuffle(weakCards()), "weak", "Weak spots");
  $("#btn-howto").onclick = renderHowto;
  $$(".deck").forEach(b => b.onclick = () => renderDeck(b.dataset.deck));
}

/* ===================== DECK DETAIL ===================== */
function renderDeck(id) {
  const d = deckById(id);
  const st = SRS.deckStats(d);
  app.innerHTML = `
    <div class="topbar">
      <button class="back" id="back">‹ Home</button>
      <div class="topbar-title">${d.title}</div>
      <button class="back" id="reset" title="Reset progress for this deck">⟲</button>
    </div>
    <div class="deck-detail" style="--accent:${d.color}">
      <p class="deck-blurb big">${d.blurb}</p>
      <div class="deck-stats big">
        <span class="chip ${st.due ? 'chip-due' : ''}">${st.due} due</span>
        <span class="chip">${st.seen}/${st.total} seen</span>
        <span class="chip chip-mastery">${st.mastered} mastered</span>
      </div>
      <div class="deck-detail-actions">
        <button class="primary big" id="study">Study deck (${st.due || st.total})</button>
        <button class="ghost big" id="cram">Cram all ${st.total}</button>
      </div>
      <div class="card-list">
        ${d.cards.map(c => {
          const m = SRS.mastery(c.id);
          return `<div class="card-row">
            <span class="dot" style="--m:${m}"></span>
            <span class="card-row-q">${c.prompt}</span>
            <span class="card-row-src">${c.source}</span>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  $("#back").onclick = renderHome;
  $("#study").onclick = () => {
    const due = cardsOfDeck(id).filter(c => SRS.isDue(c.id));
    startSession(due.length ? due : cardsOfDeck(id), "study", d.title);
  };
  $("#cram").onclick = () => startSession(shuffle(cardsOfDeck(id)), "cram", d.title + " · Cram");
  $("#reset").onclick = () => {
    if (confirm(`Reset your progress for "${d.title}"?`)) { SRS.resetDeck(d); renderDeck(id); }
  };
}

/* ===================== EXAM PICKER (the spinner) ===================== */
function renderExamPicker() {
  app.innerHTML = `
    <div class="topbar">
      <button class="back" id="back">‹ Home</button>
      <div class="topbar-title">Simulate the Oral</div><span></span>
    </div>
    <div class="exam-pick">
      <p>The real Day 3 oral spins to assign you Flight A, B, or C. Spin for a full timed-feel oral, or pick one.</p>
      <div class="spinner" id="spinner">A · B · C</div>
      <button class="primary big" id="spin">🎲 Spin</button>
      <div class="exam-row">
        <button class="ghost" data-f="oral-a">Flight A</button>
        <button class="ghost" data-f="oral-b">Flight B</button>
        <button class="ghost" data-f="oral-c">Flight C</button>
      </div>
      <p class="muted">Each oral runs in flight-phase order, just like the briefing. Includes a recall &amp; limitations warm-up.</p>
    </div>`;
  $("#back").onclick = renderHome;
  const flights = ["oral-a", "oral-b", "oral-c"];
  $("#spin").onclick = () => {
    const sp = $("#spinner");
    let n = 0;
    const iv = setInterval(() => {
      sp.textContent = "Flight " + ["A", "B", "C"][n % 3];
      n++;
      if (n > 16) {
        clearInterval(iv);
        const pick = flights[Math.floor(Math.random() * 3)];
        sp.textContent = "Flight " + pick.slice(-1).toUpperCase();
        setTimeout(() => startExam(pick), 600);
      }
    }, 80);
  };
  $$(".exam-row .ghost").forEach(b => b.onclick = () => startExam(b.dataset.f));
}

function startExam(flightDeckId) {
  // warm-up: all memory items + a sample of limitations, then the chosen oral in order
  const warm = shuffle(cardsOfDeck("memory"))
    .concat(shuffle(cardsOfDeck("limitations")).slice(0, 6));
  const oral = cardsOfDeck(flightDeckId); // keep phase order
  startSession(warm.concat(oral), "exam", "Oral · " + deckById(flightDeckId).title);
}

/* ===================== SESSION ENGINE ===================== */
function startSession(cards, mode, label) {
  if (!cards.length) { renderHome(); return; }
  SRS.touchStreak();
  State.mode = mode;
  State.queue = cards;
  State.idx = 0;
  State.label = label;
  State.session = { correct: 0, total: 0, again: 0 };
  renderCard();
}

function renderCard() {
  if (State.idx >= State.queue.length) return renderSummary();
  const c = State.queue[State.idx];
  State.revealed = false;
  const progress = Math.round((State.idx / State.queue.length) * 100);

  const meta = [c.phase, c.system].filter(Boolean).join(" · ");
  app.innerHTML = `
    <div class="quiz-top">
      <button class="back" id="quit">✕</button>
      <div class="progress"><div class="progress-fill" style="width:${progress}%"></div></div>
      <div class="count">${State.idx + 1}/${State.queue.length}</div>
    </div>
    <div class="card-stage" id="stage"></div>`;
  $("#quit").onclick = () => { if (confirm("End this session?")) renderHome(); };

  if (c.format === "mc") renderMC(c);
  else renderRecall(c);   // recall + reveal share UI
}

/* ---- Multiple choice ---- */
function renderMC(c) {
  const stage = $("#stage");
  const order = shuffle(c.choices.map((t, i) => ({ t, i })));
  stage.innerHTML = `
    <div class="q-meta">${[c.phase, c.system].filter(Boolean).join(" · ")}<span class="src">${c.source}</span></div>
    <div class="q-prompt">${md(c.prompt)}</div>
    <div class="choices">
      ${order.map(o => `<button class="choice" data-i="${o.i}">${o.t}</button>`).join("")}
    </div>
    <div class="explain" id="explain" hidden></div>
    <div class="next-wrap" id="nextwrap" hidden>
      <button class="primary big" id="next">Continue →</button>
    </div>`;

  $$(".choice").forEach(btn => btn.onclick = () => {
    if (State.revealed) return;
    State.revealed = true;
    const chosen = +btn.dataset.i;
    const correct = c.answer;
    State.session.total++;
    if (chosen === correct) State.session.correct++;
    $$(".choice").forEach(b => {
      const i = +b.dataset.i;
      b.disabled = true;
      if (i === correct) b.classList.add("correct");
      if (i === chosen && chosen !== correct) b.classList.add("wrong");
    });
    SRS.record(c.id, chosen === correct ? 2 : 0);
    if (c.explain) { const e = $("#explain"); e.hidden = false; e.innerHTML = md(c.explain); }
    $("#nextwrap").hidden = false;
    $("#next").onclick = advance;
    $("#next").focus();
  });
}

/* ---- Recall / Reveal (active recall + self-grade) ---- */
function renderRecall(c) {
  const stage = $("#stage");
  const isMemory = c.format === "recall";
  stage.innerHTML = `
    <div class="q-meta">${[c.phase, c.system].filter(Boolean).join(" · ")}<span class="src">${c.source}</span></div>
    <div class="q-prompt">${md(c.prompt)}</div>
    ${isMemory ? `<div class="recall-hint">Say your immediate actions &amp; the checklist out loud, then reveal.</div>`
               : `<div class="recall-hint">Answer out loud, then reveal the model answer.</div>`}
    <div class="reveal-wrap">
      <button class="primary big" id="reveal">Reveal answer</button>
    </div>
    <div class="answer" id="answer" hidden>
      <div class="answer-label">Model answer</div>
      <div class="answer-body">${md(c.gold)}</div>
      ${c.keypoints ? `<div class="keypoints">${c.keypoints.map(k => `<span class="kp">${k}</span>`).join("")}</div>` : ""}
      <div class="grade">
        <div class="grade-label">How did you do?</div>
        <div class="grade-btns">
          <button class="g g-again" data-g="0">Again</button>
          <button class="g g-hard"  data-g="1">Hard</button>
          <button class="g g-good"  data-g="2">Good</button>
          <button class="g g-easy"  data-g="3">Easy</button>
        </div>
      </div>
    </div>`;
  $("#reveal").onclick = () => {
    State.revealed = true;
    $(".reveal-wrap").hidden = true;
    $("#answer").hidden = false;
    $("#answer").scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  $$(".g").forEach(b => b.onclick = () => {
    const g = +b.dataset.g;
    State.session.total++;
    if (g >= 2) State.session.correct++;
    if (g === 0) State.session.again++;
    SRS.record(c.id, g);
    advance();
  });
}

function advance() { State.idx++; renderCard(); }

/* ===================== SUMMARY ===================== */
function renderSummary() {
  const s = State.session;
  const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0;
  const dueLeft = allCards().filter(c => SRS.isDue(c.id)).length;
  let verdict = pct >= 90 ? "Checkride-ready 💪" : pct >= 75 ? "Solid — keep sharpening" : "Worth another pass";
  app.innerHTML = `
    <div class="summary">
      <div class="big-score">${pct}%</div>
      <div class="verdict">${verdict}</div>
      <div class="sum-stats">
        <div><b>${s.correct}</b><span>strong</span></div>
        <div><b>${s.total}</b><span>cards</span></div>
        <div><b>${s.again}</b><span>missed</span></div>
      </div>
      <p class="muted">${State.label}</p>
      <div class="sum-actions">
        ${dueLeft ? `<button class="primary big" id="more">Review ${dueLeft} still due</button>` : ""}
        <button class="ghost big" id="home">Done — Home</button>
      </div>
    </div>`;
  if (dueLeft) $("#more").onclick = () => startSession(allCards().filter(c => SRS.isDue(c.id)), "study", "Due review");
  $("#home").onclick = renderHome;
}

/* ===================== HOW-TO ===================== */
function renderHowto() {
  app.innerHTML = `
    <div class="topbar"><button class="back" id="back">‹ Home</button>
      <div class="topbar-title">How to study with this</div><span></span></div>
    <div class="howto">
      <h3>Built on how memory actually works</h3>
      <ul>
        <li><b>Spaced repetition (SM-2):</b> every card schedules itself. Grade yourself honestly — “Again” brings it back today; “Easy” pushes it weeks out. The Home screen shows what’s <i>due</i>.</li>
        <li><b>Active recall:</b> memory items and systems orals make you answer <i>out loud first</i>, then reveal. Retrieval beats re-reading.</li>
        <li><b>Interleaving:</b> “Quick mix” and the oral simulator shuffle systems and phases so you can’t coast on context.</li>
        <li><b>Simulate the oral:</b> the spinner mirrors the real Day 3 Flight A/B/C draw, in flight-phase order, with a recall + limitations warm-up.</li>
      </ul>
      <h3>A suggested rhythm</h3>
      <ul>
        <li>Daily: clear your <b>due</b> cards (5–15 min). Keep the 🔥 streak alive.</li>
        <li>Memory items &amp; limitations: drill to <b>reflex</b> — these are pass/fail recall.</li>
        <li>Weekly: run a full <b>Simulate Oral</b> for each of A, B, C.</li>
      </ul>
      <h3>Sources</h3>
      <p class="muted">Every card cites its origin — SH = 737 System Handbook, FH = Flight Handbook §2.020 Limitations, QRH = Quick Reaction Handbook. Verify in the books; the oral does not require verbatim answers.</p>
      <div class="disclaimer">Personal study aid built from your CQ 2026 materials. Always defer to current Alaska manuals and your instructor. Not a controlled document.</div>
    </div>`;
  $("#back").onclick = renderHome;
}

/* ===================== BOOT ===================== */
const app = document.getElementById("app");

function registerSW() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

// bootApp() is called immediately when the question bank is already present
// (unlocked build), or by lock.js after a correct password unlocks the
// encrypted bank (locked/hosted build).
function bootApp() {
  BANK = window.QUESTION_BANK;
  renderHome();
  registerSW();
}
window.bootApp = bootApp;

if (window.QUESTION_BANK) bootApp();
else registerSW();   // locked build: lock.js will call bootApp() after unlock
