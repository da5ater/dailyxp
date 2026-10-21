# Private Recovery

## Sub-features

Protected entry, custom private tracks, attempt start, check-in, explicit setback and restart.

## How to get to it (user POV)

On Play click Private Recovery, then Open private tracks. Use + Track to begin.

## Driving it with Playwright Electron

Click Private Recovery and assert track names are absent before opening private tracks. Open the view, create a custom category and choose an attempt start date. Save and assert it appears. Check in through its form. For a setback, accept the explicit native confirmation, assert Restart replaces Record setback, then restart through the control. Navigate away and return. The privacy gate must return. Check the production companion status contains neither the track name nor its notes.

## Gotchas

The default journey covers creation, check-in, leaving/reopening the privacy gate and companion disclosure. Setback and restart remain additional routes. Recovery information belongs only in its protected view and exports. Automation runs use disposable data and no desktop notification bus.
