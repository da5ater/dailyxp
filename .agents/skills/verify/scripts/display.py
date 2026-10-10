"""A private headless Wayland compositor; never connects to the user's display."""
import json
import os
from pathlib import Path
import shutil
import signal
import stat
import subprocess
import time

RUNTIME = Path.home() / '.cache/dailyxp-verifier/sway-runtime'


def environment(run):
    display = json.loads((run / 'display.json').read_text())
    env = dict(os.environ)
    for key in ['DISPLAY', 'WAYLAND_DISPLAY', 'HYPRLAND_INSTANCE_SIGNATURE', 'SWAYSOCK',
                'DBUS_SESSION_BUS_ADDRESS', 'QT_QPA_PLATFORM', 'QT_QUICK_BACKEND']:
        env.pop(key, None)
    env.update(XDG_RUNTIME_DIR=str(run / 'runtime'), WAYLAND_DISPLAY=display['socket'],
               QT_QPA_PLATFORM='wayland', QT_QUICK_BACKEND='software',
               DBUS_SESSION_BUS_ADDRESS='unix:path=/nonexistent-dailyxp-verification-bus')
    return env


def start(run):
    if (run / 'display.json').exists():
        metadata = json.loads((run / 'display.json').read_text())
        proc = Path(f"/proc/{metadata['pid']}/cmdline")
        if proc.exists() and str(run / 'sway.conf').encode() in proc.read_bytes().split(b'\0'):
            return environment(run)
        raise RuntimeError('Owned display exited; clean up and start a fresh run')
    sway = shutil.which('sway') or str(RUNTIME / 'usr/bin/sway')
    if not Path(sway).exists():
        raise RuntimeError('Run scripts/setup_headless.py to prepare the private Sway runtime')
    runtime = run / 'runtime'
    runtime.mkdir(mode=0o700)
    config = run / 'sway.conf'
    config.write_text('xwayland disable\noutput HEADLESS-1 resolution 1280x900\n')
    env = dict(os.environ)
    for key in ['DISPLAY', 'WAYLAND_DISPLAY', 'HYPRLAND_INSTANCE_SIGNATURE', 'SWAYSOCK', 'DBUS_SESSION_BUS_ADDRESS']:
        env.pop(key, None)
    env.update(XDG_RUNTIME_DIR=str(runtime), WLR_BACKENDS='headless', WLR_RENDERER='pixman',
               WLR_HEADLESS_OUTPUTS='1', LD_LIBRARY_PATH=str(RUNTIME / 'usr/lib'))
    with (run / 'display.log').open('w') as log:
        process = subprocess.Popen([sway, '-c', str(config)], env=env, stdout=log,
                                   stderr=subprocess.STDOUT, start_new_session=True)
    try:
        for _ in range(100):
            if process.poll() is not None:
                raise RuntimeError((run / 'display.log').read_text())
            sockets = [p for p in runtime.glob('wayland-*') if stat.S_ISSOCK(p.stat().st_mode)]
            if sockets:
                (run / 'display.json').write_text(json.dumps({'pid': process.pid, 'socket': sockets[0].name,
                                                             'backend': 'headless', 'renderer': 'pixman'}))
                return environment(run)
            time.sleep(.05)
        raise RuntimeError('Headless display startup timed out')
    except Exception:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=5)
        raise


def stop(run):
    if not (run / 'display.json').exists():
        return
    metadata = json.loads((run / 'display.json').read_text())
    proc = Path(f"/proc/{metadata['pid']}/cmdline")
    if proc.exists() and str(run / 'sway.conf').encode() in proc.read_bytes().split(b'\0'):
        os.killpg(metadata['pid'], signal.SIGTERM)
        for _ in range(50):
            if not proc.exists() or not proc.read_bytes():
                break
            time.sleep(.05)
        else:
            raise RuntimeError('Owned headless display did not stop')
    if (run / 'runtime').exists():
        shutil.rmtree(run / 'runtime')
