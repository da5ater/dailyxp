#!/usr/bin/env python3
"""Real form regressions: linked saves, modal focus, removal and scrolling."""
import argparse
import json
from pathlib import Path
import time
import control
from session_flow import settled, capture, activate


def read(run, method):
    return json.loads(control.ipc(run, method))


def wait_closed(run):
    for _ in range(100):
        if not read(run, 'formStatus')['exists']:
            settled(run)
            return
        time.sleep(.05)
    raise AssertionError('Form must close after successful task persistence')


def type_field(run, name, value):
    assert control.ipc(run, 'typeText', name, value) == 'typed'


def diagnostic_capture(run, label):
    path = run / f'{label}.png'
    assert control.ipc(run, 'capturePanel', str(path)) == 'requested'
    for _ in range(100):
        if control.ipc(run, 'captureStatus') == 'saved' and path.stat().st_size > 0: return
        time.sleep(.05)
    raise AssertionError('Screenshot must finish saving')


def run_flow(run):
    control.launch(run, seed=True)
    try:
        control.ipc(run, 'open')
        activate(run, 'startSessionButton', 'Return')
        control.ipc(run, 'click', 'addCommitmentButton')
        goal = 'A long programming course and portfolio study goal'
        type_field(run, 'commitmentNameInput', 'AWS')
        type_field(run, 'commitmentGoalInput', goal)
        type_field(run, 'commitmentMinutesInput', '180')
        before = read(run, 'formStatus')
        assert any('will create goal:' in i['text'] for i in before['items'])
        control.ipc(run, 'press', 'Return')
        control.ipc(run, 'press', 'Return')
        wait_closed(run)
        plan = read(run, 'planningStatus')['projection']
        assert len(plan['tasks']) == 2 and len(plan['goals']) == 1, 'Repeated save must create one linked task'
        task = next(t for t in plan['tasks'] if t['title'] == 'AWS')
        assert task['goalId'] == plan['goals'][0]['id'] and task['estimateMinutes'] == 180
        assert settled(run)['projection']['activeSession']['status'] == 'running'
        capture(run, 'linked-saved')
        control.ipc(run, 'click', 'addCommitmentButton')
        type_field(run, 'commitmentNameInput', 'Draft')
        type_field(run, 'commitmentGoalInput', goal)
        control.ipc(run, 'key', 'clearGoalButton', 'Space')
        form = read(run, 'formStatus')
        assert next(i['text'] for i in form['items'] if i['name'] == 'commitmentGoalInput') != goal
        type_field(run, 'commitmentGoalInput', goal)
        form = read(run, 'formStatus')
        assert any('(reused)' in i['text'] for i in form['items'])
        control.ipc(run, 'key', 'clearNameButton', 'Return')
        assert not any(i['name'] == 'commitmentNameInput' and i['text'] == 'Draft' for i in read(run,'formStatus')['items'])
        control.ipc(run, 'press', 'Space')
        assert settled(run)['projection']['activeSession']['status'] == 'running', 'Form input must not activate Pause'
        type_field(run, 'commitmentNameInput', 'Retry after failed write')
        type_field(run, 'commitmentMinutesInput', '12x')
        control.ipc(run, 'press', 'Return')
        assert read(run,'formStatus')['error'] == 'MINUTES MUST BE 1–1440'
        type_field(run, 'commitmentMinutesInput', '30')
        state_dir = run / 'state/dailyxp'
        state_dir.chmod(0o555)
        try:
            control.ipc(run, 'press', 'Return')
            for _ in range(100):
                if read(run, 'formStatus').get('error'): break
                time.sleep(.05)
            assert read(run, 'formStatus')['exists'] and read(run, 'formStatus')['error']
            assert len(read(run, 'planningStatus')['projection']['tasks']) == 2
            assert not read(run, 'ui')['pauseSessionButton']['focus']
            diagnostic_capture(run, 'write-failed')
            control.ipc(run, 'press', 'Space')
            assert read(run,'sessionStatus')['projection']['activeSession']['status'] == 'running'
        finally:
            state_dir.chmod(0o755)
        control.ipc(run, 'key', 'commitmentMinutesInput', 'Return')
        wait_closed(run)
        assert len(read(run,'planningStatus')['projection']['tasks']) == 3
        control.ipc(run, 'click', 'addCommitmentButton')
        control.ipc(run, 'key', 'closeSheetButton', 'Space')
        assert not read(run,'formStatus')['exists']
        for number in range(20):
            assert control.ipc(run, 'seedGoal', f'fixture-goal-{number}',
                               f'Long learning direction number {number} for a complete course') == 'requested'
            settled(run)
        control.ipc(run, 'click', 'addCommitmentButton')
        type_field(run, 'commitmentNameInput', 'Long form')
        type_field(run, 'commitmentGoalInput', '')
        form = read(run, 'formStatus')
        for item in form['items']:
            if item['name'].startswith('goalChoice-'):
                assert item['x'] >= 0 and item['x'] + item['width'] <= form['width']
        capture(run, 'many-goals-top')
        control.ipc(run, 'key', 'saveCommitmentButton', 'Backtab')
        control.ipc(run, 'key', 'saveCommitmentButton', 'Tab')
        control.ipc(run, 'key', 'saveCommitmentButton', 'Space')
        wait_closed(run)
        control.ipc(run, 'click', 'addCommitmentButton')
        control.ipc(run, 'key', 'commitmentMinutesInput', 'Tab')
        control.ipc(run, 'press', 'Tab')
        form = read(run, 'formStatus')
        save = next(i for i in form['items'] if i['name'] == 'saveCommitmentButton')
        viewport = next(i for i in form['items'] if i['name'] == 'sheetViewport')
        assert save['focus'] and save['y'] >= viewport['y'] and save['y'] + save['height'] <= viewport['y'] + viewport['height']
        capture(run, 'many-goals-save-focus')
        control.ipc(run, 'press', 'Escape')
        assert not read(run,'formStatus')['exists']
        (run / 'report-form.json').write_text(json.dumps({'passed':True,'linkedTaskSave':True,
            'rapidSubmitNoDuplicate':True,'goalPreview':True,'keyboardRemoval':True,
            'failedWriteRetainsForm':True,'retrySucceeds':True,'modalSessionFocusProtected':True,
            'longLabelsBounded':True,'manyGoalsSaveReachable':True},indent=2))
    finally:
        control.cleanup(run)
    print((run / 'report-form.json').read_text())


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('run',type=Path)
    run_flow(parser.parse_args().run.resolve())
