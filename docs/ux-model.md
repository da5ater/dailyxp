# UX model

UX-001 delivers Play/Journey/World via `UxModel.js` pure seam and a living-midnight-kingdom surface in `Panel.qml`/`BarWidget.qml`.

- **Surfaces:** Play (active/selected task, session controls, fixture strip, today's occurrences/habits, overdue), Journey (crest/level/rank, kingdom map, achievements, stats, share), World (fixture, division, nearby ranks, skill leagues, guild/circles). Progressive disclosure: new users see Play first.
- **Bar widget:** level crest + selected task idle; elapsed/planned + pause running; resume paused; offline/sync indicator; click opens Play.
- **Visual:** near-black/navy foundation, gold permanent progress, cyan focus, emerald completion, violet skills, restrained crimson rivalry. Original kingdom art, not parchment.
- **Motion:** micro 100–180ms, spatial 220–420ms, celebration 700–1800ms; interruptible; reduced motion replaces travel/particles with fades.
- **Accessibility:** keyboard navigation, visible focus, screen-reader labels, high contrast, color-safe states, text scaling, English + RTL layout support.

`StateStore.qml` exposes `uxProjection` via `UxModel.project`; Panel binds `currentSurface` and focused sheets. Verification via QML component tests, keyboard/label/scale/contrast checks.
