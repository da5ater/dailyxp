# Omarchy plugin and competition contract

Status: resolved research for [DailyXP issue #3](https://github.com/da5ater/dailyxp/issues/3)  
Checked: 2026-08-20 in `Africa/Cairo`  
Installed reference: `omarchy-dev 4.0.0.r1744.gf002044-1` / `4.0.0.alpha`,
source commit
[`f002044`](https://github.com/basecamp/omarchy/tree/f0020448ca87329199de7cb12f2015ebc4a3e5e7),
shell IPC responsive  
Newer upstream snapshots checked for drift: Omarchy `quattro` at
[`d3d9bea`](https://github.com/basecamp/omarchy/tree/d3d9bea1eed3ade224a4bbf0389a4d5ac2ad534e),
Marketplace `main` at
[`95b7333`](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/tree/95b7333b1e806b12f07952772111c2da6a86897c)

## Decision summary

DailyXP must ship as a normal third-party Quattro plugin in a public GitHub
repository whose root is directly installable by `omarchy plugin add`. It must
join the existing long-running `omarchy-shell`; it must not launch another
Quickshell process. The natural first surface is a `bar-widget` whose entry
point owns and loads its details panel, following the built-in clock. That is a
DailyXP design recommendation, not a Marketplace rule. Add another manifest
kind only if DailyXP really supplies that kind's independent shell entry point.

The competition announcement says the plugin must be submitted to the Omarchy
Plugin Marketplace repository **before Monday 2026-08-24 09:00 CEST**, which is
**Monday 2026-08-24 10:00 EEST in Cairo** (`07:00 UTC`). It does not define
whether “submitted” means an issue opened, a validation-passing issue,
maintainer approval, or a completed listing. The issue creation time is useful
deadline evidence, but the safe delivery target is a complete, validation-
passing submission that becomes listed before the deadline.

Marketplace validation is not a security review. Plugins execute unsandboxed
with the user's permissions inside a long-lived desktop process. DailyXP must
therefore document every dependency, command, network service, data path,
permission, installation step, and removal step, and it must avoid unnecessary
privilege.

## 1. Runtime contract

### Hard requirements

The current shell is one long-running Quickshell instance. Bar widgets, panels,
overlays, menus, and services are loaded inside it; shell IPC summons already
loaded or lazily loaded surfaces. A plugin must never start a second
`quickshell -p ...` process. See the official
[shell architecture and manifest reference](https://github.com/basecamp/omarchy/blob/f0020448ca87329199de7cb12f2015ebc4a3e5e7/shell/README.md#omarchy-shell)
and [IPC contract](https://github.com/basecamp/omarchy/blob/f0020448ca87329199de7cb12f2015ebc4a3e5e7/shell/README.md#ipc-contract).

A third-party plugin is discovered only as a top-level directory under
`~/.config/omarchy/plugins/<id>/` with `manifest.json` at its root. The
repository root must therefore be the plugin root for a new Marketplace
submission. The supported kinds and required entry-point keys are:

| `kinds` value | `entryPoints` key | Runtime role |
| --- | --- | --- |
| `bar-widget` | `barWidget` | Item placed in the active bar |
| `panel` | `panel` | Floating surface |
| `overlay` | `overlay` | Fullscreen surface |
| `menu` | `menu` | Summoned menu |
| `service` | `service` | Headless singleton |
| `bar` | `bar` | Full replacement for the built-in bar |

The local CLI and Marketplace validators jointly require:

- JSON `schemaVersion` exactly equal to the number `1`;
- non-empty `id`, `name`, `version`, `kinds`, and `entryPoints`; Marketplace
  additionally requires non-empty `author` and `description`;
- one supported entry-point key for every declared kind;
- entry-point values that are safe relative paths and point to existing files;
- a non-empty kinds array;
- no symlink anywhere in the plugin folder (the installed CLI excludes `.git`
  internals from this check);
- a lowercase community ID using only letters, digits, dots, underscores, and
  hyphens, starting alphanumerically, containing no `..`, and not using the
  reserved `omarchy.*` namespace;
- if set, `barWidget.defaultSection` is `left`, `center`, or `right`.

The authoritative shell validation is implemented in
[`PluginRegistry.qml`](https://github.com/basecamp/omarchy/blob/f0020448ca87329199de7cb12f2015ebc4a3e5e7/shell/services/PluginRegistry.qml#L36-L107),
with third-party discovery and namespace reservation in the
[same registry](https://github.com/basecamp/omarchy/blob/f0020448ca87329199de7cb12f2015ebc4a3e5e7/shell/services/PluginRegistry.qml#L597-L609).
The publish-time rules are stronger and are implemented by the Marketplace's
[`validateManifest`](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/blob/95b7333b1e806b12f07952772111c2da6a86897c/scripts/build-catalog.mjs#L269-L388).

### Bar widget with nested panel

For DailyXP's bar indicator plus details panel, the official development guide
uses one `bar-widget` manifest entry. `BarWidget.qml` loads `Panel.qml`
internally and forwards `opened`, `open()`, `close()`, and panel switching
lifecycle; the nested panel is **not** declared as a second `panel` kind. The
built-in clock is the closest current reference:

- [`manifest.json`](https://github.com/basecamp/omarchy/blob/f0020448ca87329199de7cb12f2015ebc4a3e5e7/shell/plugins/panels/clock/manifest.json)
- [`BarWidget.qml`](https://github.com/basecamp/omarchy/blob/f0020448ca87329199de7cb12f2015ebc4a3e5e7/shell/plugins/panels/clock/BarWidget.qml)
- [`Panel.qml`](https://github.com/basecamp/omarchy/blob/f0020448ca87329199de7cb12f2015ebc4a3e5e7/shell/plugins/panels/clock/Panel.qml)
- [Marketplace development guide](https://omarchyplugins.com/develop.html)

The manifest entry-point QML is an `Item`-based plugin component, not a
`ShellRoot`. A standalone panel, overlay, or menu exposes `open(payloadJson)`
and `close()` for `summon` and `hide`; a bar widget that hosts a nested panel
must expose the corresponding lifecycle on its bar-widget root so shell routing
can find it. See the installed clock source above and the official
[Quattro shell-development instructions](https://github.com/basecamp/omarchy/blob/f0020448ca87329199de7cb12f2015ebc4a3e5e7/agents/skills/shell-dev.md).

### Installation and updates

`omarchy plugin add <git-url>` clones the repository, validates it, places it
at `~/.config/omarchy/plugins/<manifest-id>/`, rescans the running shell, and
leaves the plugin disabled unless enablement is requested or confirmed. The
installer itself does not execute plugin code, install hooks, or `sudo`.
Updates show a diff and fast-forward the checkout. Once enabled, however, the
plugin is arbitrary QML/JavaScript/process-launching code with the user's
permissions. See the official
[third-party installation contract](https://github.com/basecamp/omarchy/blob/f0020448ca87329199de7cb12f2015ebc4a3e5e7/shell/README.md#installing-a-third-party-plugin).

Develop only in a user-owned clone, never in `/usr/share/omarchy` or another
packaged source directory:

```bash
omarchy plugin clone omarchy.clock --edit
```

Keep the clone-generated `omarchy.clonedFrom` only during development. Before
publishing, use the permanent namespaced ID and remove that clone-only field.

## 2. Security and privacy contract

### Required truths

- The plugin shares `omarchy-shell` and runs unsandboxed with the user's normal
  permissions. A shell/plugin crash can therefore affect the desktop shell.
- Marketplace listing validation checks repository structure and compatibility;
  it is explicitly not a security approval.
- The current Marketplace workflow also runs an automated security baseline
  after structural validation and may mark a submission passed,
  review-required, or needs-fixes. That baseline does not override the
  Marketplace's explicit no-security-review disclaimer. See
  [`validate-submission.yml`](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/blob/95b7333b1e806b12f07952772111c2da6a86897c/.github/workflows/validate-submission.yml).
- Baseline policy version 3 is in `selective` mode. Its currently blocking
  findings are dangerous passwordless-sudo command surfaces and privileged
  process control based on predictable shared temporary state; installers,
  package managers, privilege requests, remote builds, bundled executables,
  service management, and sudoers modification trigger human review. See the
  pinned
  [`security-baseline-policy.mjs`](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/blob/95b7333b1e806b12f07952772111c2da6a86897c/scripts/security-baseline-policy.mjs).
- The submission checklist requires documented external dependencies, ownership
  or permission for code and preview assets, safe install/removal, and a promise
  not to overwrite user configuration without explicit consent. See the exact
  [`submit-plugin.yml`](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/blob/95b7333b1e806b12f07952772111c2da6a86897c/.github/ISSUE_TEMPLATE/submit-plugin.yml).

### DailyXP delivery implications

These are project requirements derived from the runtime risk, not additional
competition rules:

- preserve a complete zero-cost local mode and make network/account features
  explicit;
- never place secrets or long-lived credentials in the repository, manifest,
  QML source, logs, screenshots, or share cards;
- document local state, cache, token, and user-data paths and remove them only
  with explicit user consent;
- use unprivileged user services/processes only; no `sudo`, root service, or
  silent package installation;
- disclose the AWS API, telemetry (if any), network endpoints, external assets,
  and every runtime dependency in README and the Marketplace maintainer notes;
- give recovery/sobriety data a private default and explicit sharing controls;
- handle network loss without losing an active local timer session;
- validate every shell command argument and avoid constructing executable shell
  strings from user or server content.

## 3. Marketplace publication contract

The Marketplace is an independent community project, not an Omarchy or
37signals security authority, but DHH's competition announcement names it as
the competition repository. Its current
[publishing guide](https://omarchyplugins.com/publish.html) requires:

1. a public, active, unarchived GitHub repository;
2. exactly one plugin `manifest.json` at repository root for a new submission;
3. a root README and root license/copying file;
4. valid existing entry-point files and no plugin-folder symlinks;
5. installation and removal instructions;
6. documentation of license and every external dependency;
7. an optional root `preview.png`, `.jpg`, `.jpeg`, `.webp`, or `.avif` (the
   Marketplace supplies a fallback if omitted);
8. a Marketplace submission issue containing the public repository URL, one
   category, one to three accepted tags, optional maintainer notes, and every
   required checklist confirmation.

The exact submission form is:
<https://github.com/HANCORE-linux/omarchy-plugin-marketplace/issues/new?template=submit-plugin.yml>.
At the checked snapshot its categories are Appearance, Desktop, Developer
Tools, Hardware, Productivity, System, Widgets, and Other. Its reusable tags
are AI, Bar, Hyprland, Launcher, Media, Power management, Quickshell, Security,
System, and Workspaces; a submitter may suggest one missing tag.

Automated validation snapshots the repository's default branch at one commit,
checks public reachability, root docs, exact root-manifest layout, manifest
compatibility, unique/unretired ID, and optional preview safety, then records
the commit SHA in its report. A maintainer still approves the listing. See
[`inspectSubmission`](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/blob/95b7333b1e806b12f07952772111c2da6a86897c/scripts/build-catalog.mjs#L1023-L1074)
and the [validation workflow](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/blob/95b7333b1e806b12f07952772111c2da6a86897c/.github/workflows/validate-submission.yml).

## 4. Validation and runtime evidence

Run structural and static checks from a clean checkout before submission:

```bash
PLUGIN_DIR="$PWD"
omarchy plugin validate "$PLUGIN_DIR"
qmllint -I "$OMARCHY_PATH/shell" \
  "$PLUGIN_DIR/BarWidget.qml" "$PLUGIN_DIR/Panel.qml"
```

Pass every project QML/JavaScript/backend test in addition to those two checks.
The exact QML file list must include every shipped QML file, not just the two
example names.

Then install and exercise the same public repository contract a user receives:

```bash
omarchy plugin add "https://github.com/<owner>/<repo>.git"
omarchy plugin enable <plugin-id>
omarchy plugin list --json | jq --arg id '<plugin-id>' \
  '.[] | select(.id == $id)'
omarchy-shell shell summon <plugin-id> '{}'
omarchy-shell shell hide <plugin-id>
```

The release evidence bundle must show:

- `omarchy plugin validate` and `qmllint` exit successfully;
- discovery reports the intended ID, kind, and enabled state;
- bar click, panel open, Escape close, IPC summon, and IPC hide work;
- active timers and persisted state survive panel close, shell restart, and
  expected offline operation;
- disable and re-enable work;
- removal is safe and documented, and reinstall from the public default branch
  works in a clean user-owned plugin directory;
- `qs log -p "$OMARCHY_PATH/shell" --tail 100` contains no DailyXP QML load or
  runtime errors during the test;
- screenshots or a short recording demonstrate the real plugin, while the
  public commit SHA and submission issue URL tie that evidence to the submitted
  code.

Do not restart or replace a user's shell casually during ordinary development.
For the final release test, a deliberate shell restart is required because
hot-reload success alone does not prove cold-start behavior.

## 5. Competition contract

The controlling primary source is DHH's 2026-08-19 announcement,
[“The first plugin competition”](https://omarchy.org/news/2026/08/the-first-plugin-competition).

### Explicit rules

- Every plugin “submitted to the repository” before **Monday, 2026-08-24 at
  09:00 CEST** is eligible, including plugins already listed. In context, the
  linked repository is the Omarchy Plugin Marketplace registry.
- The Omarchy Core Team selects a first/second/third podium by vote.
- Prizes are USD 2,500, USD 1,000, and USD 500.
- A winner must be able to receive payment via Zelle, Venmo, PayPal, or EU IBAN.
- Winners will be announced the following week, no later than Friday,
  2026-08-28.

The deadline converts to **2026-08-24 10:00 EEST (`Africa/Cairo`)** and
**2026-08-24 07:00 UTC**. Because the page uses CEST explicitly, this is not an
ambiguous local-time interpretation.

### What is not promised

The announcement does not publish a scoring rubric, minimum feature set,
minimum repository age, required license type, team-size rule, geographic
restriction, or a definition of “submitted.” It therefore does not resolve
whether an open issue, a validation-passing issue, maintainer approval, or a
completed listing is required by the deadline. Its closing phrase says the best
“ideas and execution” should win, but converting that phrase into weighted
judging criteria would be an unsupported inference. Product scope should
therefore be judged by coherent, polished, demonstrably working execution
rather than guessed point weights.

### Submission evidence to preserve

- URL and creation timestamp of the Marketplace submission issue before the
  deadline;
- public repository URL and submitted default-branch commit SHA;
- valid root manifest, README, license, install/removal documentation, and
  dependency/permission disclosure at that SHA;
- automated Marketplace validation and security-baseline comments;
- any maintainer-requested fixes and the final listing URL;
- the local validation/runtime evidence listed above;
- private confirmation that Mohamed can receive a prize through at least one
  accepted payment rail (do not publish payment details).

## 6. Contract to carry into the PRD and tickets

Every DailyXP specification and delivery ticket that touches the Omarchy client
must include applicable acceptance criteria from this compact gate:

- [ ] Runs inside the existing `omarchy-shell`; no second Quickshell process.
- [ ] Public repository root is a directly installable single-plugin root.
- [ ] Permanent lowercase namespaced ID; never `omarchy.*`.
- [ ] Manifest kind and entry point agree; nested panel lifecycle is forwarded.
- [ ] No symlinks, privilege escalation, install hooks, or silent dependencies.
- [ ] Local state, network access, backend, permissions, and removal disclosed.
- [ ] Structural validation, `qmllint`, runtime lifecycle, cold-start, offline,
      disable/re-enable, removal, and clean-install checks have evidence.
- [ ] Marketplace submission issue exists before 2026-08-24 10:00 Cairo time.
- [ ] Submitted commit and validation/listing evidence are preserved.

## Sources

Primary sources only were used:

- [DHH competition announcement](https://omarchy.org/news/2026/08/the-first-plugin-competition)
- [Installed-version Omarchy Quattro shell reference](https://github.com/basecamp/omarchy/blob/f0020448ca87329199de7cb12f2015ebc4a3e5e7/shell/README.md)
- [Installed-version plugin registry implementation](https://github.com/basecamp/omarchy/blob/f0020448ca87329199de7cb12f2015ebc4a3e5e7/shell/services/PluginRegistry.qml)
- [Installed-version CLI validator](https://github.com/basecamp/omarchy/blob/f0020448ca87329199de7cb12f2015ebc4a3e5e7/bin/omarchy-plugin-validate)
- [Installed-version built-in plugin reference](https://github.com/basecamp/omarchy/blob/f0020448ca87329199de7cb12f2015ebc4a3e5e7/shell/plugins/README.md)
- [Current Quattro head inspected for drift](https://github.com/basecamp/omarchy/tree/d3d9bea1eed3ade224a4bbf0389a4d5ac2ad534e)
- [Marketplace development guide](https://omarchyplugins.com/develop.html)
- [Marketplace publishing guide](https://omarchyplugins.com/publish.html)
- [Marketplace submission form source](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/blob/95b7333b1e806b12f07952772111c2da6a86897c/.github/ISSUE_TEMPLATE/submit-plugin.yml)
- [Marketplace validation implementation](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/blob/95b7333b1e806b12f07952772111c2da6a86897c/scripts/build-catalog.mjs)
- [Marketplace validation workflow](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/blob/95b7333b1e806b12f07952772111c2da6a86897c/.github/workflows/validate-submission.yml)
- [Marketplace security-baseline policy](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/blob/95b7333b1e806b12f07952772111c2da6a86897c/scripts/security-baseline-policy.mjs)
- installed copies of `/usr/share/omarchy/shell/README.md`,
  `/usr/share/omarchy/shell/services/PluginRegistry.qml`,
  `/usr/share/omarchy/bin/omarchy-plugin-validate`, and
  `/usr/share/omarchy/bin/omarchy-plugin-add`, checked against the upstream
  contract on 2026-08-20. The installed validator and registry were byte-for-
  byte identical to their pinned `f002044` upstream files. Recheck the live
  Quattro head and Marketplace rules immediately before submission because the
  installed package and both upstream repositories can move independently.
