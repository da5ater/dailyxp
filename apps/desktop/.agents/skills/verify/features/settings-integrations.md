# Settings and desktop integrations

Click Settings to change the daily target or day boundary, toggle reduced motion, export JSON or a legacy backup, import either format into an empty profile, or reset the current profile. About shows the packaged version. Reduced motion saves immediately. Numeric settings use Save settings. Existing history retains its recorded date context.

The default verifier runs `scripts/verify-settings.cjs` after the empty-state product journey. It changes numeric preferences, toggles motion, checks no duplicate event after a repeated save, rejects invalid values, provokes a real read-only-directory save failure and preserves the form. It closes and restarts the real app, checks all preferences, and checks visible focus at 620px width.

The actual native JSON save dialog writes a checksum-valid canonical journal. The script loads that file with EventModel.loadJournal and imports it into a clean Core directory to compare XP and preferences. The existing native backup import journey proves source bytes stay unchanged. Canonical JSON and storage envelopes are both accepted by Import legacy state.

Reset opens a native HTML dialog with Cancel focused. Enter cancels. Escape cancels and reopening works. A separate Clear this profile action writes a named `reset-backup-UUID.json` recovery copy before replacing the profile. The script checks fresh visible commitments, default settings, idle companion rank, and empty replay after another restart. Reset is exercised only on disposable state.

The real companion right-click journey checks explicit paused text. Idle shows level and rank. Running shows focused minutes. Active Sessions take precedence over XP feedback. Capture the companion on the private display and inspect labels as well as the safe socket response.

Node tests cover settings migration, failed writes, no-op saves, canonical checksum rejection and full projection round-trip. A controlled local clock checks dated Routine identities and Session slicing across the saved day boundary after restart.

The headless display lacks a personal notification bus. These journeys do not prove OS notification delivery. Never import personal Recovery data into an automated run.
