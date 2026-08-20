# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all
operations and infer the repository from the GitHub remote.

## Conventions

- Create issues with `gh issue create`.
- Read the complete issue, comments, labels, dependencies, and linked pull
  requests before acting.
- Put research findings, decision rationale, implementation evidence, and
  blockers in comments on the issue they belong to.
- Use issue comments as the durable progress context. Chat receives only an
  approval-ready handoff or a genuine blocker.
- Use native GitHub sub-issues and blocking relationships where available.
- Assign a Wayfinder ticket before working it; the assignee is the claim.
- Close a decision ticket only after its resolution is recorded in a comment.

## Pull requests as a triage surface

**PRs as a request surface: no.**

Pull requests deliver approved tickets. They are not treated as new feature
requests by the triage workflow.

## Publishing

When a skill says to publish a spec or ticket, create a GitHub issue. When it
says to fetch a ticket, read the issue and all comments.

## Wayfinding operations

- The map is one issue labelled `wayfinder:map`.
- Decision tickets are sub-issues labelled `wayfinder:research`,
  `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- GitHub native issue dependencies are canonical. If unavailable, use a
  `Blocked by:` line in the issue body.
- The frontier is the map's open, unblocked, unassigned child issues.
- Claim with assignment, resolve with a detailed comment, close the ticket,
  then append a one-line linked gist to the map's Decisions-so-far section.
