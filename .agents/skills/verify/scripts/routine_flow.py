#!/usr/bin/env python3
"""Create a routine by input, persist occurrences and restart across a private planning-clock boundary."""
import argparse
import json
import os
import signal
import time
from pathlib import Path
import control
from session_flow import settled, activate, capture, ui
from journey_flow import navigate
from commitment_flow import diagnostic_capture


def status(run):
    settled(run)
    return json.loads(control.ipc(run,'routineStatus'))


def restart(run, day_offset=0):
    metadata=json.loads((run/'instance.json').read_text())
    os.kill(metadata['pid'],signal.SIGKILL)
    time.sleep(.3)
    control.launch(run,restart=True,day_offset=day_offset)
    control.ipc(run,'open')
    time.sleep(.3)


def run_flow(run):
    control.launch(run)
    try:
        control.ipc(run,'open')
        time.sleep(.3)
        navigate(run,'Setup')
        capture(run,'empty-routines')
        activate(run,'newRoutineButton','Return')
        activate(run,'saveRoutineButton','Return')
        assert status(run)['error']=='NAME IS REQUIRED'
        title='Study backend Ruby with a long routine name for layout'
        assert control.ipc(run,'typeText','routineNameInput',title)=='typed'
        for day in range(1,8): activate(run,f'routineWeekday{day}','Space')
        activate(run,'saveRoutineButton','Return')
        assert status(run)['error']=='CHOOSE AT LEAST ONE WEEKDAY'
        for day in range(1,8): activate(run,f'routineWeekday{day}','Return')
        control.ipc(run,'typeText','routineMinutesInput','12x')
        activate(run,'saveRoutineButton','Return')
        assert status(run)['error']=='MINUTES MUST BE 1–1440'
        control.ipc(run,'typeText','routineMinutesInput','120')
        capture(run,'routine-form')
        control.ipc(run,'key','saveRoutineButton','Return')
        control.ipc(run,'press','Return')
        for _ in range(100):
            saved=status(run)
            if not saved['exists'] or (len(saved['projection']['routines'])==1 and not saved['pendingId']):break
            time.sleep(.05)
        if saved['exists']:
            assert saved['name']=='', 'Successful save must dismiss the submitted form'
            control.ipc(run,'press','Escape')
            saved=status(run)
        assert not saved['exists']
        plan=saved['projection']
        assert len(plan['routines'])==1 and len(plan['occurrences'])==1
        assert len(plan['tasks'])==0
        occurrence=plan['occurrences'][0]
        assert occurrence['title']==title and occurrence['expectedMinutes']==120
        assert title in ui(run)['setupRoutine0']['text']
        capture(run,'saved-routine-list')
        navigate(run,'Play')
        assert ui(run)['railCommitmentTitle']['text']==title
        assert 'routine today' in ui(run)['railCommitmentDetail']['text']
        capture(run,'today-routine')
        started=activate(run,'startSessionButton','Return')['activeSession']
        assert started['taskId']==occurrence['id']
        activate(run,'finishSessionButton','Return')
        restart(run)
        assert len(status(run)['projection']['occurrences'])==1
        restart(run,day_offset=1)
        next_plan=status(run)['projection']
        assert len(next_plan['routines'])==1 and len(next_plan['occurrences'])==2
        tomorrow=next_plan['occurrences'][-1]
        assert tomorrow['dailyXpDate']>occurrence['dailyXpDate']
        assert tomorrow['occurrenceKey']!=occurrence['occurrenceKey']
        assert ui(run)['railCommitmentTitle']['text']==title
        capture(run,'next-day-routine')
        restart(run,day_offset=1)
        assert status(run)['projection']==next_plan
        navigate(run,'Setup')
        activate(run,'newRoutineButton','Space')
        control.ipc(run,'constrainPanel','280')
        control.ipc(run,'typeText','routineNameInput',title)
        for _ in range(8):control.ipc(run,'press','Tab')
        narrow=status(run)
        assert next(item for item in narrow['items'] if item['name']=='routineMinutesInput')['focus']
        control.ipc(run,'press','Backtab')
        assert next(item for item in status(run)['items'] if item['name']=='routineWeekday7')['focus']
        control.ipc(run,'press','Tab')
        control.ipc(run,'press','Tab')
        narrow=status(run)
        save=next(item for item in narrow['items'] if item['name']=='saveRoutineButton')
        assert save['focus'] and save['y']+save['height']<=narrow['viewport']['y']+narrow['viewport']['height']
        assert all(item['x']>=0 and item['x']+item['width']<=280 for item in narrow['items'])
        capture(run,'narrow-routine-form')
        state_dir=run/'state/dailyxp'
        state_dir.chmod(0o555)
        try:
            control.ipc(run,'press','Return')
            for _ in range(100):
                failed=json.loads(control.ipc(run,'routineStatus'))
                if failed['error']:break
                time.sleep(.05)
            assert failed['exists'] and failed['error'] and failed['name']==title
            assert len(failed['projection']['routines'])==1
            diagnostic_capture(run,'failed-routine-save')
        finally:
            state_dir.chmod(0o755)
        for _ in range(100):
            if json.loads(control.ipc(run,'routineStatus'))['recordingReady']:break
            time.sleep(.05)
        control.ipc(run,'key','saveRoutineButton','Return')
        for _ in range(100):
            if not status(run)['exists']:break
            time.sleep(.05)
        assert len(status(run)['projection']['routines'])==2

        control.ipc(run,'press','Escape')
        assert not status(run)['exists']
        report={'passed':True,'inputValidation':True,'keyboardWeekdays':True,'rapidSaveNoDuplicate':True,
                'todayOccurrencePersisted':True,'routineSessionLink':True,'restartReplay':True,
                'nextDayGeneratedOnRestart':True,'sameDayRestartNoDuplicate':True,'narrowForm':True,'failedSaveRetainsInput':True,'retrySucceeds':True}
        (run/'report-routine.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps(report,indent=2))
    finally:
        control.cleanup(run)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('run',type=Path)
    run_flow(parser.parse_args().run)
