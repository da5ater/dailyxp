# Repository and publishing topology

**Researched:** 2026-08-20

**Decision ticket:** [#4](https://github.com/da5ater/dailyxp/issues/4)

**Inputs:** the resolved [Omarchy contract from issue
#3](https://github.com/da5ater/dailyxp/blob/research/omarchy-contract/docs/research/omarchy-plugin-and-competition-contract.md)
and the resolved [zero-charge AWS architecture from issue
#5](https://github.com/da5ater/dailyxp/blob/research/aws-zero-spend/docs/research/aws-zero-charge-launch-architecture.md)

## Decision

Use **two source repositories with one canonical product control plane**:

1. [`da5ater/dailyxp`](https://github.com/da5ater/dailyxp) remains the public
   product repository, canonical Wayfinder/spec/parent-ticket tracker, and
   directly installable Omarchy plugin repository. Its repository root is the
   plugin root.
2. Create `da5ater/dailyxp-api` only when backend implementation begins. It
   owns backend delivery tickets and PRs plus the Rails/Lambda application,
   DynamoDB model and migrations, local backend development environment,
   deployment package, and AWS infrastructure definitions. Its visibility is
   a separate product/open-source choice; the topology does not require it to
   be public.

Do not put the Rails backend inside the Marketplace repository, and do not add
a generated plugin-distribution repository in V1.

This is the smallest topology that satisfies both non-negotiable boundaries:
one coherent product workflow and a small, independently releasable plugin
checkout. The split follows deployable/runtime ownership, not feature
ownership. Product decisions are not duplicated between repositories.

## Why the boundary is real

The installed Omarchy `plugin add` implementation runs an ordinary full `git
clone` of the submitted URL into `~/.config/omarchy/plugins`, validates that
checkout, and keeps the Git checkout as the installed plugin. It does not use
sparse checkout, a release asset, or a subdirectory. See the pinned official
[`omarchy-plugin-add`](https://github.com/basecamp/omarchy/blob/f0020448ca87329199de7cb12f2015ebc4a3e5e7/bin/omarchy-plugin-add).

The Marketplace accepts exactly one plugin manifest at repository root and
snapshots the repository's default-branch commit. See the pinned official
[`inspectSubmission`](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/blob/95b7333b1e806b12f07952772111c2da6a86897c/scripts/build-catalog.mjs#L1023-L1074).
Its automated security baseline considers relevant executable and source files
across the repository tree, including `.rb`, `.js`, `.yml`, scripts,
extensionless files, and executable files; it does not limit the scan to QML
entry points. See the pinned official
[`security-baseline-scope.mjs`](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/blob/95b7333b1e806b12f07952772111c2da6a86897c/scripts/security-baseline-scope.mjs).

Therefore a plugin-root monorepo would make every user clone the Rails,
infrastructure, and backend-development history into the unsandboxed plugin
directory and would broaden Marketplace static-review scope. Git history and
ignored dependencies still make the clone larger even if runtime discovery
ignores backend directories. That is a poor packaging contract, not merely an
aesthetic repository preference.

## Options compared

| Criterion | Plugin-root monorepo | Separate plugin and API repos | Canonical monorepo + generated plugin repo |
| --- | --- | --- | --- |
| Marketplace root install | Valid if root manifest is unique | Valid directly from `dailyxp` | Valid only from generated repo |
| Installed clone | Includes backend, infra, and their history | Plugin/product docs only | Plugin-only |
| Marketplace security scope | Backend Ruby/scripts/CI can enter scan | Focused on shipped plugin repo | Focused, but on generated output |
| Product decisions and tickets | Naturally one place | One canonical tracker by policy | Naturally one place |
| Cross-component delivery | One PR can be atomic | Parent links component tickets/PRs | Source PR plus publication automation |
| Independent releases | Possible with path/tag discipline | Native repository boundary | Native, but coupled to generator |
| CI | Path-filtered workflows; skipped required-check edge cases | Simple component-local checks | Source CI plus generation and destination verification |
| Supply-chain/provenance | Direct source commit | Direct source commit per component | Marketplace validates a generated commit different from reviewed source |
| Rollback | Shared history, separate deploy state | Revert/release each component independently | Revert source and regenerate or repair destination |
| V1 operational burden | Low, but bad install/review boundary | Low and explicit | Highest: cross-repo writer, drift detection, provenance mapping |

### Rejected: plugin-root monorepo

GitHub Actions can run workflows only when selected paths change, so separate
plugin and backend CI in one repository is technically possible. GitHub also
warns that a path-filtered workflow which is skipped can leave a required check
pending, which complicates branch protection. See GitHub's official
[workflow filter documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#using-filters).

CI is not the deciding weakness. The installer and Marketplace operate on the
repository as the distribution unit. No path filter prevents users from
cloning backend history or keeps backend source out of the Marketplace's
repository-wide security baseline. The monorepo therefore fails the explicit
small-install and focused-review goals.

### Chosen: separate plugin and API repositories

This option maps directly to two independently deployed units. The Omarchy
plugin remains a normal source repository whose reviewed default-branch SHA is
the exact Marketplace snapshot and installed Git checkout. The backend can be
tested, deployed, and rolled back without changing the Marketplace source, and
plugin-only changes do not rebuild or deploy AWS code.

Separation does not require a split product backlog. GitHub supports linking a
pull request or branch to an issue in another repository, including the full
`OWNER/REPOSITORY#NUMBER` syntax. Its issue dependency UI also accepts an
issue number or URL. See GitHub's official
[issue/PR linking documentation](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
and [issue dependency
documentation](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies).
DailyXP will use those capabilities while retaining `da5ater/dailyxp` as the
canonical product control plane.

### Deferred: canonical monorepo with generated distribution repo

This option solves clone size but adds a publication system that must write
reviewed output into a second repository, preserve a source-SHA to
distribution-SHA mapping, prevent manual drift, run validation again on the
destination commit, and coordinate rollbacks. The Marketplace then validates
the generated destination SHA, not the source PR SHA.

That cross-repository writer is also an unnecessary supply-chain authority.
GitHub recommends least-privilege workflow permissions and pinning third-party
actions to full commit SHAs because Actions commonly hold repository write
permissions and deployment credentials. See GitHub's official
[Actions hardening guidance](https://docs.github.com/en/code-security/tutorials/secure-your-organization/protect-against-threats#harden-your-github-actions-workflows).
The generated-repository design may become worthwhile only if DailyXP later
needs a true monorepo for several clients or shared generated artifacts. V1 has
one Omarchy client and one API, so the extra release authority and drift state
buy nothing the two-source-repository design does not already provide.

## Canonical workflow and ownership

`da5ater/dailyxp` owns:

- `AGENTS.md`, `CONTEXT.md`, ADRs, research, PRD/specification, Wayfinder map,
  plugin and cross-component tickets, product acceptance evidence, and release
  coordination;
- the root `manifest.json`, QML/JavaScript plugin runtime, local persistence,
  assets, plugin tests, root README/license, install/removal instructions, and
  Marketplace submission evidence;
- the canonical API behavior expected by the client, expressed in product
  acceptance criteria and a versioned protocol contract.

`da5ater/dailyxp-api` owns:

- backend-specific delivery tickets and their detailed implementation context;
- the executable API implementation, API-specific tests and technical docs;
- Rails/Lambda packaging, DynamoDB data model/migrations, local DynamoDB/SAM
  tooling, infrastructure definitions, and deployment/rollback scripts;
- repository-native dependency/security alerts and PR evidence for backend
  changes.

Wayfinder, PRD/spec, milestone, product-decision, and cross-component parent
issues live only in `da5ater/dailyxp`. A backend implementation slice gets a
child/dependent ticket in `da5ater/dailyxp-api`; it links its canonical parent
by full URL and carries all backend findings, evidence, and blockers. Its PR
closes that backend ticket. The parent issue keeps the dependency links and a
concise cross-component status, and closes only after all child tickets/PRs
are complete, integration evidence is posted, and its acceptance criteria
pass.

Do not use a cross-repository closing keyword against the canonical parent
when another PR or human acceptance remains, because merging one component
must not close a multi-component ticket prematurely.

A coherent ticket may produce:

- one plugin PR;
- one API PR; or
- one PR in each repository when the behavior crosses the boundary.

Each PR contains component-local findings and checks. The canonical issue
comment maintains the cross-component status and final evidence. Every PR
still requires Mohamed's explicit `merge`; merging one never authorizes the
other.

## Repository shapes

The plugin/product repository keeps the unique plugin manifest at root:

```text
dailyxp/
├── manifest.json
├── BarWidget.qml
├── Panel.qml
├── Model.js                 # or a small plugin-native source tree
├── assets/
├── tests/
├── README.md
├── LICENSE
├── AGENTS.md
├── CONTEXT.md
├── contracts/               # versioned client/server protocol contract
└── docs/                    # PRD, ADRs, research, release evidence
```

There must be no second `manifest.json` at the root or one directory below,
because the current Marketplace new-submission validator rejects that layout.
Generated dependencies, backend source, backend fixtures, deployment packages,
and AWS credentials never belong here.

The backend repository is an ordinary API repository:

```text
dailyxp-api/
├── app/
├── config/
├── db/
├── infra/
├── test/
├── Gemfile
├── README.md
└── AGENTS.md
```

Its `AGENTS.md` must point to `da5ater/dailyxp` as the canonical product
control plane, require every backend delivery ticket to link its parent
product ticket, and repeat the no-AWS-mutation-without-separate-approval
contract. It must preserve the zero-cost local path defined by issue #5.

## API contract and dependency ordering

Use an explicit integer protocol version in client requests and server
responses. Store the human-reviewed protocol schema under `dailyxp/contracts/`
and pin the backend implementation to the exact schema commit or release in
its tests. A contract change is incomplete until both repositories' contract
tests pass against the same version.

Delivery order for an additive client/server change is:

1. approve the canonical ticket and protocol change;
2. merge and deploy the backward-compatible API change after Mohamed approves
   both the API merge and the separately gated AWS mutation;
3. verify old-client behavior against the deployed API;
4. merge and release the plugin change after Mohamed's separate approval;
5. preserve the two commit SHAs, API deployment identifier, plugin version,
   and integration evidence on the canonical issue.

Never require an unreleased plugin to keep the current public plugin working.
A breaking protocol change requires a new protocol version and a migration
window; it is not delivered by changing both default branches simultaneously.

## CI and release contract

### Plugin/product repository

Pull-request CI checks the complete repository contract relevant to the
change, including:

- JSON/Markdown/domain-document checks;
- plugin unit/domain tests;
- `omarchy plugin validate` and `qmllint` for every shipped QML file;
- a check that there is exactly one supported root manifest and no symlinks;
- protocol fixtures/contract tests without network or AWS access;
- dependency and secret scans appropriate to the unsandboxed runtime.

Release `vX.Y.Z` tags identify plugin releases and must agree with
`manifest.json`. The public default branch remains installable at every merge.
Before Marketplace submission, validate and runtime-test the exact
default-branch commit as required by issue #3.

### API repository

Pull-request CI runs Rails tests, protocol conformance, local DynamoDB/SAM
checks, package-size checks, infrastructure policy checks, and secret scans.
It makes no AWS mutation by default. A tagged, immutable deployment package is
produced locally or in CI; deploying it remains a separate approval-gated
operation under issue #5.

GitHub rulesets can require pull requests and successful status checks before
merge in each repository. The feature is available to public repositories on
GitHub Free. See GitHub's official
[ruleset documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#require-status-checks-to-pass-before-merging).

## Independent rollback

### Plugin

- Never force-push or rewrite the Marketplace default branch.
- Revert the faulty plugin PR, rerun the full plugin gate, increment the patch
  version, and publish the repair commit.
- Preserve the previous tag and evidence so users can inspect or temporarily
  select the last known-good commit while the default branch is repaired.
- A backend incident must not require removing local-only DailyXP behavior;
  the plugin degrades to its documented offline mode.

### API

- Keep the last known-good deployment package and configuration manifest.
- Roll back the backend independently to that package only after the required
  merge/deployment approvals and compatibility checks.
- Keep the previous API behavior available through the migration window so a
  Marketplace plugin that has not updated continues to work.
- If the service cannot be restored safely within zero-charge limits, disable
  social writes and preserve local operation rather than spending credits or
  expanding AWS resources.

### Coordinated failure

If a cross-component release fails, roll back the newly deployed API first
when it remains compatible with the current plugin; otherwise disable the new
feature server-side and ship a plugin patch. Record both rollback identifiers
and the user-visible state on the canonical ticket. No rollback path may
provision or resize an AWS resource without Mohamed's separate explicit
approval.

## When to reconsider

Reopen this decision only when one of these becomes true:

- more than one distributable desktop client needs substantial shared source;
- the Omarchy installer supports a declared subdirectory or release artifact;
- Marketplace validation formally supports a monorepo plugin path;
- duplicated protocol tooling becomes more expensive than a provenance-safe
  distribution pipeline; or
- repository count itself creates measured delivery failures.

If reconsidered, a generated distribution repository must have a reproducible
build, least-privilege writer, full-SHA-pinned Actions, destination drift
detection, source/destination SHA attestations, and a tested rollback before it
can replace the direct-source plugin repository.

## Sources

Primary sources only were used:

- [Resolved DailyXP Omarchy runtime and Marketplace contract](https://github.com/da5ater/dailyxp/blob/research/omarchy-contract/docs/research/omarchy-plugin-and-competition-contract.md)
- [Resolved DailyXP zero-charge AWS launch architecture](https://github.com/da5ater/dailyxp/blob/research/aws-zero-spend/docs/research/aws-zero-charge-launch-architecture.md)
- [Installed-version Omarchy plugin installer](https://github.com/basecamp/omarchy/blob/f0020448ca87329199de7cb12f2015ebc4a3e5e7/bin/omarchy-plugin-add)
- [Marketplace submission inspector](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/blob/95b7333b1e806b12f07952772111c2da6a86897c/scripts/build-catalog.mjs#L1023-L1074)
- [Marketplace security scan scope](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/blob/95b7333b1e806b12f07952772111c2da6a86897c/scripts/security-baseline-scope.mjs)
- [Marketplace publishing guide](https://omarchyplugins.com/publish.html)
- [GitHub issue and pull-request linking](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
- [GitHub issue dependencies](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies)
- [GitHub Actions workflow filters](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#using-filters)
- [GitHub Actions hardening](https://docs.github.com/en/code-security/tutorials/secure-your-organization/protect-against-threats#harden-your-github-actions-workflows)
- [GitHub repository rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)

Recheck the live Omarchy and Marketplace contracts immediately before
submission. They can move independently of the installed `f002044` shell and
the Marketplace `95b7333` snapshot used here.
