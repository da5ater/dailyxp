#!/usr/bin/env python3
"""Exercise habit input and gentle overdue dispositions in the private production host."""
import json
import sys
import time
from pathlib import Path
import control
import user_journey
from session_flow import settled, capture, ui
from routine_flow import restart, status as form_status
from journey_flow import navigate


def status(run):
    settled(run)
    return json.loads(control.ipc(run, 'habitStatus'))


def command(run, method, value):
    assert control.ipc(run, method, json.dumps(value)) == 'requested'
    settled(run)


def run_flow(run, action="smaller"):
    control.launch(run)
    try:
        initial = status(run)
        user_journey.begin(run, {'habits': initial['projection'], 'planning': initial['planning'],
                                 'sessions': settled(run)['projection'], 'events': initial['events']})
        control.ipc(run, 'open')
        time.sleep(.3)
        today = status(run)['projection']['lastAdvancedDailyXpDate']
        assert status(run)['projection']['habits'] == []
        assert status(run)['planning']['routines'] == []
        assert ui(run)['newHabitButton']['visible']
        capture(run, 'empty-habits')
        control.ipc(run, 'key', 'newHabitButton', 'Return')
        control.ipc(run, 'press', 'Escape')
        assert not form_status(run)['exists']
        assert status(run)['projection']['habits'] == []
        assert ui(run)['newHabitButton']['focus']
        for title in ['Read a page', 'Walk outside with a very long habit name']:
            assert control.ipc(run, 'key', 'newHabitButton', 'Return') == 'pressed'
            assert control.ipc(run, 'key', 'saveHabitButton', 'Return') == 'pressed'
            assert form_status(run)['error'] == 'NAME IS REQUIRED'
            assert control.ipc(run, 'typeText', 'habitNameInput', title) == 'typed'
            if title == 'Read a page':
                for day in range(1, 8): control.ipc(run, 'key', 'habitWeekday' + str(day), 'Space')
                control.ipc(run, 'key', 'saveHabitButton', 'Return')
                assert form_status(run)['error'] == 'CHOOSE AT LEAST ONE WEEKDAY'
                for day in range(1, 8): control.ipc(run, 'key', 'habitWeekday' + str(day), 'Space')
                capture(run, 'habit-form')
                control.ipc(run, 'constrainPanel', '280')
                control.ipc(run, 'key', 'habitNameInput', 'Tab')
                for _ in range(7): control.ipc(run, 'press', 'Tab')
                narrow_form = form_status(run)
                save = next(item for item in narrow_form['items'] if item['name'] == 'saveHabitButton')
                assert save['focus']
                assert save['y'] + save['height'] <= narrow_form['viewport']['y'] + narrow_form['viewport']['height']
                assert all(item['x'] >= 0 and item['x'] + item['width'] <= 280 for item in narrow_form['items'])
                capture(run, 'habit-form-narrow')
                control.ipc(run, 'constrainPanel', '388')
                state_dir = run / 'state/dailyxp'
                state_dir.chmod(0o555)
                try:
                    control.ipc(run, 'key', 'saveHabitButton', 'Return')
                    for _ in range(100):
                        failed = json.loads(control.ipc(run, 'routineStatus'))
                        if failed['error']: break
                        time.sleep(.05)
                    assert failed['exists'] and failed['error'] and failed['name'] == title
                    assert not json.loads(control.ipc(run, 'habitStatus'))['projection']['habits']
                    from commitment_flow import diagnostic_capture
                    diagnostic_capture(run, 'failed-habit-create')
                finally:
                    state_dir.chmod(0o755)
                for _ in range(100):
                    if json.loads(control.ipc(run, 'routineStatus'))['recordingReady']: break
                    time.sleep(.05)
            control.ipc(run, 'key', 'saveHabitButton', 'Return')
            control.ipc(run, 'press', 'Return')
            settled(run)
            for _ in range(50):
                if not form_status(run)['exists']: break
                time.sleep(.05)
            if form_status(run)['exists']:
                assert form_status(run)['name'] == ''
                control.ipc(run, 'press', 'Escape')
            assert not form_status(run)['exists']
        assert len(status(run)['projection']['habits']) == 2
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
        navigate(run, 'Setup')
        for title, minutes in [('A larger commitment', '30'), ('Read Ruby', '10')]:
            control.ipc(run, 'key', 'newRoutineButton', 'Return')
            control.ipc(run, 'typeText', 'routineNameInput', title)
            control.ipc(run, 'typeText', 'routineMinutesInput', minutes)
            control.ipc(run, 'key', 'routineCarryoverToggle', 'Space')
            capture(run, 'carryover-form')
            control.ipc(run, 'key', 'saveRoutineButton', 'Return')
            settled(run)
            for _ in range(50):
                if not form_status(run)['exists']: break
                time.sleep(.05)
            assert not form_status(run)['exists']
        assert all(r['carryover'] for r in status(run)['planning']['routines'])
        state_dir = run / 'state/dailyxp'
        state_dir.chmod(0o555)
        try:
            control.ipc(run, 'key', 'setupCarryover0', 'Space')
            for _ in range(100):
                failed = json.loads(control.ipc(run, 'habitStatus'))
                if failed['error']: break
                time.sleep(.05)
            assert failed['error'] and failed['planning']['routines'][0]['carryover']
            from commitment_flow import diagnostic_capture
            diagnostic_capture(run, 'failed-carryover-save')
        finally:
            state_dir.chmod(0o755)
        restart(run)
        navigate(run, 'Setup')
        control.ipc(run, 'key', 'setupCarryover0', 'Space')
        settled(run)
        assert not status(run)['planning']['routines'][0]['carryover']
        assert ui(run)['setupCarryover0']['focus']
        control.ipc(run, 'key', 'setupCarryover0', 'Space')
        settled(run)
        assert status(run)['planning']['routines'][0]['carryover']
        navigate(run, 'Play')
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
        (run / 'report-habits.json').write_text(json.dumps({'passed': True, 'prerequisites': 'created through visible app controls from empty state', 'habits': saved,
            'planning': after['planning'], 'session': session}, indent=2))
    finally:
        control.cleanup(run)


if __name__ == '__main__':
    run_flow(Path(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else 'smaller')
