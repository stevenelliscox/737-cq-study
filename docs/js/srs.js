/* ============================================================================
 *  srs.js — Spaced repetition (SM-2 variant) + progress persistence
 *  All state lives in localStorage so it works fully offline and survives
 *  app restarts. No network, ever.
 * ==========================================================================*/

const SRS = (() => {
  const KEY = "ak737cq.progress.v1";
  const DAY = 86400000;

  // grade: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save(state) { localStorage.setItem(KEY, JSON.stringify(state)); }

  function cardState(id) {
    const s = load();
    return s[id] || { ease: 2.5, interval: 0, reps: 0, due: 0, lapses: 0, seen: 0, last: 0 };
  }

  // SM-2 with 4-button mapping tuned for high-stakes recall
  function record(id, grade) {
    const s = load();
    const c = s[id] || { ease: 2.5, interval: 0, reps: 0, due: 0, lapses: 0, seen: 0, last: 0 };
    c.seen += 1;
    c.last = Date.now();

    if (grade === 0) {                 // Again
      c.reps = 0;
      c.lapses += 1;
      c.interval = 0;                  // re-show this session
      c.ease = Math.max(1.3, c.ease - 0.2);
      c.due = Date.now() + 60000;      // ~1 min, comes back today
    } else {
      if (c.reps === 0)      c.interval = grade === 1 ? 1 : grade === 2 ? 1 : 2;
      else if (c.reps === 1) c.interval = grade === 1 ? 2 : grade === 2 ? 4 : 6;
      else                   c.interval = Math.round(c.interval * (grade === 1 ? 1.2 : c.ease));
      c.reps += 1;
      c.ease = Math.min(3.0, Math.max(1.3,
        c.ease + (grade === 1 ? -0.15 : grade === 3 ? 0.10 : 0)));
      c.due = Date.now() + c.interval * DAY;
    }
    s[id] = c;
    save(s);
    return c;
  }

  function isDue(id) {
    const c = cardState(id);
    return c.due <= Date.now();
  }

  // mastery 0..1 for progress rings
  function mastery(id) {
    const c = cardState(id);
    if (c.reps === 0) return 0;
    return Math.min(1, c.interval / 21);   // "mastered" ~ 3-week interval
  }

  function deckStats(deck) {
    let due = 0, seen = 0, mastered = 0;
    for (const card of deck.cards) {
      const c = cardState(card.id);
      if (c.seen > 0) seen++;
      if (isDue(card.id)) due++;
      if (mastery(card.id) >= 0.95) mastered++;
    }
    return { total: deck.cards.length, due, seen, mastered };
  }

  function resetAll() { localStorage.removeItem(KEY); }
  function resetDeck(deck) {
    const s = load();
    for (const card of deck.cards) delete s[card.id];
    save(s);
  }

  // ---- streak tracking ----
  const STREAK = "ak737cq.streak.v1";
  function touchStreak() {
    const today = new Date().toISOString().slice(0, 10);
    let st;
    try { st = JSON.parse(localStorage.getItem(STREAK)) || {}; } catch (e) { st = {}; }
    if (st.lastDay === today) return st;
    const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10);
    st.count = st.lastDay === yesterday ? (st.count || 0) + 1 : 1;
    st.lastDay = today;
    localStorage.setItem(STREAK, JSON.stringify(st));
    return st;
  }
  function streak() {
    try { return (JSON.parse(localStorage.getItem(STREAK)) || {}).count || 0; }
    catch (e) { return 0; }
  }

  return { cardState, record, isDue, mastery, deckStats, resetAll, resetDeck, touchStreak, streak };
})();
