#!/usr/bin/env python3
import http.server, socketserver, functools, os

ROOT = "/Users/steve/Documents/Claude/Projects/737 Study App/app"
PORT = 8753
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
Handler.extensions_map['.webmanifest'] = 'application/manifest+json'

with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"serving {ROOT} at http://127.0.0.1:{PORT}")
    httpd.serve_forever()
