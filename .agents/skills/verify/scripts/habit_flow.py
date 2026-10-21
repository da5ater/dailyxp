#!/usr/bin/env python3
"""Exercise habit input and gentle overdue dispositions in the private production host."""
import json
import sys
import time
from pathlib import Path
import control
from session_flow import settled, capture, ui
from routine_flow import restart


def status(run):
    settled(run)
    return json.loads(control.ipc(run, 'habitStatus'))


def command(run, method, value):
    assert control.ipc(run, method, json.dumps(value)) == 'requested'
    settled(run)


def run_flow(run, action="smaller"):
    control.launch(run)
    try:
        control.ipc(run, 'open')
        time.sleep(.3)
        today = status(run)['projection']['lastAdvancedDailyXpDate']
        for ident in ['read', 'walk']:
            command(run, 'habitCommand', {'type': 'habit.create', 'habit': {
                'id': ident, 'title': 'Read a page' if ident == 'read' else 'Walk outside with a very long habit name',
                'startDate': today, 'schedule': {'type': 'daily'}, 'restDates': []}})
        control.ipc(run, 'key', 'habitChip0', 'Tab')
        control.ipc(run, 'press', 'Backtab')
        assert ui(run)['habitChip0']['focus']
        capture(run, 'habits-before')
        assert ui(run)['habitChip0']['visible']
        state_dir = run / 'state/dailyxp'
        state_dir.chmod(0o555)
        try:
            control.ipc(run, 'click', 'habitChip0')
            for _ in range(100):
                failed = json.loads(control.ipc(run, 'habitStatus'))
                if failed['error']: break
                time.sleep(.05)
            assert failed['error'] and not failed['projection']['completions']
            from commitment_flow import diagnostic_capture
            diagnostic_capture(run, 'failed-habit-save')
        finally:
            state_dir.chmod(0o755)
        restart(run)
        command(run, 'uxCommand', {'type': 'ux.reducedMotion.set', 'enabled': True})
        assert control.ipc(run, 'key', 'habitChip0', 'Space') == 'pressed'
        settled(run)
        assert len(status(run)['projection']['completions']) == 1
        for _ in range(4): control.ipc(run, 'click', 'habitChip0')
        assert len(status(run)['projection']['completions']) == 1
        assert control.ipc(run, 'hold', 'habitChip1') == 'held'
        settled(run)
        saved = status(run)['projection']
        assert len(saved['skips']) == 1 and len(saved['completions']) == 1
        control.ipc(run, 'key', 'habitChip0', 'Escape')
        assert not ui(run)['panelOpened']
        control.ipc(run, 'open')
        control.ipc(run, 'key', 'habitChip1', 'Tab')
        control.ipc(run, 'press', 'Backtab')
        capture(run, 'habits-after')
        restart(run)
        assert status(run)['projection'] == saved
        for ident, minutes in [('long', 30), ('gentle', 10)]:
            command(run, 'planningCommand', {'type': 'routine.create', 'routine': {
                'id': ident, 'title': 'Read Ruby' if ident == 'gentle' else 'A larger commitment',
                'expectedMinutes': minutes, 'startDate': today, 'endDate': None, 'restDates': [],
                'carryover': True, 'schedule': {'type': 'weekdays', 'weekdays': list(range(1, 8))},
                'primarySkill': 'general/focus', 'goalId': None, 'milestoneId': None}})
        restart(run, day_offset=1)
        before = status(run)
        assert len([o for o in before['planning']['occurrences'] if o['status'] == 'overdue']) == 2
        assert ui(run)['gentleSuggestion']['text'].startswith('Read Ruby')
        control.ipc(run, 'key', 'overduesmaller', 'Tab')
        control.ipc(run, 'press', 'Backtab')
        assert ui(run)['overduesmaller']['focus']
        capture(run, 'overdue-before')
        control.ipc(run, 'constrainPanel', '280')
        control.ipc(run, 'key', 'overdueskip', 'Tab')
        control.ipc(run, 'press', 'Backtab')
        narrow = ui(run)
        for name in ['overduesmaller', 'overduereschedule', 'overdueskip']:
            item = narrow[name]
            assert item['x'] >= 0 and item['x'] + item['width'] <= 280
            assert item['y'] >= 0 and item['y'] + item['height'] < 588
        capture(run, 'overdue-narrow')
        control.ipc(run, 'constrainPanel', '388')
        assert control.ipc(run, 'key', 'overdue' + action, 'Return') == 'pressed'
        for _ in range(3): control.ipc(run, 'press', 'Return')
        time.sleep(.3)
        settled(run)
        after = status(run)
        assert after['planning']['lastGentleDispositionDate'] == after['planning']['lastAdvancedDailyXpDate']
        assert not ui(run)['overdueStrip']['visible']
        session = json.loads(control.ipc(run, 'sessionStatus'))['projection']['activeSession']
        if action == 'smaller':
            assert session and session['taskId'].startswith('gentle:')
            replacement = next(o for o in after['planning']['occurrences'] if o['id'] == session['taskId'])
            assert replacement['expectedMinutes'] == 5
        else:
            assert session is None
        assert len([e for e in after['events'] if e['type'] == 'planning.overdue.disposed']) == 1
        capture(run, 'overdue-after')
        restart(run, day_offset=1)
        assert not ui(run)['overdueStrip']['visible']
        assert status(run)['planning'] == after['planning']
        (run / 'report-habits.json').write_text(json.dumps({'passed': True, 'habits': saved,
            'planning': after['planning'], 'session': session}, indent=2))
    finally:
        control.cleanup(run)


if __name__ == '__main__':
    run_flow(Path(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else 'smaller')
