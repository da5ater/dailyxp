# Release evidence – competition build 0.1.0

Exact commit: `a17e77e` (main after FEED-001) – local vertical slice with planning, focus, habit, progression, kingdom, recovery, UX surfaces, insight, share, feed.

## Validation

- `omarchy plugin validate .` – passed (schemaVersion 1, id io.github.da5ater.dailyxp)
- `qmllint -I /usr/share/omarchy/shell BarWidget.qml Panel.qml StateStore.qml` – exit 0, known host import warnings only
- `node --test tests/*.test.js` – 137/137 passed at this commit (before RELEASE checklist)

## Lifecycle checked

- Clean install: `omarchy plugin add https://github.com/da5ater/dailyxp.git --enable` – verified on Quattro
- Enable/disable/re-enable, summon/hide panel, Escape, shell restart, offline timer/state, removal/reinstall – no QML runtime errors, persisted state envelope checksum-valid
- Cloud controls absent/honestly unavailable – only local Planning/Session/Habit/Progression/Kingdom/Recovery/Insight/Share/Feed
- Sample data fictional, labelled, isolated (Share card sample mode)
- No unavailable buttons, no fake social data

## Competition submission

Marketplace submission will use exact default-branch commit with manifest, license, provenance, preview, and this evidence before 2026-08-24 10:00 Africa/Cairo. Omarchy and Marketplace rules rechecked at submission.

## Cost/portability

Local-only build, no AWS resources, $0 marginal. Portable to home server via standard PostgreSQL/SMTP/storage adapters when API work starts.
