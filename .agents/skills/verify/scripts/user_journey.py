"""Reject engine-only setup while verifying a feature's product entry path."""
import json


FORBIDDEN = frozenset({
    'habitCommand', 'planningCommand', 'sessionCommand', 'progressionCommand',
    'seedGoal', 'seedTimedSession', 'addProbe',
})


def require_empty(projections):
    collections = {
        'habits': projections['habits'].get('habits', []),
        'completions': projections['habits'].get('completions', []),
        'skips': projections['habits'].get('skips', []),
        'freezes': projections['habits'].get('freezes', []),
        'goals': projections['planning'].get('goals', []),
        'milestones': projections['planning'].get('milestones', []),
        'proposals': projections['planning'].get('proposals', []),
        'routines': projections['planning'].get('routines', []),
        'tasks': projections['planning'].get('tasks', []),
        'occurrences': projections['planning'].get('occurrences', []),
        'sessions': projections['sessions'].get('sessions', []),
    }
    if any(collections.values()) or projections['sessions'].get('activeSession'):
        raise RuntimeError('User journey must start from empty disposable progress')
    for event in projections.get('events', []):
        if event['type'] not in {'planning.day.advanced', 'habit.day.advanced'}:
            raise RuntimeError('User journey must start before domain or preference history is created')


def begin(run, projections):
    require_empty(projections)
    (run / 'user-journey.json').write_text(json.dumps({
        'start': 'empty disposable progress', 'prerequisites': 'visible product controls',
    }))


def check(run, method):
    if (run / 'user-journey.json').exists() and method in FORBIDDEN:
        raise RuntimeError(f'User-journey delivery forbids {method}; create prerequisites through visible product controls')
