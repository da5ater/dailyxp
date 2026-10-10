# Panel and navigation

Open DailyXP and switch between Play, Journey, and World. Motion preferences persist.

## Sub-features

- NAV-OPEN: panel opens and closes.
- NAV-SURFACE: current surface matches the requested page.
- NAV-MOTION: reduced motion is retained in state.

## How to get to it (user POV)

Click the DailyXP bar widget, or use production IPC `open`/`close`. In the panel, choose Play, Journey, World, or the motion toggle.

## Driving it with production IPC

Preconditions: fresh host, doctor passed.

- Open: `"$DRIVER" call "$RUN" open`, then `"$DRIVER" capture "$RUN" open`. Inspect the rendered panel.
- Navigate: `"$DRIVER" call "$RUN" uxCommand '{"type":"ux.navigate","surface":"Journey"}'`. Wait for doctor, then capture `journey`; require `journey-uxStatus.json` projection.currentSurface to equal Journey and inspect the Journey screen. Repeat with Play and World when relevant.
- Motion: `"$DRIVER" call "$RUN" uxCommand '{"type":"ux.reducedMotion.set","enabled":true}'`. Read `uxStatus`; require projection.reducedMotion true and persisted journal evidence.
- Close: `"$DRIVER" call "$RUN" close`. Observe the panel disappear. Capture separately if required.

## Gotchas

Opening moves keyboard focus only inside the private headless display. IPC navigation does not prove the navigation buttons or keyboard behavior. Screenshots include only the rendered production panel. The host bar is a fixture; full-shell popout coordination needs an installed-host check.
