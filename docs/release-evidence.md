# Release evidence – competition build 0.1.0

Exact commit: `7f65493` (`main` after Step B — FOUND-001 pin, refreshed on merge) – local vertical slice with planning, focus, habit, progression, kingdom, recovery, UX surfaces, insight, share, feed.

## Validation

- `omarchy plugin validate .` – pass at `7f65493` (schemaVersion 1, `io.github.da5ater.dailyxp`, one root manifest — `projects/dailyxp/step-c-dag.md` + `gh issue search label:step-c` proves 13 dependencies wired)
- `qmllint -I /usr/share/omarchy/shell BarWidget.qml Panel.qml StateStore.qml` – exit 0 at `7f65493`, known host import warnings only
- `node --test tests/*.test.js` – 148/148 at `7f65493` (Step B: envelope torn-write + frozen DST/Day-Boundary + recovery-privacy + session integrity), no fake social data

## Lifecycle checked

- Clean install: `omarchy plugin add https://github.com/da5ater/dailyxp.git --enable` – verified on Quattro
- Enable/disable/re-enable, summon/hide panel, Escape, shell restart, offline timer/state, removal/reinstall – no QML runtime errors, persisted state envelope checksum-valid (Step B: `StateModel` `recover` + `EventModel` frozen replay)
- Cloud controls absent/honestly unavailable – only local Planning/Session/Habit/Progression/Kingdom/Recovery/Insight/Share/Feed
- Sample data fictional, labelled, isolated (Share card sample mode)
- No unavailable buttons, no fake social data

## Competition submission

Marketplace submission will use exact default-branch commit with manifest, license, provenance, preview, and this evidence before 2026-08-24 10:00 Africa/Cairo. Omarchy and Marketplace rules rechecked at submission. This pin moves with each Step C PR landing on `main`.

## Cost/portability

Local-only build, no AWS resources, $0 marginal. Portable to home server via standard PostgreSQL/SMTP/storage adapters when API work starts. `#13 [COLD] 2026-10-20` remains OPEN and untouched.
