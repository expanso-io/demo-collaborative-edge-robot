# Stage block proof

Verified 2026-10-06 on the isolated `fm/cr-stage` branch.

- `node --test tests/stage/adapter.test.mjs`: 5 passed, 0 failed.
- `node tests/stage/rendered.mjs`: passed at 320, 400, 768 and 1440 px;
  screenshots retained here, including dark mode and arrival.
- Browser checks passed: script navigation preserves scroll, theme survives reload,
  all five manual inputs route to the correct device, JSON POSTs use `text/plain`,
  bus commands move/pause/resume the rover, and the browser reports no page errors.
- The fixture harness verified every owned port closed after shutdown.
- TypeScript 5.9.3 checked browser JavaScript with `tests/stage/tsconfig.json`.
- The required standalone anti-slop check and commit hook passed.

This proves the stage and adapter block with explicit fixture commands. Actual
Expanso pipeline execution, microphone recognition, physical hardware, and webcam
recognition accuracy require their own integration and device evidence.
