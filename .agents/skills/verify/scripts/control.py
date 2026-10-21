#!/usr/bin/env python3
"""Isolated Quattro host and production DailyXP IPC driver."""
import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time
import display

REPO = Path(__file__).resolve().parents[4]
TARGET = 'io.github.da5ater.dailyxp'


def ipc(run, method, *args):
    metadata = json.loads((run / 'instance.json').read_text())
    target = 'dailyxp-verify' if method in ['ready', 'readiness', 'click', 'key', 'ui', 'capturePanel', 'captureStatus', 'typeText', 'formStatus', 'press', 'planningStatus', 'seedGoal', 'journeyStatus', 'seedTimedSession', 'constrainPanel', 'routineStatus', 'planningCommand', 'habitCommand', 'habitStatus', 'hold'] else TARGET
    command = ['quickshell', 'ipc', '--pid', str(metadata['pid']), 'call', target, method, *args]
    result = subprocess.run(command, text=True, capture_output=True, env=display.environment(run))
    with (run / 'actions.jsonl').open('a') as log:
        log.write(json.dumps({'at': time.time(), 'command': command, 'stdout': result.stdout,
                              'stderr': result.stderr, 'exit': result.returncode}) + '\n')
    result.check_returncode()
    return result.stdout.strip()


def doctor(run):
    metadata = json.loads((run / 'instance.json').read_text())
    cmdline = Path(f"/proc/{metadata['pid']}/cmdline").read_bytes().split(b'\0')
    if str(run / 'host/shell.qml').encode() not in cmdline:
        raise RuntimeError('PID no longer belongs to this verification host')
    environ = Path(f"/proc/{metadata['pid']}/environ").read_bytes().split(b'\0')
    if f'XDG_RUNTIME_DIR={run / "runtime"}'.encode() not in environ:
        raise RuntimeError('Display isolation mismatch')
    if f'XDG_STATE_HOME={run / "state"}'.encode() not in environ:
        raise RuntimeError('State isolation mismatch')
    if ipc(run, 'ready') != 'true':
        raise RuntimeError('State service is still loading or saving')
    status = json.loads(ipc(run, 'sessionStatus'))
    if not status.get('available') or status.get('saving') or status.get('error'):
        raise RuntimeError(f'Instance not ready: {status}')
    return status


def launch(run, seed=False, restart=False, slow_init=False, day_offset=0):
    if restart:
        old = json.loads((run / 'instance.json').read_text())
        proc = Path(f"/proc/{old['pid']}/cmdline")
        if proc.exists() and str(run / 'host/shell.qml').encode() in proc.read_bytes().split(b'\0'):
            raise RuntimeError('Crash the owned host before restarting it')
        if not (run / 'state/dailyxp/state.json').exists():
            raise RuntimeError('Restart requires the original disposable saved state')
        if (run / 'host').exists():
            shutil.rmtree(run / 'host')
    else:
        if run.exists():
            raise RuntimeError('Use a new evidence directory for every launch')
        run.mkdir(parents=True)
    host = run / 'host'
    host.mkdir()
    for name in ['Commons', 'Ui']:
        (host / name).symlink_to(Path('/usr/share/omarchy/shell') / name)
    (host / 'app').mkdir()
    for source in [*REPO.glob('*.qml'), *REPO.glob('*.js')]:
        shutil.copy2(source, host / 'app' / source.name)
    for name in ['arcade', 'fonts']:
        if (REPO / name).exists():
            shutil.copytree(REPO / name, host / 'app' / name)
    if (REPO / 'qmldir').exists():
        shutil.copy2(REPO / 'qmldir', host / 'app/qmldir')
    shutil.copy2(Path(__file__).with_name('host.qml'), host / 'shell.qml')
    boundary = host / 'bin'
    boundary.mkdir()
    for name in ['omarchy-shell', 'notify-send']:
        shim = boundary / name
        shim.write_text(f'#!/bin/sh\necho "Verification blocked external desktop command: {name}" >&2\nexit 1\n')
        shim.chmod(0o755)
    if slow_init:
        shim = boundary / 'mkdir'
        shim.write_text('#!/bin/sh\nsleep 0.5\nexec /usr/bin/mkdir "$@"\n')
        shim.chmod(0o755)
    revision = subprocess.check_output(['git', '-C', str(REPO), 'rev-parse', 'HEAD'], text=True).strip()
    (run / 'source.diff').write_text(subprocess.check_output(['git', '-C', str(REPO), 'diff'], text=True))
    env = display.start(run)
    env.update(DAILYXP_VERIFY_DAY_OFFSET=str(day_offset), XDG_STATE_HOME=str(run / 'state'), DAILYXP_VERIFY_SEED='true' if seed else 'false',
               PATH=str(boundary) + os.pathsep + env.get('PATH', ''))
    try:
        with (run / 'shell.log').open('a') as log:
            process = subprocess.Popen(['quickshell', '--no-color', '-p', str(host / 'shell.qml')],
                                       env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    except Exception:
        display.stop(run)
        raise
    try:
        (run / 'instance.json').write_text(json.dumps({'pid': process.pid, 'repo': str(REPO), 'revision': revision}))
    except Exception:
        process.terminate()
        process.wait(timeout=5)
        display.stop(run)
        raise
    try:
        for _ in range(50):
            if process.poll() is not None:
                raise RuntimeError((run / 'shell.log').read_text())
            try:
                doctor(run)
                return
            except (RuntimeError, subprocess.CalledProcessError, json.JSONDecodeError):
                time.sleep(.2)
        raise RuntimeError('Readiness timeout: ' + ipc(run, 'readiness'))
    except Exception:
        cleanup(run)
        raise


def cleanup(run):
    metadata = json.loads((run / 'instance.json').read_text())
    pid = metadata['pid']
    proc = Path(f'/proc/{pid}/cmdline')
    if proc.exists() and str(run / 'host/shell.qml').encode() in proc.read_bytes().split(b'\0'):
        os.kill(pid, signal.SIGTERM)
        for _ in range(30):
            if not proc.exists() or not proc.read_bytes():
                break
            time.sleep(.1)
        else:
            raise RuntimeError('Host did not stop; inspect owned PID')
    for name in ['host', 'state']:
        path = run / name
        if path.exists():
            if name == 'state':
                shutil.copytree(path, run / 'persisted-state', dirs_exist_ok=True)
            shutil.rmtree(path)
    display.stop(run)
    (run / 'cleanup.json').write_text(json.dumps({'pid': pid, 'stopped': True}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['launch', 'doctor', 'call', 'capture', 'crash', 'restart', 'cleanup'])
    parser.add_argument('run', type=Path)
    parser.add_argument('arguments', nargs='*')
    parser.add_argument('--seed', action='store_true')
    parser.add_argument('--slow-init', action='store_true')
    args = parser.parse_args()
    run = args.run.resolve()
    if args.action in ['launch', 'restart']:
        launch(run, args.seed, args.action == 'restart', args.slow_init)
    elif args.action == 'crash':
        doctor(run)
        metadata = json.loads((run / 'instance.json').read_text())
        os.kill(metadata['pid'], signal.SIGKILL)
        for _ in range(30):
            proc = Path(f"/proc/{metadata['pid']}/cmdline")
            if not proc.exists() or not proc.read_bytes():
                break
            time.sleep(.1)
        else:
            raise RuntimeError('Killed host is still present')
        with (run / 'actions.jsonl').open('a') as log:
            log.write(json.dumps({'at': time.time(), 'action': 'SIGKILL', 'pid': metadata['pid']}) + '\n')
    elif args.action == 'doctor':
        print(json.dumps(doctor(run)))
    elif args.action == 'call':
        doctor(run)
        print(ipc(run, *args.arguments))
    elif args.action == 'capture':
        doctor(run)
        label = args.arguments[0]
        if not label.replace('-', '').replace('_', '').isalnum():
            raise RuntimeError('Capture label must be alphanumeric')
        for method in ['sessionStatus', 'uxStatus', 'progressionStatus', 'storyStatus', 'recoveryStatus']:
            (run / f'{label}-{method}.json').write_text(ipc(run, method) + '\n')
        (run / f'{label}-ui.json').write_text(ipc(run, 'ui') + '\n')
        if ipc(run, 'capturePanel', str(run / f'{label}.png')) != 'requested':
            raise RuntimeError('Rendered panel is not available for capture')
        for _ in range(50):
            if ipc(run, 'captureStatus') == 'saved' and (run / f'{label}.png').stat().st_size > 0:
                break
            time.sleep(.1)
        else:
            raise RuntimeError('Panel image capture timed out')
    else:
        cleanup(run)


if __name__ == '__main__':
    main()
