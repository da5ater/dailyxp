# Electron core and desktop integrations

Issue #107 moves the full interface into Electron. Linux is the delivery platform. Omarchy is an optional integration. No operating-system adapter owns domain state.

## Ownership

The desktop main process owns a Core instance, its single writer lock, durable state and a local Unix socket. The renderer uses a narrow preload bridge. Companion applications use the same versioned protocol through a CLI. Only the desktop renderer can read full planning, journal and Recovery data. Integration status contains no task titles or Recovery information by default.

The persisted shape remains the existing checksum envelope with its canonical event journal. Core reuses the deterministic domain modules. Settings and command receipts are stored alongside the envelope in one atomically replaced desktop document. A request ID plus its command fingerprint makes retries idempotent across restarts. A failed save must leave in-memory state unchanged. Another process cannot open the same profile for writing.

## Alternatives considered

A separate always-on daemon would isolate lifetime from Electron but require two coordinated processes, packaging and service activation on every distro. Start with an Electron-owned service that remains alive when its window closes. The same Core and protocol can move into a daemon without changing adapters.

Loopback HTTP would simplify browser access but expose a network endpoint and require browser-origin defenses. A private Unix socket in a user-owned directory keeps desktop integrations local without opening a TCP port. Versioned requests make future non-Linux transports possible. The Electron renderer never gets Node or socket access.

## Client contract

A newline-delimited JSON request contains `version: 1`, `id`, `method`, and `params`. Methods are `status`, `open`, `pause`, and `resume`. Status is a privacy-safe snapshot with revision, session status, elapsed time, XP, Level and Story Rank. A compact event window contains only safe award summaries and stable IDs. Clients retain their own last-seen event IDs. Mutating retries use the same ID. Unknown methods, protocol versions, oversized frames and invalid commands fail without state changes.

`dailyxpctl status`, `dailyxpctl open`, `dailyxpctl pause`, and `dailyxpctl resume` use the production protocol. An Omarchy service polls status, displays the session and Level, and offers pause/resume/open. It does not render the full product or read the event journal. Other desktop adapters implement the same contract.

## Migration and rollback

First launch offers explicit import of an existing plugin state file. Import validates the envelope and journal before writing. It copies data into the new profile and never modifies the legacy file. The old plugin must be replaced by the companion before personal migration, so there are no active legacy writers. Rollback restores the backed-up plugin and its unchanged legacy state. Work recorded after migration remains in the desktop profile and must be exported before rollback to avoid abandoning newer progress.

## Verification

Node behavior tests cover disk replay, save failures, duplicate requests, invalid imports, locking, protocol privacy and adapter commands. The desktop driver launches Electron inside a private headless Wayland compositor with an empty profile. It uses Playwright's Electron connection to drive accessible controls, captures screenshots and action results, restarts the actual process, and inspects persisted state. Cleanup kills only owned processes and preserves evidence. Packaged Linux startup is checked separately. Cross-distro compatibility requires execution on each claimed distro, not merely generation of an AppImage.
