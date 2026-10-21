#!/usr/bin/env python3
"""Serve an illustrated click guide. Application interaction stays in DailyXP."""
import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path


def serve(page, port):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(page.read_bytes())

        def log_message(self, *_):
            pass

    server = HTTPServer(('127.0.0.1', port), Handler)
    print('Click guide: http://127.0.0.1:' + str(server.server_port), flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('page', type=Path)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    serve(args.page.resolve(), args.port)
