#!/usr/bin/env python3
"""Serve a local review page and an explicitly started disposable DailyXP preview."""
import argparse
import atexit
import json
import signal
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import tempfile
import time
import control
from session_flow import settled
from commitment_flow import diagnostic_capture


class Preview:
    def __init__(self):
        self.run = None
        self.last_used = time.monotonic()

    def stop(self):
        if self.run is not None:
            control.cleanup(self.run)
            self.run = None

    def start(self):
        if self.run is None:
            parent = Path(tempfile.mkdtemp(prefix='dailyxp-review-'))
            run = parent / 'preview'
            control.launch(run)
            self.run = run
            control.ipc(run, 'open')
            time.sleep(.3)
            self.navigate('Setup')

    def navigate(self, surface):
        control.ipc(self.run, 'key', 'navigate' + surface, 'Return')
        time.sleep(.15)

    def status(self):
        return json.loads(control.ipc(self.run, 'routineStatus'))

    def action(self, data):
        self.last_used = time.monotonic()
        action = data.get('action')
        if action == 'stop':
            self.stop()
            return {'message': 'Private preview stopped. Personal state was untouched.', 'running': False}
        if action == 'reset':
            self.stop()
            self.start()
        elif action == 'start':
            self.start()
        elif self.run is None:
            raise ValueError('Start the private preview first.')
        elif action == 'navigate':
            surface = data.get('surface')
            if surface not in ['Setup', 'Play']:
                raise ValueError('Choose SETUP or PLAY.')
            if self.status()['exists']:
                control.ipc(self.run, 'press', 'Escape')
            self.navigate(surface)
        elif action == 'create':
            title = data.get('title', '')
            minutes = data.get('minutes', '')
            days = data.get('days', [])
            if not isinstance(title, str) or len(title) > 60 or not isinstance(minutes, str) or len(minutes) > 4:
                raise ValueError('Use a name of up to 60 characters and at most four duration characters.')
            if not isinstance(days, list) or any(type(day) is not int or day not in range(1, 8) for day in days):
                raise ValueError('Choose weekdays from Monday through Sunday.')
            self.navigate('Setup')
            if not self.status()['exists']:
                control.ipc(self.run, 'key', 'newRoutineButton', 'Return')
            for name, text in [('routineNameInput', title), ('routineMinutesInput', minutes)]:
                control.ipc(self.run, 'typeText', name, text)
                if not text:
                    control.ipc(self.run, 'key', name, 'Backspace')
            selected = self.status()['weekdays']
            for day in range(1, 8):
                if (day in selected) != (day in days):
                    control.ipc(self.run, 'key', 'routineWeekday' + str(day), 'Space')
            control.ipc(self.run, 'key', 'saveRoutineButton', 'Return')
            for _ in range(100):
                current = self.status()
                if current['error'] or not current['exists']:
                    break
                time.sleep(.05)
            settled(self.run)
        else:
            raise ValueError('Unknown preview action.')
        current = self.status()
        diagnostic_capture(self.run, 'review-preview')
        plan = current['projection']
        return {'running': True, 'error': current['error'], 'routines': len(plan['routines']),
                'occurrences': len(plan['occurrences']), 'date': plan['lastAdvancedDailyXpDate'],
                'message': current['error'] or 'Real DailyXP UI and persistence, on disposable state.'}


def serve(page, port):
    preview = Preview()
    atexit.register(preview.stop)

    class Handler(BaseHTTPRequestHandler):
        def respond(self, status, content, kind):
            self.send_response(status)
            self.send_header('Content-Type', kind)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            self.wfile.write(content)

        def do_GET(self):
            route = self.path.split('?')[0]
            if route == '/':
                self.respond(200, page.read_bytes(), 'text/html; charset=utf-8')
            elif route == '/preview.png' and preview.run:
                self.respond(200, (preview.run / 'review-preview.png').read_bytes(), 'image/png')
            else:
                self.respond(404, b'Not found', 'text/plain')

        def do_POST(self):
            if self.path != '/api' or self.headers.get('Content-Type') != 'application/json':
                self.respond(400, b'JSON request required', 'text/plain')
                return
            origin = self.headers.get('Origin')
            expected = 'http://127.0.0.1:' + str(self.server.server_port)
            if origin is not None and origin != expected:
                self.respond(403, b'Local review origin required', 'text/plain')
                return
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if length < 1 or length > 4096:
                    raise ValueError('Request too large or empty.')
                result = preview.action(json.loads(self.rfile.read(length)))
                self.respond(200, json.dumps(result).encode(), 'application/json')
            except Exception as error:
                self.respond(400, json.dumps({'error': str(error)}).encode(), 'application/json')

        def log_message(self, *_):
            pass

    server = HTTPServer(('127.0.0.1', port), Handler)
    print('Review page: http://127.0.0.1:' + str(server.server_port), flush=True)
    server.timeout = 1
    def terminate(*_):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, terminate)
    try:
        while True:
            server.handle_request()
            if preview.run is not None and time.monotonic() - preview.last_used > 900:
                preview.stop()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        preview.stop()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('page', type=Path)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    serve(args.page.resolve(), args.port)
