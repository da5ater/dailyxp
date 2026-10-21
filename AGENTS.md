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
- Prepare local review data and state for every changed feature so Mohamed can see and try the change immediately in the actual application. Do not hand off an empty or ineligible state that hides the feature. Prefer an isolated local review profile or reversible demo state, clearly identified as review data.
- Back up personal state before preparing the handoff. Keep review data separate from real progress and record the owned profile, temporary records, state changes and cleanup path. Never overwrite personal progress or discard real changes made during review.
- When Mohamed finishes local testing and moves on to PR review or merge, clean up the owned demo data, temporary state and review instances, return the app to its normal state, and verify cleanup. An already-open draft PR is not a signal to remove a demo he is still reviewing. Never perform a broad reset or delete unrelated data.
- Prepared handoff data helps human review; it does not replace the verifier's empty-state journey through real product controls. Automated tests remain on the private headless display; personal desktop access stays limited to the requested local handoff.
- Report the loaded revision, visible result, and any refresh failure. Never claim the local UI is updated while it still shows old components.

## pstack UI verification overrides

- UI delivery requires behavior tests, relevant integration tests, the project `verify` skill against the real application, applicable lint checks, and a rendered design review. These checks complement one another; none replaces another. Report skipped checks and lint warnings accurately.
- Use `emil-design-eng` for UI implementation and verification. Read `/home/mohamed/.agents/skills/emil-design-eng/SKILL.md`. Check responsive press feedback, visible keyboard focus, interaction frequency, reduced motion, popover origin, timing, interruptibility, and rendering performance. Apply the principles to the project's framework rather than copying CSS rules into QML.
- Use `review-animations` when motion is added, changed, or implicated in a defect. Read `/home/mohamed/.agents/skills/review-animations/SKILL.md`. Challenge unnecessary motion, keyboard-action animation, sluggish easing, long transitions, layout animation, and missing reduced-motion handling. Record UI findings in a `Before | After | Why` Markdown table as required by Emil's skill.
- Use `improve-animations` for systemic motion problems and `find-animation-opportunities` when considering missing feedback. Read their installed skill files before applying them. Their audit-only scope does not authorize implementation or expanding the ticket. Do not add animation merely to satisfy a checklist.
- Deliberately try to break the changed UI inside the isolated verifier. Exercise rapid repeated clicks and key presses, Tab/Shift+Tab/Enter/Space/Escape, interruption and reopen during transitions, narrow available space, long and empty text, loading/saving/error states, reduced motion, and restart/replay where relevant. Use disposable state and include relevant regressions in automated coverage.
- Assert visible outcomes as well as domain/persistence results: no clipping or overlap, reachable controls, visible focus, correct disabled states, immediate state feedback, and no duplicate actions. Keep adversarial cases focused on the ticket and record evidence, fixes, and remaining limitations.
- Run these passes sequentially in the main agent. Reuse at most one independent reviewer for the final standards, ticket, UI, and motion review and fix verification. These overrides take precedence over pstack fan-out defaults.

## Visual review handoff in poteto mode

- After each implementation, open a short local HTML click guide in the Codex side panel. Group the handoff by feature, with each feature's revealing clicks, prepared local state, marked Before / During / After captures and expected outcome together. Let Mohamed choose one feature at a time, using feature tabs or equivalent grouped navigation. Keep the guide short and avoid a single long mixed walkthrough.
- For each change, explain the exact previous problem in one sentence and show real Before / During / After pictures. Before comes from the last released version, or the last installed version when no tagged release exists; identify that baseline clearly.
- Next to the pictures, tell Mohamed exactly where to click in the actual application to see the change. Use short numbered actions and familiar control labels. Keep typing to the minimum the real feature requires.
- Add small numbered markers, arrows or outlines on the exact control, result or region to inspect. Match each marker to a short hint beside the picture; keep markers aligned as the page resizes. A hint states where to look and what should happen. Do not require typing when a click or existing default is sufficient.
- Use this format for features, fixes, optimizations, speed changes and edge cases. Choose the evidence that reveals the change: app captures for UI, a marked measured timing comparison or trace for performance, or the relevant input/result state for an edge case. Do not invent timings or force a UI screenshot when it cannot show the result.
- Keep only the minimum needed to understand the old problem, perform the revealing action and recognize the expected outcome. Put engineering details and full measurements in linked PR evidence, not in the guide.
- The HTML is an illustrated guide, not a replacement app. Do not add duplicate input forms, simulated app controls, browser-to-QML control bridges, blast-radius sections, test reports or long engineering explanations. Keep detailed verification in the issue/PR evidence.
- Real interactions happen in the actual application. For an explicitly requested local test handoff, back up personal state and the installed plugin, install the current revision, reload the host and inspect the real rendered app. Clearly report if that refresh is deferred or blocked. Supply the prepared review state described above and preserve personal progress.
- Automated tests remain on the private display. Do not take over personal mouse/keyboard input. Personal shell refresh/open is limited to the requested local handoff.
- Keep the guide current after fixes and link the PR. Preserve manual review and explicit merge authorization. Save these overrides in AGENTS.md rather than editing plugin-cache skills.
