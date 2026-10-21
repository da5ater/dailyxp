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
        'routines': projections['planning'].get('routines', []),
        'tasks': projections['planning'].get('tasks', []),
        'occurrences': projections['planning'].get('occurrences', []),
        'sessions': projections['sessions'].get('sessions', []),
    }
    if any(collections.values()) or projections['sessions'].get('activeSession'):
        raise RuntimeError('User journey must start from empty disposable progress')


def begin(run, projections):
    require_empty(projections)
    (run / 'user-journey.json').write_text(json.dumps({
        'start': 'empty disposable progress', 'prerequisites': 'visible product controls',
    }))


def check(run, method):
    if (run / 'user-journey.json').exists() and method in FORBIDDEN:
        raise RuntimeError(f'User-journey delivery forbids {method}; create prerequisites through visible product controls')
