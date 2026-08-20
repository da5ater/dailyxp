# Technical issue tracker: GitHub

Approved executable technical work for this repo lives as GitHub issues. Use
the `gh` CLI for all operations and infer the repository from the GitHub
remote.

Product discovery, Wayfinder maps, research questions, and unresolved decisions
do not belong in GitHub Issues. Work through them with Mohamed in chat, then
capture the resolved product contract in the repository PRD before generating
technical tickets.

## Conventions

- Create issues with `gh issue create`.
- Read the complete issue, comments, labels, dependencies, and linked pull
  requests before acting.
- Put implementation findings, review findings, fixes, verification evidence,
  cost evidence, and blockers in comments on the technical issue they belong
  to.
- Use this delivery order: implement and verify, run `simplify` over the changed
  code, run applicable codebase-improvement skills, then begin the formal
  standards-and-ticket review loop. Re-run verification after any edit.
- Keep improvement passes inside accepted behavior and ticket scope. Record
  architectural opportunities as follow-up recommendations; do not turn them
  into issues or active work without the product decision or approval required
  by `AGENTS.md`.
- Use issue and pull-request comments as durable delivery context. Chat receives
  decision batches, genuine blockers, and approval-ready handoffs.
- Use native GitHub dependencies for technical delivery order where available.
- Assign a technical ticket before implementation; the assignee is the claim.
- Close a technical ticket only after its pull request is merged or the ticket
  receives an explicit terminal disposition.

## Pull requests as a triage surface

**PRs as a request surface: no.**

Pull requests deliver approved tickets. They are not treated as new feature
requests by the triage workflow.

## Publishing

When a skill says to fetch a technical ticket, read the issue and all comments.
Do not publish a spec or planning artifact as a GitHub issue; store the approved
PRD in the repository and use it to generate executable technical tickets.
