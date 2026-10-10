"""Verifier lifecycle failures must not affect another run or leak a display."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '.agents/skills/verify/scripts'))
import control
import display


class VerifierLifecycleTests(unittest.TestCase):
    def test_rejected_existing_run_is_not_cleaned_up(self):
        with tempfile.TemporaryDirectory() as temporary:
            run = Path(temporary)
            (run / 'instance.json').write_text('{"pid":123}')
            with patch.object(sys, 'argv', ['control.py', 'launch', str(run)]), \
                    patch.object(control, 'cleanup') as cleanup:
                with self.assertRaisesRegex(RuntimeError, 'new evidence directory'):
                    control.main()
                cleanup.assert_not_called()
            self.assertTrue((run / 'instance.json').exists())

    def test_readiness_exception_stops_owned_display_and_removes_host(self):
        with tempfile.TemporaryDirectory() as temporary:
            run = Path(temporary) / 'run'
            process = Mock(pid=99999999)
            process.poll.return_value = None
            with patch.object(control.subprocess, 'check_output', return_value='revision'), \
                    patch.object(display, 'start', return_value={}), \
                    patch.object(display, 'stop') as stop, \
                    patch.object(control.subprocess, 'Popen', return_value=process), \
                    patch.object(control, 'doctor', side_effect=FileNotFoundError('PID vanished')):
                with self.assertRaises(FileNotFoundError):
                    control.launch(run)
                stop.assert_called_once_with(run)
            self.assertFalse((run / 'host').exists())
            self.assertTrue((run / 'cleanup.json').exists())

    def test_spawn_failure_stops_display_before_registration(self):
        with tempfile.TemporaryDirectory() as temporary:
            run = Path(temporary) / 'run'
            with patch.object(control.subprocess, 'check_output', return_value='revision'), \
                    patch.object(display, 'start', return_value={}), \
                    patch.object(display, 'stop') as stop, \
                    patch.object(control.subprocess, 'Popen', side_effect=OSError('no executable')):
                with self.assertRaises(OSError):
                    control.launch(run)
                stop.assert_called_once_with(run)
            self.assertFalse((run / 'instance.json').exists())

    def test_app_environment_never_inherits_personal_display_or_bus(self):
        with tempfile.TemporaryDirectory() as temporary:
            run = Path(temporary)
            (run / 'display.json').write_text(json.dumps({'socket': 'wayland-private'}))
            with patch.dict(display.os.environ, {'DISPLAY': ':0', 'WAYLAND_DISPLAY': 'wayland-personal',
                                                 'DBUS_SESSION_BUS_ADDRESS': 'unix:path=/personal',
                                                 'HYPRLAND_INSTANCE_SIGNATURE': 'personal'}):
                env = display.environment(run)
            self.assertNotIn('DISPLAY', env)
            self.assertNotIn('HYPRLAND_INSTANCE_SIGNATURE', env)
            self.assertEqual(env['WAYLAND_DISPLAY'], 'wayland-private')
            self.assertEqual(env['XDG_RUNTIME_DIR'], str(run / 'runtime'))
            self.assertNotEqual(env['DBUS_SESSION_BUS_ADDRESS'], 'unix:path=/personal')


if __name__ == '__main__':
    unittest.main()
