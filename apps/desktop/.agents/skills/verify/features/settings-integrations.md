# Settings and desktop integrations

## Sub-features

Daily Target, day boundary, reduced motion, opt-in notifications, legacy import, export and versioned local companion control.

## How to get to it (user POV)

Click Settings. Use Import legacy state only in an empty desktop profile. The companion button opens DailyXP. Right-click pauses or resumes an active Session.

## Driving it with Playwright Electron

The default journey checks Reduce motion and saves. Assert `body[data-reduced=true]` and the stored boolean. It also runs a real companion widget and right-clicks it through QtTest, then observes Electron's paused state. Node integration tests cover invalid protocol frames, retry IDs, privacy and import compatibility. For a migration change, use the actual native file dialog with a disposable legacy backup and inspect both unchanged source bytes and the imported projection. For packaging, use the packaged-mode journey and installed controller.

## Gotchas

The headless display lacks a notification bus, so it cannot establish desktop notification delivery. A private socket response proves only the protocol path. Renderer input must use user controls. Never enable personal notifications or import personal Recovery data during automated checks.
