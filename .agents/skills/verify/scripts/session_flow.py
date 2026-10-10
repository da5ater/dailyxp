#!/usr/bin/env python3
"""Exercise real rail controls and hard-kill replay against disposable on-disk state."""
import argparse
import json
import os
import signal
import subprocess
import sys
from datetime import datetime
from pathlib import Path
import time
import control


def settled(run):
    for _ in range(100):
        try:
            return control.doctor(run)
        except RuntimeError:
            time.sleep(.05)
    raise RuntimeError('Session state never settled')


def ui(run):
    settled(run)
    return json.loads(control.ipc(run, 'ui'))


def capture(run, label):
    settled(run)
    for method in ['sessionStatus', 'ui']:
        (run / f'{label}-{method}.json').write_text(control.ipc(run, method) + '\n')
    path = run / f'{label}.png'
    assert control.ipc(run, 'capturePanel', str(path)) == 'requested'
    for _ in range(100):
        if control.ipc(run, 'captureStatus') == 'saved' and path.stat().st_size > 0:
            return
        time.sleep(.05)
    raise RuntimeError('Screenshot missing')


def activate(run, name, key=None):
    settled(run)
    response = control.ipc(run, 'key', name, key) if key else control.ipc(run, 'click', name)
    assert response == ('pressed' if key else 'clicked'), response
    return settled(run)['projection']


def seconds(text):
    hours, minutes, value = map(int, text.split(':'))
    return hours * 3600 + minutes * 60 + value


def run_flow(run):
    control.launch(run, seed=True, slow_init=True)
    try:
        for action in ['launch', 'restart']:
            rejected = subprocess.run([sys.executable, str(Path(control.__file__)), action, str(run)],
                                      text=True, capture_output=True)
            assert rejected.returncode != 0, 'Existing live host must be protected'
            settled(run)
        control.ipc(run, 'open')
        capture(run, 'idle')
        assert ui(run)['startSessionButton']['enabled']
        started = activate(run, 'startSessionButton', 'Return')['activeSession']
        assert started['status'] == 'running' and started['taskId'] == 'verify-commitment'
        assert started['plannedMinutes'] is None
        start_id = started['id']
        before = seconds(ui(run)['sessionTimer']['text'])
        time.sleep(2.2)
        assert seconds(ui(run)['sessionTimer']['text']) > before
        capture(run, 'running')
        metadata = json.loads((run / 'instance.json').read_text())
        os.kill(metadata['pid'], signal.SIGKILL)
        with (run / 'actions.jsonl').open('a') as log:
            log.write(json.dumps({'action': 'SIGKILL', 'pid': metadata['pid'], 'at': time.time()}) + '\n')
        time.sleep(.3)
        control.launch(run, restart=True)
        control.ipc(run, 'open')
        replayed = settled(run)['projection']['activeSession']
        assert replayed['id'] == start_id and replayed['status'] == 'running'
        assert replayed['startedAtUtc'] == started['startedAtUtc']
        assert replayed['segments'] == started['segments']
        assert seconds(ui(run)['sessionTimer']['text']) >= before + 2
        capture(run, 'reopened')
        paused = activate(run, 'pauseSessionButton')['activeSession']
        assert paused['status'] == 'paused'
        paused_text = ui(run)['sessionTimer']['text']
        time.sleep(2.2)
        assert ui(run)['sessionTimer']['text'] == paused_text
        assert ui(run)['pauseSessionButton']['text'] == 'RESUME'
        capture(run, 'paused')
        control.ipc(run, 'key', 'pauseSessionButton', 'Tab')
        assert ui(run)['finishSessionButton']['focus'], 'Tab must reach Finish with visible focus'
        capture(run, 'keyboard-focus')
        assert control.ipc(run, 'key', 'finishSessionButton', 'Escape') == 'pressed'
        assert not ui(run)['panelOpened'], 'Escape from a session control must close the panel'
        control.ipc(run, 'open')
        resumed = activate(run, 'pauseSessionButton', 'Space')['activeSession']
        assert resumed['status'] == 'running'
        time.sleep(1.2)
        finished = activate(run, 'finishSessionButton', 'Return')
        assert finished['activeSession'] is None and len(finished['sessions']) == 1
        result = finished['sessions'][0]
        assert result['id'] == start_id and result['focusedMilliseconds'] > paused['focusedMilliseconds']
        focused = sum((datetime.fromisoformat(segment['endedAtUtc']) -
                       datetime.fromisoformat(segment['startedAtUtc'])).total_seconds() * 1000
                      for segment in result['segments'])
        assert abs(result['focusedMilliseconds'] - focused) < .01, 'Replay double counted time'
        assert sum(day['milliseconds'] for day in result['dailySlices']) == result['focusedMilliseconds']
        assert ui(run)['sessionResult']['visible']
        capture(run, 'finished')
        for label in ['idle', 'running', 'paused', 'keyboard-focus', 'finished']:
            snapshot = json.loads((run / f'{label}-ui.json').read_text())
            width = snapshot['dailyxpShell']['width']
            for name in ['startSessionButton', 'pauseSessionButton', 'finishSessionButton', 'sessionTimer']:
                item = snapshot[name]
                if item['visible']:
                    assert item['x'] >= 0 and item['x'] + item['width'] <= width, (label, name, item)
        raw = json.loads((run / 'state/dailyxp/state.json').read_text())
        journal = json.loads(raw['payload']['eventJournalRaw'])
        events = [event for event in journal['events'] if event['type'].startswith('session.')]
        assert [event['type'] for event in events] == [
            'session.started', 'session.paused', 'session.resumed', 'session.finished']
        report = {'passed': True, 'sessionId': start_id,
                  'focusedMilliseconds': result['focusedMilliseconds'],
                  'focusedMinutes': result['focusedMilliseconds'] / 60000,
                  'hardKillRunningReplay': True, 'pausedTimerFrozen': True,
                  'keyboardStartResumeFinish': True, 'tabToFinish': True,
                  'visibleControlsWithinWidth': True,
                  'journalTransitions': [event['type'] for event in events],
                  'host': 'private headless Wayland with production widget, panel and StateStore',
                  'displayIsolation': json.loads((run / 'display.json').read_text())}
        (run / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    finally:
        control.cleanup(run)
    assert (run / 'report.json').exists() and (run / 'persisted-state/dailyxp/state.json').exists()
    print((run / 'report.json').read_text())


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('evidence', type=Path)
    run_flow(parser.parse_args().evidence.resolve())
