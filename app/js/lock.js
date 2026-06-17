/* ============================================================================
 *  lock.js — password gate for the hosted/shared build.
 *
 *  The question bank is shipped ENCRYPTED (data.locked.js → window.LOCKED_BANK)
 *  so the proprietary content is not exposed on the public GitHub Pages URL.
 *  A shared password decrypts it client-side.
 *
 *  Crypto (must match build_locked.py exactly):
 *    key   = PBKDF2-HMAC-SHA256(password, salt, iters, 32 bytes)
 *    ks_i  = HMAC-SHA256(key, salt || uint32_be(i))      (32-byte blocks)
 *    pt    = ct XOR ks
 *    check = HMAC-SHA256(key, "verify")  (first 32 hex chars)
 *
 *  This is deterrent-grade protection for sharing among trusted people — it
 *  keeps the content off the open web, not a guarantee against a determined
 *  attacker who has the password.
 * ==========================================================================*/

(function () {
  // Unlocked build already has the bank — nothing to do.
  if (window.QUESTION_BANK || !window.LOCKED_BANK) return;

  const C = window.CryptoJS;
  const L = window.LOCKED_BANK;
  const SESSION_KEY = "ak737cq.unlock.v1";

  function deriveKey(pw, saltWA) {
    return C.PBKDF2(pw, saltWA, { keySize: 8, iterations: L.iters, hasher: C.algo.SHA256 });
  }

  function keystream(keyWA, saltWA, nBytes) {
    let out = C.lib.WordArray.create();
    let c = 0;
    while (out.sigBytes < nBytes) {
      const counter = C.lib.WordArray.create([c | 0], 4);
      const msg = saltWA.clone().concat(counter);
      out = out.concat(C.HmacSHA256(msg, keyWA));
      c++;
    }
    out.sigBytes = nBytes;
    out.clamp();
    return out;
  }

  function xorWA(ctWA, ksWA) {
    const words = [];
    const n = Math.ceil(ctWA.sigBytes / 4);
    for (let i = 0; i < n; i++) words[i] = (ctWA.words[i] ^ ksWA.words[i]) | 0;
    return C.lib.WordArray.create(words, ctWA.sigBytes);
  }

  // returns the decrypted bank JS text, or null on wrong password
  function tryDecrypt(pw) {
    const saltWA = C.enc.Base64.parse(L.salt);
    const keyWA = deriveKey(pw, saltWA);
    const check = C.HmacSHA256("verify", keyWA).toString().slice(0, 32);
    if (check !== L.check) return null;
    const ctWA = C.enc.Base64.parse(L.ct);
    const ks = keystream(keyWA, saltWA, ctWA.sigBytes);
    const ptWA = xorWA(ctWA, ks);
    return C.enc.Utf8.stringify(ptWA);
  }

  function runBank(jsText) {
    // executes "window.QUESTION_BANK = {...}"
    (0, eval)(jsText);
    if (!window.QUESTION_BANK) throw new Error("bank failed to load");
    window.bootApp();
  }

  function unlock(pw, onError) {
    let jsText;
    try { jsText = tryDecrypt(pw); }
    catch (e) { onError("Something went wrong unlocking. Try again."); return; }
    if (!jsText) { onError("Incorrect password."); return; }
    try {
      sessionStorage.setItem(SESSION_KEY, pw);
      runBank(jsText);
    } catch (e) {
      sessionStorage.removeItem(SESSION_KEY);
      onError("Couldn't load the content. Try again.");
    }
  }

  function renderLogin(prefillError) {
    const app = document.getElementById("app");
    app.innerHTML = `
      <div class="lock-screen">
        <div class="lock-icon">🔒</div>
        <div class="lock-kicker">Alaska Airlines · 737 CQ</div>
        <h1 class="lock-title">CQ 2026 Oral Prep</h1>
        <p class="lock-sub">Enter the access password to continue.</p>
        <form id="lockform" autocomplete="off">
          <input id="pw" type="password" inputmode="text" autocomplete="current-password"
                 placeholder="Password" aria-label="Password" />
          <button class="primary big" id="unlockbtn" type="submit">Unlock</button>
        </form>
        <div class="lock-err" id="lockerr" ${prefillError ? "" : "hidden"}>${prefillError || ""}</div>
        <div class="lock-foot">Private study aid. Share the password only with trusted colleagues.</div>
      </div>`;

    const err = document.getElementById("lockerr");
    const pw = document.getElementById("pw");
    const btn = document.getElementById("unlockbtn");
    pw.focus();

    document.getElementById("lockform").addEventListener("submit", (e) => {
      e.preventDefault();
      const val = pw.value.trim();
      if (!val) return;
      err.hidden = true;
      btn.textContent = "Unlocking…";
      btn.disabled = true;
      // let the UI paint before the (brief) PBKDF2 work
      setTimeout(() => unlock(val, (msg) => {
        btn.textContent = "Unlock";
        btn.disabled = false;
        err.textContent = msg;
        err.hidden = false;
        pw.select();
      }), 30);
    });
  }

  // Auto-unlock within the same session so you don't retype constantly.
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (saved) {
    const jsText = (() => { try { return tryDecrypt(saved); } catch (e) { return null; } })();
    if (jsText) { try { runBank(jsText); return; } catch (e) { /* fall through */ } }
    sessionStorage.removeItem(SESSION_KEY);
  }
  renderLogin();
})();
