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
  request. Review it against both repository standards and its ticket, fix
  findings, and repeat review until no blocking findings remain.
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
