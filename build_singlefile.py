#!/usr/bin/env python3
"""Inline the PWA (app/) into one self-contained HTML file that runs by just
opening it — no server, no hosting, fully offline. Output: 737-CQ-Study.html"""
import base64, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(ROOT, "app")

def read(p):
    with open(os.path.join(APP, p), encoding="utf-8") as f: return f.read()

css   = read("css/styles.css")
data  = read("js/data.js")
srs   = read("js/srs.js")
appjs = read("js/app.js")
# The SW registration in app.js is already guarded by a location.protocol
# check, so it self-skips under file:// — no need to strip it for the
# single-file build.

with open(os.path.join(APP, "icons/icon-180.png"), "rb") as f:
    icon180 = base64.b64encode(f.read()).decode()

html = f"""<!DOCTYPE html>
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
<link rel="apple-touch-icon" href="data:image/png;base64,{icon180}" />
<style>{css}</style>
</head>
<body>
<main id="app"></main>
<script>{data}</script>
<script>{srs}</script>
<script>{appjs}</script>
</body>
</html>
"""

out = os.path.join(ROOT, "737-CQ-Study.html")
with open(out, "w", encoding="utf-8") as f: f.write(html)
print(f"wrote {out}  ({len(html)//1024} KB)")
