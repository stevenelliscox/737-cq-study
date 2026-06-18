#!/usr/bin/env python3
"""
Build the PASSWORD-PROTECTED hosted site into ./docs (GitHub Pages serves from
/docs). The question bank is encrypted so the proprietary content is not exposed
on the public Pages URL; the shared password decrypts it client-side.

Usage:
    python3 build_locked.py "your-shared-password"
    python3 build_locked.py            # reads password.txt (gitignored)

Crypto must match app/js/lock.js exactly:
    key   = PBKDF2-HMAC-SHA256(pw, salt, iters, 32)
    ks_i  = HMAC-SHA256(key, salt || uint32_be(i))   (32-byte blocks)
    pt    = ct XOR ks
    check = HMAC-SHA256(key, "verify")[:32 hex]
"""
import base64, hashlib, hmac, os, shutil, struct, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(ROOT, "app")
DOCS = os.path.join(ROOT, "docs")
ITERS = 150_000


def get_password():
    if len(sys.argv) > 1 and sys.argv[1].strip():
        return sys.argv[1].strip()
    pwfile = os.path.join(ROOT, "password.txt")
    if os.path.exists(pwfile):
        with open(pwfile) as f:
            return f.read().strip()
    sys.exit('No password. Run: python3 build_locked.py "your-password"  (or create password.txt)')


def keystream(key, salt, n):
    out, c = b"", 0
    while len(out) < n:
        out += hmac.new(key, salt + struct.pack(">I", c), hashlib.sha256).digest()
        c += 1
    return out[:n]


def encrypt(plaintext_bytes, password):
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERS, 32)
    ks = keystream(key, salt, len(plaintext_bytes))
    ct = bytes(a ^ b for a, b in zip(plaintext_bytes, ks))
    check = hmac.new(key, b"verify", hashlib.sha256).hexdigest()[:32]
    return {
        "salt": base64.b64encode(salt).decode(),
        "iters": ITERS,
        "ct": base64.b64encode(ct).decode(),
        "check": check,
    }


def read(p):
    with open(os.path.join(APP, p), encoding="utf-8") as f:
        return f.read()


def main():
    pw = get_password()
    bundle = encrypt(read("js/data.js").encode("utf-8"), pw)

    # fresh docs/
    if os.path.exists(DOCS):
        shutil.rmtree(DOCS)
    os.makedirs(os.path.join(DOCS, "js/vendor"))
    os.makedirs(os.path.join(DOCS, "css"))
    os.makedirs(os.path.join(DOCS, "icons"))

    # encrypted bank
    enc_js = (
        "window.LOCKED_BANK = {\n"
        f'  salt: "{bundle["salt"]}",\n'
        f'  iters: {bundle["iters"]},\n'
        f'  check: "{bundle["check"]}",\n'
        f'  ct: "{bundle["ct"]}"\n'
        "};\n"
    )
    with open(os.path.join(DOCS, "js/data.locked.js"), "w") as f:
        f.write(enc_js)

    # copy unchanged assets
    for src, dst in [
        ("js/srs.js", "js/srs.js"),
        ("js/app.js", "js/app.js"),
        ("js/lock.js", "js/lock.js"),
        ("js/vendor/crypto-js.min.js", "js/vendor/crypto-js.min.js"),
        ("css/styles.css", "css/styles.css"),
        ("manifest.webmanifest", "manifest.webmanifest"),
        ("icons/icon-180.png", "icons/icon-180.png"),
        ("icons/icon-192.png", "icons/icon-192.png"),
        ("icons/icon-512.png", "icons/icon-512.png"),
    ]:
        shutil.copy(os.path.join(APP, src), os.path.join(DOCS, dst))

    # locked index.html (script order matters: crypto → enc data → srs → app → lock)
    index = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
  <title>737 CQ Study</title>
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="737 CQ" />
  <meta name="theme-color" content="#0b1220" />
  <link rel="manifest" href="manifest.webmanifest" />
  <link rel="apple-touch-icon" href="icons/icon-180.png" />
  <link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <main id="app"></main>
  <script src="js/vendor/crypto-js.min.js"></script>
  <script src="js/data.locked.js"></script>
  <script src="js/srs.js"></script>
  <script src="js/app.js"></script>
  <script src="js/lock.js"></script>
</body>
</html>
"""
    with open(os.path.join(DOCS, "index.html"), "w") as f:
        f.write(index)

    # service worker (locked asset list, network-first).
    # Cache name is versioned per-build (salt is random each build, so `check`
    # differs every time) → activating the new SW purges the old cache, so a
    # rebuild+deploy always serves fresh files instead of a stale copy.
    version = bundle["check"][:8]
    sw = '''const CACHE = "ak737cq-locked-VERSION";
const ASSETS = ["./","./index.html","./css/styles.css","./js/vendor/crypto-js.min.js",
"./js/data.locked.js","./js/srs.js","./js/app.js","./js/lock.js","./manifest.webmanifest",
"./icons/icon-180.png","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)).catch(()=>{}); return res; })
    .catch(() => caches.match(e.request).then(h => h || caches.match("./index.html"))));
});
'''
    with open(os.path.join(DOCS, "sw.js"), "w") as f:
        f.write(sw.replace("VERSION", version))

    # GitHub Pages: don't run content through Jekyll
    open(os.path.join(DOCS, ".nojekyll"), "w").close()

    print(f"Built locked site → {DOCS}")
    print(f"  password: {'*' * len(pw)}  ({len(pw)} chars)")
    print(f"  encrypted bank: {len(bundle['ct'])//1024} KB (base64)")
    print("  Enable GitHub Pages: Settings → Pages → Source: main / /docs")


if __name__ == "__main__":
    main()
