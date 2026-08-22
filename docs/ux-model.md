# UX model

UX-001 delivers Play/Journey/World via `UxModel.js` pure seam and a living-midnight-kingdom surface in `Panel.qml`/`BarWidget.qml`.

- **Surfaces:** Play (active/selected task, session controls, fixture strip, today's occurrences/habits, overdue), Journey (crest/level/rank, kingdom map, achievements, stats, share), World (fixture, division, nearby ranks, skill leagues, guild/circles). Progressive disclosure: new users see Play first.
- **Bar widget:** level crest + selected task idle; elapsed/planned + pause running; resume paused; offline/sync indicator; click opens Play.
- **Visual:** near-black/navy foundation, gold permanent progress, cyan focus, emerald completion, violet skills, restrained crimson rivalry. Original kingdom art, not parchment.
- **Motion:** micro 100–180ms, spatial 220–420ms, celebration 700–1800ms; interruptible; reduced motion replaces travel/particles with fades.
- **Accessibility:** keyboard navigation, visible focus, screen-reader labels, high contrast, color-safe states, text scaling, English + RTL layout support.

`StateStore.qml` exposes `uxProjection` via `UxModel.project`; Panel binds `currentSurface` and focused sheets. Verification via QML component tests, keyboard/label/scale/contrast checks.

## Executable surface

`StateStore.qml` exposes `uxProjection` via `UxModel.project` and `applyUxCommand` (ux.navigate / sheet open/close / reducedMotion). `Panel.qml` binds Play/Journey/World navigation to `uxProjection.currentSurface` — Play is the default without visiting a dashboard, Journey holds Progress/Kingdom/Recovery as gated content plus a focused `progress-detail` sheet (interruptible, state-preserving), World is an honest unavailable-offline placeholder. Today's occurrences and habits render on Play; overdue folds collapsed by default with a single expand toggle. Bar widget shows the current surface (` · Play/Journey/World`) and supports `uxCommand`/`uxStatus` IPC. Reduced-motion binds to `uxProjection.reducedMotion` (`_reducedMotion`) and replaces travel with fades. Scaling is via `Style.font`/`Style.space` and state adds icon+label (◆ Achievements) so no essential state depends only on color/sound/animation.
