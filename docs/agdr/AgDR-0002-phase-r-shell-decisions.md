# AgDR-0002: Phase R Shell Technical Decisions

> In the context of rebuilding DailyXP's UI as a Phase-R arcade shell on an Omarchy Quattro plugin, facing four coupled technical decisions with no prior portfolio precedent, I decided to adopt a Theme-singleton token bridge, keep-alive Loader stacking, a field-exact FixtureLoader contract, and a software-safe rendering rule to achieve a reviewable shell prototype whose evidence equals production and whose V2+ engine binds are wiring rather than rework, accepting that the fixture adapter is temporary scaffolding and that some visual fidelity is traded for determinism.

## Context

Phase R slice V1 (ticket da5ater/dailyxp#93) rebuilds the product's entire UI surface. The old architecture was one 1,847-line `Panel.qml` monolith; the new one is composed primitives under a host-independent `ShellContent`. Four technical choices had to be made before any code could land, each with real alternatives and cross-slice consequences. Spikes S1/S2 (2026-08-23) established feasibility facts this record builds on.

## Options Considered

| Decision | Options | Chosen |
|----------|---------|--------|
| Visual tokens | (a) inline literals everywhere · (b) **Theme singleton bridge** from Stitch design system | (b) |
| Screen mounting | (a) Loader `source` switching (destroy/recreate) · (b) **keep-alive stacking** (active-once, visibility toggles) | (b) |
| Stub data contract | (a) convenient ad-hoc fixture shapes · (b) **field-exact mirror of real model projections** with derived helpers | (b) |
| Scanline rendering | (a) GLSL `ShaderEffect` · (b) **software-safe rectangle rows** | (b) |

## Decision

All four chosen options above, because:

1. **Theme singleton** — spike S1 proved the palette renders credibly; a single source of visual truth prevents the token drift that made the old panel incoherent. Inline literals would recreate entropy with every new screen.
2. **Keep-alive stacking** — preserves per-tab state across navigation (an explicit AC), and sidesteps the Loader-focus-recreation problem flagged during shaping; the pre-agreed fallback became the primary design.
3. **Field-exact fixtures** — Rex's review of the first draft proved the failure mode concretely: invented shapes (`todayOccurrences`, `budgetLabel`, `toNextLevel`) would have forced every V2–V8 slice through a rename pass. Fixtures now mirror `PlanningModel`/`HabitModel`/`StoryModel`/`ProgressionModel`/`RecoveryModel`/`UxModel` empty-projections exactly, with derived views (`todays()`, `overdue()`, `habitDoneToday()`, `levelProgress()`) computed the way the models compute them.
4. **Software-safe rendering** — spike S2 showed custom `ShaderEffect`s silently vanish under the software renderer used by the deterministic harness; adopting only techniques that survive it makes harness evidence equal production output by construction.

## Consequences

- Every surface composes from `arcade/` primitives + `Theme.qml`; new domains must not introduce raw color/font literals.
- Per-tab state survives navigation by construction; focus enters via `forceControllerFocus()` from the host keyCatcher chain.
- Each V2+ slice swaps its domain's fixture source for the real projection without touching screen markup; the adapter retires progressively and leaves no residue if slices hold the discipline.
- No GLSL effects anywhere in the shell; scanlines are 1px rectangle rows at α≈0.05–0.06.
- Accepted cost: fixture data is static until its slice binds the real engine; visual polish trades determinism over fancy effects.

## Artifacts

- Ticket: da5ater/dailyxp#93 (V1), PR da5ater/dailyxp#101
- Shaping docs: `projects/dailyxp/shaping/{shaping-doc,slices}.md` (ops repo)
- Spikes: S1 (token-bridge fidelity), S2 (evidence harness) — proven 2026-08-23
- Commit: `93a88b5` + Rex-fix commit on branch `feature/GH-93-shell-play-lands`
