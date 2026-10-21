# Connect a desktop integration

The DailyXP application owns all progress. A desktop integration reads a compact snapshot and can open, pause, or resume the application. It never reads journal files or maintains another domain projection.

## Call the controller

Install the desktop app and launch it. Run `dailyxpctl status`. A connected application returns protocol version 1, its revision, an optional active Session, Lifetime XP, Level, Story Rank, and recent safe XP event IDs. Task titles and Recovery details are omitted.

Use `dailyxpctl open` to show the window. Use `dailyxpctl pause REQUEST_ID` or `dailyxpctl resume REQUEST_ID` to control an existing Session. Keep the same request ID when retrying a command. A different command with an already used ID fails. Set `DAILYXP_PROFILE` only when targeting a separate review profile.

## Use the protocol directly

Connect to `integration.sock` in the profile directory. The directory defaults to `$XDG_STATE_HOME/dailyxp-desktop`, or `~/.local/state/dailyxp-desktop`. Send one JSON line, then read the response and close the connection.

```json
{"version":1,"id":"desktop-adapter-unique-request","method":"status"}
```

The response contains `version`, `id`, `ok`, and either `result` or `error`. Unknown protocol versions and methods fail. Requests are limited to 8192 bytes. The socket mode is 0600, inside a private profile directory. No TCP port is used. `status` is read-only. `open` controls the window. `pause` and `resume` use the same domain commands as the app.

## Write another adapter

Poll status on a restrained interval, such as two seconds. Treat a connection failure as disconnected, clear stale Session controls, and offer to launch the installed app. Reconnect without replaying old celebrations. Use stable event IDs to avoid showing a notification twice. On initial connection, mark existing event IDs as seen. Show no sensitive content in desktop feedback.

Do not infer a rank change from Lifetime XP. The current core has no live remote League data. An adapter must not fabricate competition state.
