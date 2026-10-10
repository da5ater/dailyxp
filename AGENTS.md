# DailyXP Agent Contract

DailyXP is an Omarchy-first life-gamification product. Agents own research,
design, implementation, verification, ticket context, and pull-request review.
Mohamed owns product decisions, approval, and the final decision to merge.

## Working agreement

- Keep product discovery, Wayfinder questions, unresolved decisions, and
  decision batches in chat with Mohamed. Do not create GitHub issues for them.
- After the PRD is approved, create GitHub issues only for executable technical
  delivery work. Each issue must explain the task, context, dependencies,
  acceptance criteria, and verification required by an implementation agent.
- Record implementation findings, review findings, fixes, evidence, and
  blockers on the relevant technical issue. A pull request may carry additional
  code-specific detail but does not replace the ticket context.
- Use chat for product-decision batches, genuine blockers, and approval-ready
  pull-request handoffs.
- A technical ticket is delivered through a feature branch and draft pull
  request. After implementation and verification, run the `simplify` skill on
  the ticket's changed code, then run applicable codebase-improvement skills
  before formal review. These passes must preserve accepted behavior and ticket
  scope. Record significant findings and fixes on the technical issue.
- An architecture-improvement pass may recommend follow-up work, but it must not
  silently expand the active ticket. Correctness, security, data-loss, and
  acceptance-criteria risks found by that pass are fixed before review; broader
  refactors return to Mohamed as a decision or a separately approved technical
  ticket.
- After the improvement passes, review the pull request against both repository
  standards and its ticket, fix findings, and repeat review until no blocking
  findings remain.
- Branch creation, commits, pushes, and draft pull requests are authorized for
  approved tickets. Merging always requires Mohamed to explicitly say `merge`.
- Every architecture, implementation, and code review involving AWS must ask
  whether the result can be cheaper without losing required efficiency,
  reliability, or product behavior. Prefer the cheapest efficient design, not
  the cheapest design in isolation.
- Agents may provision approved-architecture AWS resources without requesting
  permission for each resource. Prefer Free Tier allowances, configure budgets
  and alerts, preserve a zero-cost local development path, and record expected
  and observed cost evidence on the technical ticket.
- Upgrading the AWS account plan, buying a commitment, or accepting a material
  out-of-pocket cost still requires Mohamed's explicit approval.
- Frontend, UX, and motion design must use `gaming-entertainment`, `animate`,
  and `apple-design`.

## Agent skills

### Issue tracker

Approved technical delivery tickets live in GitHub Issues for the repository
configured by its GitHub remote. Product discovery and decisions stay in chat;
the approved PRD lives in the repository. See `docs/agents/issue-tracker.md`.

### Triage labels

The tracker uses the default five-role triage vocabulary. See
`docs/agents/triage-labels.md`.

### Domain docs

The repository uses a single-context domain glossary. See
`docs/agents/domain.md`.

## Local UI refresh and handoff

- Before handing Mohamed UI changes to try locally, install the current feature revision into the local application and reload the running host. Updating files or passing headless tests alone is not a local refresh.
- For DailyXP, preserve user state and back up the installed plugin, validate the replacement, then reload it. `omarchy-shell shell rescanPlugins` can retain old QML components; if the rendered UI is stale, use `omarchy restart shell`, wait for the production state service to settle, and reopen DailyXP.
- Verify the installed source matches the intended revision and inspect the actual rendered local UI. A successful reload command or IPC status is insufficient proof that the new components are visible.
- Do not mutate personal progress to demonstrate the UI. Keep automated verification on the private headless display; touch the personal desktop only for the requested local refresh and handoff.
- Report the loaded revision, visible result, and any refresh failure. Never claim the local UI is updated while it still shows old components.

## pstack UI verification overrides

- UI delivery requires behavior tests, relevant integration tests, the project `verify` skill against the real application, applicable lint checks, and a rendered design review. These checks complement one another; none replaces another. Report skipped checks and lint warnings accurately.
- Use `emil-design-eng` for UI implementation and verification. Read `/home/mohamed/.agents/skills/emil-design-eng/SKILL.md`. Check responsive press feedback, visible keyboard focus, interaction frequency, reduced motion, popover origin, timing, interruptibility, and rendering performance. Apply the principles to the project's framework rather than copying CSS rules into QML.
- Use `review-animations` when motion is added, changed, or implicated in a defect. Read `/home/mohamed/.agents/skills/review-animations/SKILL.md`. Challenge unnecessary motion, keyboard-action animation, sluggish easing, long transitions, layout animation, and missing reduced-motion handling. Record UI findings in a `Before | After | Why` Markdown table as required by Emil's skill.
- Use `improve-animations` for systemic motion problems and `find-animation-opportunities` when considering missing feedback. Read their installed skill files before applying them. Their audit-only scope does not authorize implementation or expanding the ticket. Do not add animation merely to satisfy a checklist.
- Deliberately try to break the changed UI inside the isolated verifier. Exercise rapid repeated clicks and key presses, Tab/Shift+Tab/Enter/Space/Escape, interruption and reopen during transitions, narrow available space, long and empty text, loading/saving/error states, reduced motion, and restart/replay where relevant. Use disposable state and include relevant regressions in automated coverage.
- Assert visible outcomes as well as domain/persistence results: no clipping or overlap, reachable controls, visible focus, correct disabled states, immediate state feedback, and no duplicate actions. Keep adversarial cases focused on the ticket and record evidence, fixes, and remaining limitations.
- Run these passes sequentially in the main agent. Reuse at most one independent reviewer for the final standards, ticket, UI, and motion review and fix verification. These overrides take precedence over pstack fan-out defaults.
