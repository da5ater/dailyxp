---
id: AgDR-0001
timestamp: 2026-08-22T01:13:00Z
agent: Chief of Staff
model: claude-sonnet
session: dailyxp-handover
trigger: gap-report + hard deadline 2026-08-24 requires CI gate before any feature PR
status: executed
category: architecture
projects: [dailyxp]
---

# Bootstrap CI for Omarchy Plugin (node --test + tolerant qmllint + secrets)

> In the context of DailyXP as an Omarchy Quattro QML+JS plugin with no package.json, facing the need for a CI gate before any story PR can merge safely, I decided to wire a minimal GitHub Actions workflow (node --test + tolerant qmllint + manifest validate + gitleaks) to achieve green checks on every PR without requiring an Omarchy shell checkout, accepting that full marketplace validation stays local-only until the shell is available in CI.

## Context

- DailyXP is QML (BarWidget.qml, Panel.qml, StateStore.qml) + Qt-free JS (EventModel.js etc.) with `node --test tests/*.test.js` (137 pass) as the only green gate; no package.json, no tsconfig, no eslint.
- Prior greedy pipeline closed 28 issues in 2h without CI; BarWidget shipped invalid handlers reverted at HEAD.
- Framework golden-path `ci.yml` assumes `npm ci` + `npm run lint/typecheck`; not applicable here.
- Hard deadline: honest competition build 2026-08-24 10:00 Africa/Cairo — CI must be the apex gate.

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| A. Minimal: node --test + tolerant qmllint (fail on syntax only, ignore qs.* imports) + manifest validate + gitleaks | No new dependencies; respects pure-JS stack; qmllint tolerant outside Omarchy host; secrets scan covers entire history | Marketplace validate still local-only; no typecheck threshold |
| B. Full framework ci.yml (npm ci, typecheck, lint) | Reuses golden path verbatim; strictest | Requires inventing package.json + deps not in product; would block on lint rules that don't match QML/JS pure model |
| C. No CI, local pre-push only | Fast | No gate on PRs — repeats greedy failure |

## Decision

Chosen: **A**, because it gives a green required check per PR with zero invented deps, keeps qmllint useful without an Omarchy checkout, and unblocks all 18 clear-slate issues.

## Consequences

- Every PR to `main` runs 4 jobs: tests, qmllint (tolerant), validate, secrets.
- Branch `chore/GH-58-bootstrap-ci-node-test-tolerant-qmllint` carries this gate; remaining story PRs rebase after merge.
- Marketplace `omarchy plugin validate` remains a local manual check, gated by `validate` job doc.

## Artifacts

- `.github/workflows/ci.yml`
- `docs/agdr/AgDR-0001-bootstrap-ci.md`
