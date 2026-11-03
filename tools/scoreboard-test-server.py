#!/usr/bin/env python3
"""A tiny fake scoreboard server, for testing the shared board on your own computer only (FEAT-016).

It follows docs/scoreboard-api.md and keeps the entries in memory (they are gone when it stops).
It is not part of the site: nothing links to it, and GitHub Pages can't run it.

    python3 tools/scoreboard-test-server.py          # listens on http://localhost:8787/
    python3 tools/scoreboard-test-server.py 9000     # another port

Then put 'http://localhost:8787/' into safari/board-config.js (only on your computer, don't push it).
"""
import json, sys, time, re
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

MAX_SCORE = {'canyon': 15000, 'jungle': 15000}   # the same limits as safari/leaderboard.js
NAME = re.compile(r'^[A-ZÄÖÜ]{1,5}$')
PER_HOUR = 6                                      # entries per address per hour
KEEP = 10                                         # kept per route

boards = {r: [] for r in MAX_SCORE}               # route -> [{name, score, date}]
seen_runs = set()
recent = {}                                        # address -> [times of its saves]


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        route = (parse_qs(urlparse(self.path).query).get('route') or [''])[0]
        if route not in boards:
            return self._send(400, {'ok': False, 'reason': 'unknown route'})
        self._send(200, {'entries': boards[route]})

    def do_POST(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
            data = json.loads(self.rfile.read(min(n, 2000)).decode('utf-8'))
            route, name, score, run = data.get('route'), data.get('name'), data.get('score'), data.get('runId')
        except Exception:
            return self._send(400, {'ok': False, 'reason': 'not readable'})
        if route not in MAX_SCORE:
            return self._send(400, {'ok': False, 'reason': 'unknown route'})
        if not isinstance(name, str) or not NAME.match(name):
            return self._send(400, {'ok': False, 'reason': 'name'})
        if not isinstance(score, int) or isinstance(score, bool) or score < 0 or score > MAX_SCORE[route]:
            return self._send(400, {'ok': False, 'reason': 'score'})
        if not isinstance(run, str) or not (8 <= len(run) <= 64) or run in seen_runs:
            return self._send(409, {'ok': False, 'reason': 'run already saved'})
        now = time.time()
        who = self.client_address[0]
        recent[who] = [t for t in recent.get(who, []) if now - t < 3600]
        if len(recent[who]) >= PER_HOUR:
            return self._send(429, {'ok': False, 'reason': 'too many'})
        recent[who].append(now)
        seen_runs.add(run)
        boards[route].append({'name': name, 'score': score, 'date': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')})
        boards[route].sort(key=lambda e: -e['score'])      # stable: a new run goes below equal scores
        del boards[route][KEEP:]
        self._send(200, {'ok': True})

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    print(f'Fake scoreboard on http://localhost:{port}/ (Ctrl+C stops it)')
    ThreadingHTTPServer(('', port), Handler).serve_forever()
