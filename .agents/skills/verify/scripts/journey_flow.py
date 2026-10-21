#!/usr/bin/env python3
"""Verify earned XP, rendered ledger metadata and restart using disposable state."""
import argparse
import json
import os
import signal
import time
from pathlib import Path
import control
from session_flow import settled, activate, capture, ui


def status(run):
    settled(run)
    return json.loads(control.ipc(run, 'journeyStatus'))


def navigate(run, surface):
    activate(run, 'navigate' + surface, 'Return')
    time.sleep(.2)


def run_flow(run):
    control.launch(run, seed=True)
    try:
        control.ipc(run, 'open')
        time.sleep(.3)
        navigate(run, 'Journey')
        assert ui(run)['journeyLevel']['text'] == 'LV'
        assert ui(run)['journeyXpProgress']['text'] == 'LV 1 → 2 · 0%'
        activate(run, 'journeyXpProgress', 'Return')
        assert status(run)['ledgerOpen'] and status(run)['entries'] == []
        capture(run, 'empty-ledger')
        control.ipc(run, 'press', 'Escape')
        assert not status(run)['ledgerOpen']
        navigate(run, 'Play')
        assert control.ipc(run, 'seedTimedSession', '61') == 'requested'
        settled(run)
        activate(run, 'finishSessionButton', 'Return')
        earned = status(run)
        assert earned['projection']['totals']['lifetimeXp'] == 61
        navigate(run, 'Journey')
        assert ui(run)['journeyXpProgress']['text'] == 'LV 1 → 2 · 12%'
        assert ui(run)['journeyXpProgress']['text'] == 'LV 1 → 2 · 12%'
        assert '1h 1m focused' in ui(run)['journeyWeeklyInsight']['text']
        capture(run, 'earned-journey')
        activate(run, 'journeyXpProgress', 'Space')
        awards = status(run)['entries']
        assert len(awards) == 1 and awards[0]['award']['amount'] == 61
        event = next(e for e in earned['events'] if e['eventId'] == awards[0]['award']['sourceEventId'])
        assert awards[0]['award']['timestamp'] == event['occurredAtUtc']
        assert awards[0]['award']['ruleVersion'] == 1
        control.ipc(run, 'press', 'Tab')
        assert status(run)['entries'][0]['focus']
        assert awards[0]['width'] <= 330
        capture(run, 'earned-ledger')
        control.ipc(run, 'press', 'Escape')
        assert not status(run)['ledgerOpen']
        metadata = json.loads((run/'instance.json').read_text())
        os.kill(metadata['pid'], signal.SIGKILL)
        time.sleep(.3)
        control.launch(run, restart=True)
        control.ipc(run, 'open')
        time.sleep(.3)
        navigate(run, 'Journey')
        assert status(run)['projection'] == earned['projection']
        assert ui(run)['journeyXpProgress']['text'] == 'LV 1 → 2 · 12%'
        activate(run, 'journeyXpProgress', 'Return')
        assert status(run)['entries'][0]['award'] == awards[0]['award']
        capture(run, 'replayed-ledger')
        control.ipc(run, 'press', 'Escape')
        assert ui(run)['journeyXpProgress']['focus']
        for index in range(21):
            assert control.ipc(run, 'progressionCommand', json.dumps({
                'type':'progression.correction','correction':{'id':f'verify-award-{index}',
                'lifetimeXp':30,'seasonXp':0,'reason':'Long award reason ' * 8}})) == 'requested'
            settled(run)
        assert 'LV' == ui(run)['journeyLevel']['text']
        assert status(run)['projection']['level'] == 2
        activate(run, 'journeyXpProgress', 'Return')
        assert len(status(run)['entries']) == 22
        for _ in range(22):
            control.ipc(run, 'press', 'Tab')
        last = status(run)['entries'][-1]
        viewport = status(run)['viewport']
        assert last['focus'] and last['y'] >= viewport['y']
        assert last['y'] + last['height'] <= viewport['y'] + viewport['height']
        capture(run, 'many-awards-focus')
        control.ipc(run, 'constrainPanel', '280')
        time.sleep(.2)
        narrow = status(run)
        entries = narrow['entries']
        assert entries[-1]['focus']
        assert entries[-1]['y'] + entries[-1]['height'] <= narrow['viewport']['y'] + narrow['viewport']['height']
        assert all(entry['x'] >= 0 and entry['x'] + entry['width'] <= 280 for entry in entries)
        capture(run, 'narrow-ledger')
        control.ipc(run, 'press', 'Escape')
        assert '691 XP earned' in ui(run)['journeyWeeklyInsight']['text']
        labels = ui(run)
        journey_label = labels['navigationLabelJourney']
        world_label = labels['navigationLabelWorld']
        assert journey_label['x'] + journey_label['width'] <= world_label['x']
        assert world_label['x'] + world_label['width'] <= 280
        capture(run, 'narrow-journey')
        assert ui(run)['journeyXpProgress']['focus']
        report = {'passed':True,'emptyState':True,'sessionEarnedXp':61,'journalMetadataMatches':True,
                  'keyboardLedger':True,'restartDeterministic':True,'levelAdvance':True,
                  'manyAwardsReachable':True,'longReasonsAndNarrowPanel':True,'focusReturnsToTrigger':True}
        (run/'report-journey.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps(report,indent=2))
    finally:
        control.cleanup(run)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('run',type=Path)
    run_flow(parser.parse_args().run)
