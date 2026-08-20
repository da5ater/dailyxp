# DailyXP V1 Product Requirements

**Status:** Revised

## Product thesis

DailyXP turns intentional work, habits, goals, and recovery into a durable game
of personal progress. The product must make starting useful work easier, make
progress emotionally legible, and create healthy social competition without
selling power, punishing setbacks, or exposing sensitive activity.

The first client is an Omarchy 4/Quattro plugin. DailyXP remains a portable
product rather than an Omarchy-only implementation: local rules and the sync
protocol are platform-neutral, and the hosted Rails/PostgreSQL service can move
from AWS to a small home server without a product rewrite.

## Goals

- Let a person plan Goals, Milestones, Tasks, Routines, Sessions, Habits, and
  Recovery Tracks with low setup overhead.
- Make one current activity and its timer the dominant daily interaction.
- Award transparent Lifetime XP while keeping competitive Season XP
  standardized, capped, and resistant to trivial farming.
- Make permanent progress visible through Levels, Story Ranks, Achievements,
  Momentum, and the Reclaimed Kingdom story.
- Provide global, geographic, Skill, private, Head-to-Head, Group, Guild, and
  privacy-safe Recovery competition.
- Make statistics and achievements easy to share without automatic posting or
  accidental disclosure.
- Preserve useful local-only behavior without an account or network.
- Ship an honest, polished competition build before completing the full V1.
- Keep all features free, with no ads, sale of data, or purchasable advantage.

## Non-goals

- DailyXP is not healthcare, diagnosis, treatment, or an emergency service.
- V1 does not provide unrestricted comments, direct messages, contact uploads,
  precise location tracking, surveillance, or automatic Session detection.
- V1 does not sell features, XP, streak protection, ranking power, or Recovery
  functionality.
- V1 does not promise high availability while hosted on a single application
  instance and Single-AZ database.
- Native non-Omarchy Linux, macOS, and Windows clients are not V1 deliverables;
  portable contracts are.
- DailyXP does not copy Fantasy Premier League branding, assets, or trade dress.

## Product principles

1. **Local first:** record locally, respond immediately, and sync later.
2. **One meaningful next action:** complexity appears only when relevant.
3. **Permanent earned progress:** inactivity may reduce Momentum, never
   Lifetime XP, Levels, Story Ranks, Achievements, or completed Provinces.
4. **Transparent scoring:** every award or correction is explainable.
5. **Healthy competition:** nearby ranks, comparable cohorts, caps, rest, and
   comeback mechanics matter more than an unreachable global top.
6. **Sensitive by design:** Recovery and private activity are never made public
   implicitly.
7. **Portable and inexpensive:** choose the cheapest architecture that retains
   required efficiency, reliability, and behavior.
8. **Honest releases:** no fake social data, unavailable buttons, or unsupported
   production claims.

## Primary experience

DailyXP has three primary surfaces:

- **Play:** the active or selected Task and Session controls, the current
  Fixture or nearby-rank strip, Daily Target progress, today's Routine Task
  Occurrences and one-shot Tasks, Habits, protected Recovery Tracks, and a
  collapsed overdue area.
- **Journey:** crest, Level, Story Rank, XP progress, Momentum, current Province,
  kingdom map, Achievements, statistics, Skill mastery, records, competition
  history, and Share Cards. Recovery history has a separate protected entry.
- **World:** current Fixture, active Division, nearby global/country/region
  ranks, Skill Leagues, Guild competition, Circles, and Group discovery.

Creation and editing use focused sheets opened from those surfaces. Settings
and profile live behind the avatar. New users initially see Play and a short
setup path; Journey and World reveal themselves as progress and online play
become relevant.

The bar widget shows the current state without reproducing the full panel:
Level crest and selected Task while idle; elapsed/planned time and pause while
running; resume while paused; brief match and Achievement transformations; and
a quiet offline/sync indicator. Normal click opens Play. Direct controls do not
open the panel accidentally.

## Planning and focused work

### Hierarchy and lifecycle

- A Goal is a long-term outcome with an optional target date, primary Skill,
  and personal reason. It may be active, paused, achieved, abandoned, or
  archived.
- A Milestone is binary, numeric, time-based, Task-based, or consistency-based.
  Its visible reward is calculated from effort, duration, and significance and
  locks once progress begins.
- A Task is finite and may stand alone. It records an estimate, urgency,
  optional deadline, primary Skill, and optional Goal/Milestone.
- A Routine generates dated Task Occurrences on weekdays or a custom
  frequency. It supports expected duration, start/end dates, rest days,
  carryover, Skill, and Goal/Milestone association.
- A Habit is independently scheduled and recorded by completion or count.
- A Recovery Track is independent from Habits and Goals, though it may support
  a Goal privately.

Routine edits apply to today, today and future, or all untouched occurrences.
Completed history never changes. Carryover makes an unfinished occurrence
overdue without duplicating it or its XP; the new day's occurrence still
exists. The person may complete, reschedule, skip, dismiss, archive, or merge an
overdue occurrence into today's equivalent. Repeated misses trigger a smaller
rescheduling suggestion rather than an intimidating backlog.

Unstarted records may be deleted. Scored or competitively relevant records are
archived or corrected through an auditable adjustment; a privacy deletion may
erase the source while recalculating affected competitive projections.

### Sessions and time

Selecting a Task declares intent but does not start time. After a configurable
delay, one reminder offers Start, Change Task, or Dismiss. Only one Session may
run across the account. It can start, pause, resume, finish, discard, or change
Task attachment. A free Session is allowed. Several Sessions may support one
Task, and elapsed time never completes the Task or a Habit automatically.

A Session may be planned or open-ended. Passing its planned duration requires
confirmation before further competitive XP accrues. Local inactivity prompts
for confirmation without capturing keys, screens, URLs, or content. A maximum
of 12 focused hours per DailyXP day can contribute competitive XP. Finished
Sessions are freely editable for 24 hours; later corrections are explicit
adjustments. A cross-boundary Session belongs to the day containing most of its
focused minutes.

Events store UTC instants plus timezone and local-date context. The default Day
Boundary is 04:00 local and is configurable. Day-boundary, timezone, and
daylight-saving changes cannot duplicate occurrences, Streaks, bonuses, or
Season XP. Competitive rounds use a published authoritative timezone.

### Onboarding and nudges

First run asks for one Goal, one suggested daily Routine, up to three optional
Habits, and a first Session. Everything is editable or skippable. Templates may
preview complete starter journeys for study, building, interviews, reading,
languages, exercise, recovery, or a custom objective, but never create public
memberships.

DailyXP may suggest Milestones, Skills, schedules, reduced or increased
targets, moving a Routine, splitting a Task, rest, or turning repeated Tasks
into a Routine. Every suggestion explains why, requires acceptance, and stays
dismissed for a meaningful interval. Opening and closing rituals are optional,
short, and never required to keep data valid.

## XP, progression, and story

### Award economy

- One confirmed focused minute awards 1 Lifetime XP.
- Completing a planned Session awards a 20% Lifetime XP bonus.
- Meeting a Daily Target awards a 25% Lifetime XP bonus.
- Each scheduled Habit awards 20 Lifetime XP; up to seven Habits contribute to
  Season XP per day, while additional Habits remain personal progress.
- Completing the entire scheduled Habit set awards 50 Lifetime XP.
- Milestones award 250–6000 Lifetime XP based on locked significance.
- Goals award an Achievement and story progress rather than arbitrary
  competitive power.
- Streak bonuses are capped and non-exponential.
- Recovery uses its separate rules below.

Lifetime XP drives personal progression. Season XP drives competition and may
only come from standardized, capped awards. User-created large rewards never
farm Season XP. Every calculation is previewed and every award, version, and
correction appears in the XP Ledger. Stable event IDs make awards idempotent.

The next Level costs `500 + 50 × current level` Lifetime XP. Numeric Levels are
unbounded. Initial Story Rank thresholds are Wanderer 1, Settler 5, Builder 12,
Steward 20, Warden 35, Vanguard 50, Champion 75, Regent 100, and Sovereign 150.
Constants are configurable for balancing, but historical awards retain their
rule version.

### Reclaimed Kingdom

Each active Goal is a Province; Milestones are landmarks; work visibly rebuilds
it. Achieved Provinces remain visitable, paused Provinces sleep, and abandoned
Goals become reclaimable Ruins. The representation adds no resource-management
chores.

Momentum derives from the person's last seven eligible days and their own
schedule: Dormant, Stirring, Steady, Blazing, or Legendary. Rest days do not
hurt it. Drift represents repeatedly slipped work, Distraction abandoned
Sessions, Doubt an untouched Goal, and Apathy collapsed overall Momentum. After
sustained inactivity, the Hollow King may occupy only unfinished territory.
Each state explains its concrete cause without insulting the person.

After seven inactive eligible days, a three-day Comeback Quest asks for one
small meaningful action, then one planned Session or Routine, then a reduced
personal Daily Target. Success reclaims the Province, rebuilds Momentum, and
awards a modest Achievement; an incomplete attempt simply offers a smaller
restart.

Achievement families cover focus, Habits, Recovery, Goals, comebacks, Skills,
competition, Guild contribution, encouragement, and safe hidden discoveries.
Rewards are titles, badges, frames, kingdom cosmetics, sounds, celebration
styles, and Share Card designs; none changes scoring power.

## Recovery

Creating a Recovery Track selects or names a category, chooses now or a past
start, chooses visibility, and starts a Recovery Attempt. No daily checkbox is
required. Optional mood, trigger, and note check-ins do not control the counter.
Normalized categories include pornography, smoking, alcohol, gambling, gaming,
social media, and moderated custom categories. Public presentation uses a
neutral label unless the person explicitly reveals the category.

Each completed day awards 20 Recovery XP. Milestones at 1, 3, 7, 14, 30, 60,
90, 180, and 365 days award progressively larger Lifetime XP and Achievements.
Duplicate tracks cannot multiply rewards. A backdated start establishes
personal history without retroactive competitive Season XP.

Every track begins personal-only. A person may additionally select a private
Recovery Circle, region, country, and global board. Shared boards show a
pseudonym, current streak band, Recovery XP, selected Achievements, and Rank;
they never expose relapse count, notes, exact start timestamp, or identity by
default. Boards support current streak, personal-best improvement, current
season Recovery XP, consistency, and comeback views, with nearby/similar-stage
people emphasized.

Recording a relapse privately ends the Attempt, preserves earned Lifetime XP
and Achievements, removes the ended Attempt from current-streak ranking, and
offers restart now, later, or pause. There are no failure sounds or shaming
effects. Historical Attempts stay private unless a personal-best Achievement is
explicitly shared. Recovery has no Streak freezes; a missed check-in is unknown,
not a relapse.

Recovery congratulations use supportive presets, are pseudonymous by default,
cannot react to relapse, and can be muted or blocked. Recovery data is excluded
from ordinary Share Cards, analytics, notification previews, and geographic
statistics below an anonymity threshold. A person may delete one Attempt, a
Track, or all Recovery data.

## Competition and community

### Identity, geography, and relationships

Local mode needs no account. Cloud identity supports verified email/password
and GitHub OAuth, safe account linking, password reset, revocable devices, a
unique handle, optional display name/avatar/bio, field-level visibility, and a
private OAuth email. Following is one-way public visibility; Friendship is
mutual; Circle membership grants only Circle visibility; blocking creates
immediate mutual invisibility.

CloudFront may suggest country and first-level region from request metadata.
The person confirms or manually selects them; DailyXP retains no GPS, city,
coordinates, or raw IP for this feature. Geographic changes apply next Season.

### Leagues and Seasons

Synced users enter global, confirmed country, confirmed region, and one chosen
Skill competition. Recovery publication remains separately consented. A
default Season lasts four weeks. Divisions contain about 30 similarly active
people and use Bronze, Silver, Gold, Platinum, Diamond, and Sovereign tiers;
normally the top five promote and bottom five relegate. Global boards remain
available, but nearby rank and personal improvement are the default emphasis.

Season XP resets after reconciliation; Lifetime XP, personal records, kingdom,
and Achievements remain. Completed Seasons become read-only summaries. A person
may opt out without permanent loss.

Skills form normalized hierarchical paths such as `backend/study`,
`backend/build`, or `philosophy/kant`. Work carries one primary Skill and up to
three descriptive tags, so one event contributes competitively to only one
Skill. A person may follow unlimited Skills and compete in up to three active
Skill Leagues per Season. Suggestions derive from tracked work but require one
click to enroll.

### Head-to-Head, Groups, and Guilds

A Head-to-Head League schedules one Fixture per player per round, one week by
default. Higher standardized Season XP wins; win/draw/loss awards 3/1/0 table
points. Standings break ties by total Season XP, then focused minutes, then a
shared position. An odd membership rotates a no-points bye. Fixtures lock at
Season start and pair everyone as evenly as the rounds permit. The Play surface
may show the opponent, live score, gap, round time, and rate-limited events such
as “You passed Mo!”

Groups can be public/searchable, unlisted by code/link, or private/approval
only, with capacity, topic, tags, language, availability, country/region,
activity, and privacy visible before joining. Modes are classic Seasonal,
Head-to-Head, Team Season, Support Circle, and Recovery Circle. Standardized
targets include focused minutes, Season XP, Sessions, Habit completion rate, or
a shared numeric Milestone. Owners and moderators manage future rules and
membership but cannot rewrite earned scores or historical rules. Members may
leave, block, and report.

A Guild is a persistent team that can compete with other Guilds. The primary
score is average eligible Season XP among active members with minimum
participation and per-member caps; total XP/time remain visible statistics.

Congratulations are one-tap positive presets with optional short reactions.
There are no unrestricted comments or direct messages. Recipients may restrict
them to friends/Groups or disable them. Group rules, content, and penalties are
auditable and appealable.

## Statistics, sharing, feedback, and accessibility

Journey shows focused time by period and by Skill, Goal, Task, and optional
application; Session patterns; Habit consistency; progress; XP sources; League
history; and records through timelines, heatmaps, distributions, and diagrams.
There is no primary calendar-planning view.

Optional Omarchy application detection is disabled by default and records only
application name and time during a Session. Raw history stays local; window
titles, URLs, keys, screenshots, and content are never collected. The person
may rename, merge, exclude, delete, or explicitly upload aggregate labels.

Share Cards cover Sessions, daily/weekly focus, Skills, Achievements, Story
Ranks, Goals, Habits, explicitly selected Recovery milestones, Fixtures,
Seasons, and Guild results. A preview lets the person remove every field. The
client saves/copies the image or opens a prepared X, LinkedIn, or Facebook post;
it never posts automatically.

The visual direction is a living midnight kingdom: near-black/navy foundation,
warm gold permanent progress, cyan focus, emerald healthy completion, violet
Skills, and restrained crimson for rivalry, urgency, and the Hollow King. It
uses modern typography and original kingdom art, not parchment or generic
dashboard styling.

Motion tiers are 100–180 ms micro feedback, 220–420 ms spatial transitions, and
700–1800 ms meaningful celebrations. Motion is interruptible and reduced
motion replaces travel/particles with restrained fades or static emphasis.
Sounds distinguish start, pause, completion, XP, Achievement, Level, and match
victory, with no negative relapse sound. Master/category volumes, quiet hours,
Focused/Adventurous/Quiet profiles, visual equivalents, keyboard navigation,
visible focus, screen-reader labels, high contrast, color-safe states, and text
scaling are required. English ships first; strings and layout support
localization and RTL, with Arabic first afterward.

Notifications allow one upcoming and one ending reminder, immediate meaningful
Achievements/congratulations, bundled optional rank changes, quiet hours, and
category controls. Local events notify locally; server contact is reserved for
social/competitive freshness. No guilt notifications or relapse exposure.

## Data, synchronization, and privacy

The client first writes every change to a versioned local event log and derives
local projections. Stable event and device IDs make upload retryable and
idempotent. Additive events merge; profile/settings prefer the newest confirmed
edit; structural conflicts prompt; deletion wins unless explicitly restored.
The server may correct competitive Season XP transparently but never silently
delete local history. “Sync pending” distinguishes provisional standings.

Account creation previews upload scope: all eligible history, selected
categories, or future only. Recovery has a separate decision. Local data stays
until verified. Exports include JSON plus readable CSV and generated images.
People can delete individual data classes or the account; minimal anti-abuse or
security evidence has a documented bounded retention.

The public alpha is 18+. Every profile field has private, Circles, Groups, or
public visibility. Recovery is sensitive application data, encrypted locally
and server-side. Tokens use the system secret service where available. Logs and
crash reports exclude identities, credentials, private text, precise activity,
and Recovery information. The product never sells personal data or uses
sensitive data for advertising.

## Architecture and repositories

`da5ater/dailyxp` is the canonical public product repository and directly
installable Omarchy plugin root. Permanent identity is
`io.github.da5ater.dailyxp`; the root contains one schema-version-1 manifest,
bar-widget entry point, nested panel, public README, GPL-3.0-or-later license,
assets with provenance, tests, protocol contracts, and product docs. It runs in
the existing unsandboxed `omarchy-shell`, starts no second Quickshell process,
uses no root privileges or install hooks, and documents every dependency,
network endpoint, data path, permission, and removal step.

`da5ater/dailyxp-api` is created when backend delivery starts. It is a public
containerized Rails API modular monolith with PostgreSQL and explicit internal
modules for identity, activity, progression, competition, Recovery, social,
moderation, and sharing. The repositories share versioned protocol fixtures,
but release independently and remain backward compatible during migration
windows.

The portable hosted stack is Rails, PostgreSQL, standard SMTP, filesystem or
S3-compatible object storage, reverse proxy, and background jobs through Docker
Compose. AWS adapters do not enter domain logic. Initial AWS hosting is a 2 GB
Lightsail Linux application instance deployed with Kamal, an encrypted private
Single-AZ RDS PostgreSQL instance with 20 GB general-purpose storage and
automated backups, CloudFront, SES, optional S3, and short-retention CloudWatch
logs. Solid Queue and Solid Cache use PostgreSQL; adaptive HTTPS polling avoids
Redis and WebSockets initially.

CloudFront provides the public edge and coarse location headers. Rails enforces
rate limits and a secret origin contract; Lightsail exposes only required
ports; PostgreSQL is private. Scaling is evidence-triggered: resize compute,
split workers, add Redis, move to ECS/Fargate, add WebSockets, or enable
Multi-AZ only when measured behavior justifies cost.

No AWS resource capable of charging is provisioned without Mohamed's explicit
approval. Before application resources, establish estimates, budgets, anomaly
alerts, quotas, retention, and shutdown/rollback procedures. Every technical
ticket records fixed and usage-sensitive cost at current, 100-user, and
1,000-user load; cheaper alternatives; chosen value; caps; observed cost; and
portability impact. Infrastructure remains locally testable without AWS.

An open cold ticket dated 2026-10-20 tracks actual AWS resources/cost, revenue,
usage, portability, the i7/8 GB/1 TB home-server target, security/availability
trade-offs, migration rehearsal, rollback, and the AWS/downsize/hybrid/home
decision. Every merged technical ticket appends a dated re-audit, even when the
result is “no change.” Only Mohamed activates migration.

## Observability, support, and updates

DailyXP emits structured JSON logs with stable event names, request/trace/device
correlation, build and schema versions, monotonic duration, and native
structured exceptions. Each request has one canonical completion log; lower
layers attach context rather than duplicating errors. An allowlist excludes
credentials, identities, private text, Recovery data, window titles, URLs, and
precise location. Metrics are low-cardinality and Prometheus-compatible; health
endpoints, sync lag, jobs, database, mail, and error rates remain portable.

The support surface offers Report a problem, Request a feature, known issues,
copy diagnostics, open logs, and check for updates. A previewable diagnostic
bundle contains versions, build, sanitized recent logs, sync/schema health,
non-sensitive settings, and crash fingerprint. A server-held least-privilege
GitHub App deduplicates opted-in client and server crash fingerprints into
sanitized GitHub issues; repeated occurrences update the issue. No token ships
in the client and no report uploads without consent.

DailyXP automatically checks stable releases. Default update opens Omarchy's
official `omarchy plugin update io.github.da5ater.dailyxp` diff-and-confirm
flow; explicitly opted-in stable auto-update is
allowed for clean managed checkouts, with validation and rollback. Dirty
development checkouts never auto-update. Stable and preview channels use
semantic versioning; `0.x` denotes competition/alpha and `1.0.0` the complete
accepted V1.

## Operations, safety, and governance

Moderation covers public identity, tags, Groups/Guilds, congratulations,
invitations, and cheating—not private notes. Automated filters may hold public
abuse; material penalties require reason, audit, notice, and appeal. Competitive
restriction is preferred over account suspension and does not remove local
functionality. Administrators cannot inspect private Task or Recovery notes.

Required public documents before cloud enrollment are privacy policy, terms,
community guidelines, security policy, retention/deletion policy, Recovery
disclaimer, licenses/notices, and status/support information. They describe
implemented behavior and recommend professional legal review before broad
scale.

The plugin and local functionality remain free. Hosted features are also free,
subject only to equal fair-use rate, storage, upload, and abuse limits. There
are no ads or paid advantages. Optional donations or sponsorships provide no
functional benefit.

## Release and verification

The competition release is an honest `0.x` vertical slice, not a redefinition
of V1. It includes the validated Omarchy shell, local planning and focus loop,
durable state, local XP/progression, initial Kingdom, Habits, private Recovery,
statistics, Share Cards, feedback, and accessibility. Cloud/social surfaces
appear only when backed by working behavior. Sample data is fictional, labeled,
and isolated.

The exact default-branch commit must pass manifest validation, `qmllint`, all
project tests, clean installation, bar/panel/IPC lifecycle, Escape, shell
restart, offline timer/state, disable/re-enable, removal, and reinstall. The
Marketplace submission and validation evidence must exist before 2026-08-24
10:00 Africa/Cairo. Current Omarchy and Marketplace rules must be rechecked
immediately before submission.

Every delivery ticket follows branch → draft PR → implementation → spec and
standards review → fixes → repeat until no blocker → ticket evidence and cost
audit → cold-ticket re-audit → Mohamed handoff. Only Mohamed's explicit
`merge` authorizes merging, and only one implementation ticket is active.

## Risks and responses

- **Four-day competition window:** submit the smallest polished local slice
  early and keep the default branch installable; never fake full V1 readiness.
- **QML persistence feasibility:** prove safe XDG event persistence and crash
  recovery before building dependent domain behavior.
- **Unsandboxed plugin:** minimize dependencies/process execution, validate
  inputs, disclose access, and test cold shell behavior.
- **Competitive abuse:** server-side scoring, caps, idempotency, adjustment
  audit, and affected-event restriction.
- **Recovery harm or disclosure:** personal default, category isolation,
  pseudonyms, anonymity thresholds, deletion, and non-medical language.
- **Social moderation load:** bounded reactions, no DMs/comments, staged cloud
  enrollment, rate limits, block/report/appeal.
- **Single-host availability:** local-first behavior, honest status, tested
  backups/restores, and measured scaling triggers.
- **AWS cost:** explicit provisioning approval, estimates, alerts, limits,
  short retention, and the 2026-10-20 portability checkpoint.
- **Home-server migration:** standard containers/PostgreSQL/SMTP/storage,
  encrypted off-machine backup, rehearsal, and documented lower availability.

## Open questions

No unresolved product decision blocks implementation. Exact balancing values,
anonymity thresholds, resource sizes, retention days, and rate limits are
configuration constants that must be measured, documented, and reviewed within
their implementing stories before deployment.

## User Stories

### FOUND-001: Prove the installable Omarchy foundation

**Outcome:** A safe DailyXP bar widget and nested panel can host durable local-first behavior inside the existing Omarchy shell.

**Implementation Context:**
- Inspect `AGENTS.md`, `CONTEXT.md`, the installed Omarchy clock plugin, and the current Marketplace validator.
- Add the permanent root manifest for `io.github.da5ater.dailyxp`, bar entry point, nested panel lifecycle, minimal model, GPL license, and install/removal documentation.
- Prove an XDG-state persistence primitive with atomic recovery that needs no root access, second Quickshell process, or undeclared executable; record the chosen contract before dependent work.
- **Depends on:** None
- **Out of scope:** Product workflows, cloud calls, and visual polish beyond proving the shell and storage contracts.

**Acceptance Criteria:**
- [ ] Given a clean user-owned checkout, when Omarchy validates, installs, enables, summons, hides, restarts, disables, reenables, and removes DailyXP, then each lifecycle operation succeeds without losing the persisted probe state or affecting unrelated configuration.
- [ ] Given a write interrupted at each tested persistence boundary, when DailyXP reloads, then it recovers the last valid state without inventing or duplicating an event.
- [ ] Given the published folder, when Marketplace structural rules run, then it has one valid root manifest, no symlinks, no reserved ID, no privilege/install hook, and documented dependencies and data paths.

**Verification:**
- Run `omarchy plugin validate`, `qmllint` for every shipped QML file, persistence fault tests, clean-install/runtime lifecycle checks, and inspect `qs` logs after a cold shell start.

### MODEL-001: Establish the deterministic local event model

**Outcome:** DailyXP records versioned domain events and derives reproducible local projections offline.

**Implementation Context:**
- Implement stable event/device IDs, UTC and local-time context, schema versions, idempotent application, projection rebuild, export, and bounded migration/backup behavior.
- Keep XP arithmetic and domain transitions in pure testable code separate from QML presentation.
- **Depends on:** FOUND-001
- **Out of scope:** Cloud synchronization and final feature-specific projections.

**Acceptance Criteria:**
- [ ] Given the same valid event sequence, when projections rebuild repeatedly or after restart, then the resulting state is identical and no event is applied twice.
- [ ] Given timezone, Day Boundary, and daylight-saving changes, when daily projections rebuild, then completed history and unique daily occurrences remain stable.
- [ ] Given an unsupported or failed migration, when startup continues safely, then the original data remains recoverable and the user receives an actionable state.

**Verification:**
- Run deterministic replay, duplicate-event, clock-boundary, migration, backup/restore, and malformed-state tests without network access.

### PLAN-001: Plan Goals and recurring work

**Outcome:** A person can manage Goals, Milestones, Tasks, Routines, dated Task Occurrences, overdue work, and low-friction templates.

**Implementation Context:**
- Preserve the lifecycle, measurement types, carryover, rest days, edit scopes, deletion/archive, suggestion consent, and Goal → Milestone → Task/Routine hierarchy defined in this PRD.
- Tasks may stand alone; elapsed time never completes work automatically.
- **Depends on:** MODEL-001
- **Out of scope:** Running Sessions, XP awards, and social publication.

**Acceptance Criteria:**
- [ ] Given a recurring schedule, when a new DailyXP day begins or the Routine changes, then exactly the correct dated occurrences exist and completed history is unchanged.
- [ ] Given unfinished work, when carryover occurs, then the original becomes overdue without duplicate completion or a missing new occurrence.
- [ ] Given a template or adaptive suggestion, when the user previews, accepts, edits, or dismisses it, then only explicitly accepted commitments change.

**Verification:**
- Run lifecycle, recurrence, carryover, timezone, edit-scope, archive/delete, and template-preview tests.

### FOCUS-001: Run one trustworthy focused Session

**Outcome:** A person can select work and reliably start, pause, resume, finish, discard, correct, and recover one active Session.

**Implementation Context:**
- Support planned/open-ended and free Sessions, one account-wide active Session, multiple Sessions per Task, 24-hour free edits, later adjustments, inactivity confirmation, and a 12-hour competitive daily cap.
- Persist timestamps so panel and shell closure do not lose elapsed state.
- **Depends on:** PLAN-001
- **Out of scope:** XP presentation, application tracking, and cloud conflict resolution.

**Acceptance Criteria:**
- [ ] Given selected work, when no timer is running, then selection remains distinct and at most one dismissible reminder appears.
- [ ] Given any panel/shell restart or offline interval, when the Session resumes, pauses, or finishes, then focused duration reflects persisted state without double counting.
- [ ] Given a planned end, inactivity, correction, or excessive duration, when competitive eligibility changes, then the user confirms it and sees the resulting adjustment.

**Verification:**
- Run state-transition, clock-jump, restart, planned-end, inactivity, cross-boundary, correction, and cap tests plus live bar controls.

### HABIT-001: Track scheduled Habits and Streaks

**Outcome:** A person can complete or count scheduled Habits with fair Streak, rest-day, freeze, and daily-set behavior.

**Implementation Context:**
- A missed eligible Habit breaks only its Streak; rest days do not; an optional freeze is consumed explicitly; no permanent XP is removed.
- Cap competitive Habit contribution at seven per day and keep additional Habits personal.
- **Depends on:** MODEL-001
- **Out of scope:** Recovery Tracks and social Habit publication.

**Acceptance Criteria:**
- [ ] Given a Habit schedule, rest day, and optional freeze, when days advance, then eligibility and Streak state follow the configured schedule without duplicate completions.
- [ ] Given more than seven completed Habits, when awards calculate, then all eligible personal rewards remain visible while competitive contribution is capped.
- [ ] Given all scheduled Habits completed, when the set closes, then exactly one visible full-set bonus is awarded.

**Verification:**
- Run schedule, Streak, rest, freeze, day-boundary, cap, set-bonus, and duplicate-event tests.

### PROG-001: Award explainable XP and progression

**Outcome:** Qualifying activity produces an idempotent XP Ledger, Levels, Story Ranks, Momentum, and season-ready standardized scores.

**Implementation Context:**
- Implement the accepted minute, Session, Daily Target, Habit, Milestone, Goal, Streak, Level, Story Rank, Momentum, and rule-version contracts.
- Lifetime XP never decreases; Season XP is standardized and resettable; corrections are explicit ledger entries.
- **Depends on:** FOCUS-001, HABIT-001
- **Out of scope:** Server authority, League tables, and kingdom presentation.

**Acceptance Criteria:**
- [ ] Given any qualifying event or retry, when scoring runs, then each rule-versioned award appears exactly once with a human-readable reason and previewable calculation.
- [ ] Given inactivity or a missed plan, when Momentum changes, then permanent XP, Levels, Story Ranks, Achievements, and completed work remain unchanged.
- [ ] Given user-created significance, when competitive scoring runs, then arbitrary rewards cannot increase Season XP.

**Verification:**
- Run table-driven award, cap, rounding, idempotency, correction, Level threshold, Story Rank, Momentum, and season-reset tests.

### STORY-001: Make progress visible as a Reclaimed Kingdom

**Outcome:** Goals and consistency create a coherent kingdom narrative with Achievements, Hollow King states, and forgiving Comeback Quests.

**Implementation Context:**
- Map Goals to Provinces and Milestones to landmarks; implement achieved, sleeping, Ruin, occupied, and reclaimed states without a separate resource economy.
- Use Drift, Distraction, Doubt, Apathy, and the Hollow King only as explainable patterns; implement the accepted three-day Comeback Quest.
- **Depends on:** PROG-001
- **Out of scope:** Final high-fidelity art assets and social Achievement sharing.

**Acceptance Criteria:**
- [ ] Given Goal and progress lifecycle events, when story state derives, then the matching Province and landmark states appear without altering permanent progress.
- [ ] Given seven inactive eligible days, when the user succeeds, partially completes, or ignores a Comeback Quest, then the story responds without punishment or hidden loss.
- [ ] Given an antagonist state, when it appears, then DailyXP identifies the real behavior that caused it in neutral language.

**Verification:**
- Run narrative projection, Goal-state, inactivity, rest-day, comeback, permanence, and copy-safety tests.

### RECOV-001: Provide private local Recovery Tracks

**Outcome:** A person can privately start, observe, relapse, restart, and delete Recovery Attempts with supportive XP and milestone behavior.

**Implementation Context:**
- Implement normalized/private custom categories, optional check-ins, 20 Recovery XP per completed day, fixed milestones, no duplicate-track farming, no retroactive competitive XP, and separate protected history.
- Recovery has no freeze; missed check-in is unknown; explicit relapse alone ends an Attempt.
- **Depends on:** PROG-001
- **Out of scope:** Cloud publication, Recovery Circles, and geographic Recovery boards.

**Acceptance Criteria:**
- [ ] Given a new or backdated Track, when time advances, then the counter, milestone, personal history, and eligible awards follow the accepted rules without requiring check-ins.
- [ ] Given an explicit relapse, when confirmed, then the Attempt ends privately, earned permanent progress remains, and restart/pause choices appear without negative sound or shame.
- [ ] Given deletion of an Attempt, Track, or all Recovery data, when confirmed, then the selected sensitive data disappears from local projections and exports.

**Verification:**
- Run counter, timezone, milestone, backdate, duplicate-track, relapse, restart, privacy, encryption, and deletion tests.

### UX-001: Deliver the Play, Journey, and World experience

**Outcome:** DailyXP presents its complete information architecture through a distinctive, accessible living-midnight-kingdom interface.

**Implementation Context:**
- Use `gaming-entertainment`, `animate`, `apple-design`, and `frontend-design` during design and implementation.
- Implement the three surfaces, focused sheets, bar states, progressive disclosure, color system, motion tiers, reduced motion, keyboard navigation, focus, screen-reader labels, scaling, and color-safe states.
- **Depends on:** PLAN-001, FOCUS-001, STORY-001, RECOV-001
- **Out of scope:** Working cloud-backed World interactions not yet delivered by dependent stories.

**Acceptance Criteria:**
- [ ] Given a first-time, active, paused, returning, offline, or reduced-motion user, when they navigate with pointer or keyboard, then the current state and next meaningful action are clear without visiting a configuration dashboard.
- [ ] Given Play, Journey, and World content at supported scaling, when rendered, then no essential state depends only on color, sound, or animation.
- [ ] Given an interrupted transition, when the next action occurs, then motion responds without blocking control or losing spatial context.

**Verification:**
- Run QML/component tests and perform keyboard, screen-reader-label, text-scale, contrast, color-state, reduced-motion, interruption, and visual-regression checks.

### INSIGHT-001: Explain personal activity through statistics

**Outcome:** A person can understand focused time, work patterns, Skills, Habits, progress, and records without a calendar-planning screen.

**Implementation Context:**
- Provide period, Skill, Goal, Task, Session, Habit, XP, Level, competition, and record views; protect Recovery behind its separate entry.
- Optional application tracking is off by default, local, application-name-only, Session-bound, editable, and never captures content.
- **Depends on:** UX-001
- **Out of scope:** Cross-user analytics and server product analytics.

**Acceptance Criteria:**
- [ ] Given local history, when a period or dimension changes, then diagrams and totals reconcile with the underlying Sessions and ledger.
- [ ] Given application tracking disabled, enabled, excluded, renamed, merged, or deleted, when statistics rebuild, then only consented application-name aggregates appear.
- [ ] Given ordinary Journey navigation, when statistics render, then protected Recovery details never appear outside the Recovery entry.

**Verification:**
- Run aggregation/reconciliation, empty-state, timezone, application-consent, deletion, and privacy tests plus visual checks on representative datasets.

### SHARE-001: Export user-reviewed Share Cards

**Outcome:** A person can create and share an accurate progress image without automatic posting or hidden fields.

**Implementation Context:**
- Support the accepted Session, period, Skill, progression, Goal, Habit, Recovery, Fixture, Season, and Guild card types with fictional isolated sample mode.
- Save/copy locally or open prepared X, LinkedIn, and Facebook posts; Recovery uses its separate privacy flow.
- **Depends on:** INSIGHT-001
- **Out of scope:** Automatic posting and server-side social feeds.

**Acceptance Criteria:**
- [ ] Given a supported achievement or statistic, when the user removes fields and exports, then the resulting image contains only the previewed values and accurate branding.
- [ ] Given Recovery or private data, when ordinary card creation runs, then that data is absent unless selected through the protected flow.
- [ ] Given sample mode, when cards render, then fictional data is labelled and never enters real history or rankings.

**Verification:**
- Run field-inclusion, privacy, rendering, sample-isolation, copy/save, prepared-post, text-scale, and snapshot tests.

### FEED-001: Provide bounded sound and notifications

**Outcome:** Timers and meaningful progress feel responsive through controllable sound, motion, and non-nagging notifications.

**Implementation Context:**
- Implement the accepted sound events/profiles, category volumes, quiet hours, visual equivalents, one upcoming/end reminder, bundled rank events, and no relapse/missed-work punishment.
- Prefer local notification generation; social/competitive freshness may use server polling later.
- **Depends on:** FOCUS-001, PROG-001, UX-001
- **Out of scope:** Unbounded background push infrastructure.

**Acceptance Criteria:**
- [ ] Given sound, quiet-hour, reduced-motion, and notification settings, when each eligible event occurs, then exactly the permitted feedback appears and a visual equivalent remains.
- [ ] Given repeated rank changes or dismissed intent, when events continue, then notifications remain bundled/rate-limited and do not nag.
- [ ] Given relapse or missed work, when recorded, then no punitive sound, guilt notification, or sensitive preview appears.

**Verification:**
- Run notification-budget, quiet-hour, category, rate-limit, privacy, sound-profile, and accessibility checks.

### RELEASE-001: Submit the honest Omarchy competition build

**Outcome:** A public, directly installable `0.x` DailyXP build demonstrates the complete local gamification loop and is submitted with verifiable evidence.

**Implementation Context:**
- Recheck current Omarchy and Marketplace contracts; keep cloud-only controls absent or honestly unavailable; use only owned/licensed assets.
- Preserve the submission issue timestamp, exact commit, validation/security output, runtime evidence, preview, install/removal docs, and dependency disclosure before 2026-08-24 10:00 Africa/Cairo.
- **Depends on:** FOUND-001, PLAN-001, FOCUS-001, HABIT-001, PROG-001, STORY-001, RECOV-001, UX-001, INSIGHT-001, SHARE-001, FEED-001
- **Out of scope:** Claiming complete V1 or production-ready cloud/social behavior.

**Acceptance Criteria:**
- [ ] Given the exact public default-branch commit, when a clean Omarchy 4/Quattro user installs and exercises the documented lifecycle offline, then the local vertical slice works without QML/runtime errors.
- [ ] Given the Marketplace submission, when automated and maintainer checks inspect it, then required manifest, documentation, license, safety, preview, and provenance evidence are present.
- [ ] Given any sample or unavailable cloud surface, when a reviewer interacts, then it is clearly labelled and cannot be mistaken for live user behavior.

**Verification:**
- Run the complete release matrix in this PRD and preserve commands, versions, screenshots/recording, commit SHA, issue URL, validation output, and listing status.

### API-001: Establish the portable Rails/PostgreSQL service

**Outcome:** A separate public API repository runs the modular Rails application locally with PostgreSQL and no AWS dependency.

**Implementation Context:**
- Create `da5ater/dailyxp-api` only when this story starts; link the canonical product ticket and repeat merge, cost, privacy, and AWS approval rules in its `AGENTS.md`.
- Provide Docker Compose for Rails, PostgreSQL, SMTP test adapter, filesystem/S3-compatible storage adapter, reverse proxy, and PostgreSQL-backed jobs/cache.
- **Depends on:** MODEL-001
- **Out of scope:** AWS provisioning, user authentication, and production data.

**Acceptance Criteria:**
- [ ] Given a clean machine with documented prerequisites, when the local stack starts, then health checks and a versioned protocol endpoint work without AWS credentials or calls.
- [ ] Given adapter configuration changes, when tests run, then domain behavior does not depend directly on AWS SDK types.
- [ ] Given shutdown, migration, backup, and restore commands, when exercised locally, then PostgreSQL state is preserved and reproducible.

**Verification:**
- Run clean-shell setup, Rails tests, container build, protocol fixture, migration rollback, backup/restore, secret scan, and no-AWS-call checks.

### AUTH-001: Authenticate verified accounts safely

**Outcome:** A person can create, verify, recover, link, and revoke a DailyXP account through email/password or GitHub OAuth.

**Implementation Context:**
- Rails owns one identity system with modern password hashing, email verification, reset, rate limits, breached-password protection, private OAuth email, unique handle, revocable sessions/devices, and verified account linking.
- Local-only use remains credential-free; no long-lived GitHub token is retained without a future approved purpose.
- **Depends on:** API-001
- **Out of scope:** Other OAuth providers, SMS, and uploading local history.

**Acceptance Criteria:**
- [ ] Given a valid or invalid email/password flow, when signup, verification, login, reset, and rate limits execute, then only verified ownership enables social/competitive access.
- [ ] Given email and GitHub identities for the same person, when linking is verified, then one account results without takeover or duplicate public identity.
- [ ] Given a revoked device/session, when it retries, then authenticated and competitive writes are rejected without affecting local use.

**Verification:**
- Run authentication, enumeration, verification, reset, OAuth state/PKCE, linking/takeover, rate-limit, session rotation/revocation, and logging-redaction tests.

### SYNC-001: Synchronize local events without duplication or silent loss

**Outcome:** An account can preview migration from local-only use and synchronize selected event history across devices with explicit conflicts and corrections.

**Implementation Context:**
- Implement cursor-based idempotent event acknowledgment, stable IDs, pending state, upload scope preview, separate Recovery consent, additive merge, newest confirmed settings, structural conflict prompts, deletion precedence, and protocol compatibility.
- Server competitive calculations are authoritative but may only correct through visible ledger adjustments.
- **Depends on:** AUTH-001
- **Out of scope:** League projections and social notifications.

**Acceptance Criteria:**
- [ ] Given retries, reordering, duplicate delivery, offline edits, or interrupted migration, when sync converges, then acknowledged events appear once and unacknowledged local history remains intact.
- [ ] Given conflicting structure or deletion, when resolution is required, then deterministic rules or a user prompt preserve an auditable result.
- [ ] Given server score correction, when the client refreshes, then competitive totals and reasons update without silently deleting local source history.

**Verification:**
- Run multi-device property tests, retry/failure injection, conflict/deletion, protocol-version, migration-preview, Recovery-consent, and ledger-reconciliation tests.

### SOCIAL-001: Publish a consented social and geographic profile

**Outcome:** A person can control identity fields, relationships, blocking, and confirmed country/region participation.

**Implementation Context:**
- Implement per-field visibility, pseudonymous use, Following, Friends, Circle visibility, mutual block, shared-context suggestions, and CloudFront/manual geography with next-Season changes.
- Never upload contacts or retain GPS, city, coordinates, or raw IP for geography.
- **Depends on:** SYNC-001
- **Out of scope:** League ranking, Group administration, and Recovery publication.

**Acceptance Criteria:**
- [ ] Given each profile visibility scope and relationship, when another person views it, then only authorized fields are returned and cached.
- [ ] Given a block, when either party searches or interacts, then mutual visibility and interaction cease immediately.
- [ ] Given automatic suggestion, manual selection, travel, or location change, when geography is confirmed, then only country/region persist and competitive membership changes at the next Season.

**Verification:**
- Run authorization-matrix, block, cache, suggestion/confirmation, location-minimization, season-change, and account-deletion tests.

### LEAGUE-001: Rank standardized seasonal competition

**Outcome:** Synced users can participate in fair global, country, region, and tiered Division competition with durable summaries.

**Implementation Context:**
- Implement four-week Seasons, standardized/capped Season XP, nearby-rank default, about-30-person cohorts, Bronze through Sovereign, top-five promotion/bottom-five relegation, opt-out, reconciliation, and read-only summaries.
- Exact cohort and anonymity thresholds remain reviewed configuration values.
- **Depends on:** SOCIAL-001, PROG-001
- **Out of scope:** Skill-specific competition, Fixtures, Groups, Guilds, and Recovery boards.

**Acceptance Criteria:**
- [ ] Given eligible synchronized awards, when standings calculate or reconcile, then ranks use standardized Season XP once and show focused time separately.
- [ ] Given Season end, opt-out, promotion, relegation, tie, or low participation, when finalized, then the published rules produce a stable summary without altering permanent progress.
- [ ] Given country/region participation below its anonymity threshold, when requested, then the board stays hidden or aggregated.

**Verification:**
- Run scoring, deduplication, cohort, promotion/relegation, tie, opt-out, reconciliation, anonymity, reset, and historical-summary tests.

### H2H-001: Compete through weekly Head-to-Head Fixtures

**Outcome:** Players in a Head-to-Head League receive fair round fixtures, live comparisons, and a 3/1/0 table.

**Implementation Context:**
- Default to weekly rounds; lock fixtures at Season start; rotate odd-player no-points byes; pair evenly; use round Season XP for match score and total Season XP, focused minutes, then shared-position tiebreakers.
- Poll adaptively and bundle live pass/rank notifications.
- **Depends on:** LEAGUE-001
- **Out of scope:** Knockout cups and arbitrary creator-awarded match XP.

**Acceptance Criteria:**
- [ ] Given even or odd membership and the available rounds, when fixtures generate, then every player is paired as evenly as possible and byes rotate without free points.
- [ ] Given live eligible scoring, when one player passes another, then the match score and rate-limited Play notification update within the polling target.
- [ ] Given round and Season end, when scores tie or differ, then match points and table tiebreakers follow the published rules reproducibly.

**Verification:**
- Run schedule property tests, bye tests, score/tie/table tests, polling cursor/rate tests, lock tests, and Season-finalization tests.

### SKILL-001: Organize and rank hierarchical Skills

**Outcome:** People can discover normalized Skills, classify work once, and join up to three competitive Skill Leagues per Season.

**Implementation Context:**
- Maintain controlled broad Skills, normalized aliases, optional moderated subtopics, one primary Skill plus three descriptive tags, unlimited following, and consented enrollment suggestions.
- One activity contributes competitive Skill XP only to its primary Skill.
- **Depends on:** LEAGUE-001
- **Out of scope:** Automatic public exposure of Task names and unmoderated public taxonomy creation.

**Acceptance Criteria:**
- [ ] Given equivalent spellings or aliases, when discovery runs, then users find one canonical Skill path without losing original-language display.
- [ ] Given tagged work, when scoring runs, then the event contributes once to global Season XP and once to only its primary Skill competition.
- [ ] Given followed and suggested Skills, when the person accepts or changes enrollment, then at most three active competitive Skill Leagues exist for that Season.

**Verification:**
- Run normalization, Unicode/alias, scoring, enrollment-limit, privacy, suggestion-consent, and moderation-state tests.

### GROUP-001: Create safe Groups and Circles

**Outcome:** People can discover, join, administer, leave, block, and report public, unlisted, or private Groups and noncompetitive Support Circles.

**Implementation Context:**
- Implement capacity, name/topic/tags/language/availability/activity/privacy discovery, code/link and approval joining, owner/moderator roles, future-only material rule changes, report/block/leave, and bounded congratulations.
- Standard targets are focused minutes, Season XP, Sessions, Habit rate, or a shared numeric Milestone; arbitrary XP cannot affect competition.
- **Depends on:** SOCIAL-001, LEAGUE-001
- **Out of scope:** Guild-vs-Guild scoring and sensitive Recovery Circle content.

**Acceptance Criteria:**
- [ ] Given each discovery/privacy mode and capacity, when a person searches or joins, then only eligible metadata and membership actions appear.
- [ ] Given a material rule edit after competition starts, when the owner saves it, then historical/current scoring remains fixed and the change applies to a future phase.
- [ ] Given congratulations, leave, block, or report, when used, then permissions and rate limits take effect without comments or direct messaging.

**Verification:**
- Run discovery authorization, capacity/race, invitations, role, immutable-rule, target, reaction-rate, leave/block/report, and audit tests.

### GUILD-001: Let Guilds compete as teams

**Outcome:** Persistent Guilds can enter Seasons against other Guilds without size or one-member dominance.

**Implementation Context:**
- Score average eligible Season XP among active members with a minimum participation rule and per-member cap; display total XP/time as secondary statistics.
- Freeze the published formula for the Season and preserve final results.
- **Depends on:** GROUP-001
- **Out of scope:** Paid Guild administration and cross-Guild messaging.

**Acceptance Criteria:**
- [ ] Given Guilds of different size and activity, when a Season scores, then only eligible capped active-member contributions determine the comparable average.
- [ ] Given membership or rule changes, when they occur mid-Season, then the published eligibility snapshot prevents retroactive manipulation.
- [ ] Given Season completion, when results finalize, then placements and contributions remain auditable and shareable.

**Verification:**
- Run size-normalization, participation, cap, membership-change, tie, finalization, authorization, and Share Card integration tests.

### RECNET-001: Share Recovery progress safely

**Outcome:** A person can explicitly join private, regional, country, or global Recovery experiences without exposing relapse history or identity.

**Implementation Context:**
- Implement separate publication consent, category isolation, pseudonyms, current-streak bands, personal-best improvement, seasonal Recovery XP, consistency/comeback views, similar-stage defaults, Recovery Circles, anonymity thresholds, supportive presets, mute/block, and deletion propagation.
- Exact categories remain private unless explicitly revealed; no reaction exists for relapse.
- **Depends on:** RECOV-001, GROUP-001
- **Out of scope:** Medical advice, unrestricted comments/messages, and cross-category ranking.

**Acceptance Criteria:**
- [ ] Given each Recovery scope, when another person or aggregate query views it, then only the explicitly permitted pseudonymous fields appear and category anonymity thresholds hold.
- [ ] Given relapse, deletion, mute, block, or leaving a Circle, when projections update, then current rankings/interactions change without publishing historical sensitive facts.
- [ ] Given a newcomer or comeback, when default boards render, then comparable-stage and improvement views are available rather than only longest-ever Streak.

**Verification:**
- Run privacy-matrix, category-isolation, pseudonym, anonymity, relapse, ranking, congratulations, mute/block, deletion, and adversarial inference tests.

### MOD-001: Moderate public behavior with accountable tools

**Outcome:** Authorized moderators can address public abuse and competitive cheating without access to private activity or unreviewable punishment.

**Implementation Context:**
- Cover public identity, taxonomy, Groups/Guilds, invitations, congratulations, score corrections, restrictions, notice, evidence minimization, audit, and appeal.
- Prefer event/competition restrictions over account suspension; private Task and Recovery notes remain inaccessible.
- **Depends on:** GROUP-001, GUILD-001, RECNET-001
- **Out of scope:** Proactive inspection of private content and automated permanent bans without review.

**Acceptance Criteria:**
- [ ] Given a report or suspicious score, when a moderator acts, then the action requires a reason, uses least privilege, records an audit entry, notifies the affected person, and offers appeal where material.
- [ ] Given an authorized moderator query, when it targets private Task or Recovery notes, then access is denied and audited.
- [ ] Given a competitive restriction, when applied, then affected ranking events are excluded while personal/local history remains available.

**Verification:**
- Run role/authorization, evidence-retention, private-data denial, score-adjustment, restriction, notice, appeal, and audit-integrity tests.

### OBS-001: Make failures diagnosable and reportable

**Outcome:** DailyXP produces privacy-safe correlated diagnostics and turns new sanitized crash signatures into actionable deduplicated GitHub issues.

**Implementation Context:**
- Use structured JSON, stable event names, build/schema metadata, monotonic duration, one completion log, contextual native exceptions, allowlisted fields, bounded rotation/retention, low-cardinality metrics, and portable health checks.
- Provide support actions and a previewable bundle; use a server-held least-privilege GitHub App; opted-in reports create/update fingerprints with rate/flood controls.
- **Depends on:** FOUND-001, API-001
- **Out of scope:** Raw log uploads, client-held GitHub tokens, sensitive fields, and automatic feature-request submission.

**Acceptance Criteria:**
- [ ] Given a request crossing client, API, and job boundaries, when it succeeds or fails, then correlation IDs connect one canonical completion event to contextual diagnostics without duplicate exception logging.
- [ ] Given a new or repeated sanitized crash fingerprint, when reporting consent permits upload, then one GitHub issue is created or updated with safe version/frequency/reproduction evidence and its URL is returned.
- [ ] Given Report problem, Request feature, Copy diagnostics, Open logs, or Known issues, when selected, then the user receives a previewable useful path without manually collecting versions.

**Verification:**
- Run log-schema, redaction/canary-secret, exactly-once, correlation, metric-cardinality, rotation/retention, health, consent, fingerprint/deduplication, flood, GitHub failure, and support-flow tests.

### UPDATE-001: Deliver safe release updates

**Outcome:** DailyXP detects releases and updates managed installations through Omarchy's official validated flow with opt-in automation and rollback.

**Implementation Context:**
- Support stable and preview channels; stable is default; show release notes/security relevance; dirty development checkouts never auto-update.
- Default to diff/confirm; explicit stable auto-update may use the official update command but must validate and restore the previous valid revision on failure.
- **Depends on:** FOUND-001, OBS-001
- **Out of scope:** A second package manager and unreviewed preview auto-updates.

**Acceptance Criteria:**
- [ ] Given a clean managed checkout and a newer release, when manual or opted-in stable update runs, then Omarchy's official mechanism updates, validates, rescans, and reports the installed version.
- [ ] Given a dirty checkout, preview release without opt-in, validation failure, or interrupted update, when checking/updating, then local work is preserved and the last valid plugin remains recoverable.
- [ ] Given an offline client or update-service error, when DailyXP runs, then core local behavior remains available without repeated alerts.

**Verification:**
- Run clean/dirty, stable/preview, offline, invalid-release, interrupted, rollback, rescan, and version-display tests against temporary Git remotes/checkouts.

### CLOUD-001: Deploy the cheapest efficient AWS alpha

**Outcome:** After explicit provisioning approval, DailyXP runs on the accepted Lightsail/RDS architecture with bounded cost, backups, rollback, and a portable exit.

**Implementation Context:**
- Define infrastructure before provisioning: 2 GB Lightsail Rails host, private encrypted Single-AZ RDS PostgreSQL with 20 GB storage/backups, CloudFront, SES, optional S3, short CloudWatch retention, least-privilege IAM, firewall/rate limits, Kamal, budgets/anomaly alerts, and shutdown/restore procedures.
- Record current/100/1,000-user estimates, cheaper alternatives, caps, actual cost, and home-server impact. Any charge-capable provisioning and material cost increase require Mohamed's explicit approval.
- **Depends on:** API-001, AUTH-001, SYNC-001, OBS-001
- **Out of scope:** Multi-AZ, Redis, WebSockets, ECS/Fargate, NAT Gateway, paid commitments, and automatic migration.

**Acceptance Criteria:**
- [ ] Given approved infrastructure definitions, when policy and cost checks run locally, then only accepted services, sizes, retention, network access, budgets, and alarms are present.
- [ ] Given Mohamed's separate provisioning approval, when deployment and restore drills run, then the API is reachable only through the intended edge, PostgreSQL stays private, backups restore, rollback works, and actual resources/cost are inventoried.
- [ ] Given loss of cloud service, when the client continues, then local planning, timers, XP, Recovery, statistics, and export remain usable with honest sync state.

**Verification:**
- Before approval run IaC/static policy, cost-calculator, container, security, backup/restore, and rollback simulations locally; after approval preserve read-only inventory, budget/alarm evidence, endpoint/network tests, backup restore, rollback, and observed-cost snapshots.

### LEGAL-001: Publish honest safety and community documents

**Outcome:** Cloud enrollment is governed by public documents that match implemented privacy, Recovery, moderation, licensing, retention, and support behavior.

**Implementation Context:**
- Publish privacy policy, terms, community guidelines, security policy/private reporting, retention/deletion policy, Recovery disclaimer, licenses/notices, and status/support information.
- State 18+ alpha, non-medical boundary, all-free/no-ads/no-sale contract, fair-use limits, Single-AZ availability, and appeal/deletion behavior without invented guarantees.
- **Depends on:** AUTH-001, SOCIAL-001, MOD-001, OBS-001
- **Out of scope:** Claiming professional legal approval unless obtained.

**Acceptance Criteria:**
- [ ] Given each implemented collection, sharing, moderation, retention, deletion, failure, and support path, when the public documents are audited, then the behavior is accurately disclosed and cross-document terms agree.
- [ ] Given cloud signup or Recovery onboarding, when the person proceeds, then applicable age, privacy, community, and non-medical disclosures are accessible before consent.
- [ ] Given third-party code/assets, when release notices are built, then ownership and compatible licenses are documented.

**Verification:**
- Perform implementation-to-policy trace review, link/accessibility checks, license/provenance scan, consent-flow test, and explicit legal-review-status check.

### V1-001: Release the complete free DailyXP V1

**Outcome:** Version `1.0.0` integrates every accepted local, cloud, Recovery, competition, social, safety, support, and portability capability without unresolved blocking findings.

**Implementation Context:**
- Reconcile all preceding stories, protocol versions, migrations, public docs, release notes, cost audits, cold-ticket audits, known limitations, and rollback evidence.
- Open the dated cold hosting ticket during post-PRD issue creation and ensure every merged ticket has re-audited it before this release.
- **Depends on:** RELEASE-001, SHARE-001, FEED-001, H2H-001, SKILL-001, GUILD-001, RECNET-001, MOD-001, UPDATE-001, CLOUD-001, LEGAL-001
- **Out of scope:** Native non-Omarchy clients and any paid product tier.

**Acceptance Criteria:**
- [ ] Given a new local-only user and a synced social user, when each completes the documented end-to-end journeys, then all accepted V1 behavior is available for free with correct privacy, accessibility, and offline degradation.
- [ ] Given the release gates, when independent spec/standards/security/privacy/cost/portability review completes, then no blocking finding, undocumented dependency, fake behavior, or unapproved charge remains.
- [ ] Given rollback of client or server, when the documented procedures run, then user-owned local data and backward-compatible service behavior remain recoverable.

**Verification:**
- Run all repository CI, protocol compatibility, migration/restore, end-to-end local/cloud, privacy/authorization, accessibility, moderation, performance, cost, portability, clean-install/update/removal, and rollback suites; preserve signed release identifiers and manual evidence.

## Changelog

- 2026-08-20: Authored the Draft from the completed Wayfinder decision tree and
  verified repository, Omarchy, Marketplace, competition, AWS, and logging
  context.
- 2026-08-20: Mohamed approved the complete PRD and explicitly retained the
  Rails/PostgreSQL architecture over the lower-cash-cost Lambda/DynamoDB
  alternative.
