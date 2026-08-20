# DailyXP Agent Contract

DailyXP is an Omarchy-first life-gamification product. Agents own research,
design, implementation, verification, ticket context, and pull-request review.
Mohamed owns product approval and the final decision to merge.

## Working agreement

- Record detailed findings, decisions, evidence, and blockers on the relevant
  GitHub issue or pull request.
- Use chat only for approval-ready handoffs, material decisions that require
  Mohamed, and genuine blockers.
- A ticket is delivered through a feature branch and draft pull request.
- Branch creation, commits, pushes, and draft pull requests are authorized for
  approved tickets. Merging always requires Mohamed to explicitly say `merge`.
- Never provision an AWS resource that can incur a charge without Mohamed's
  separate explicit approval. Free Tier credits are a safety buffer, not a
  spending authorization.
- Prefer AWS Always Free allowances, configure budgets and alerts before
  application resources, and preserve a zero-cost local development path.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues for the repository configured by its
GitHub remote. See `docs/agents/issue-tracker.md`.

### Triage labels

The tracker uses the default five-role triage vocabulary. See
`docs/agents/triage-labels.md`.

### Domain docs

The repository uses a single-context domain glossary. See
`docs/agents/domain.md`.
