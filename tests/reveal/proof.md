Reveal block proof, 2026-10-06. Standalone fixture evidence only; this does not
claim integrated Expanso pipelines or camera/microphone recognition were run.

- Nine fixture envelopes: 1,735 compact UTF-8 JSON bytes; 953,600 raw input
  bytes; exact ratio 1735:953600. Independent Node Buffer counting agrees.
- Unit tests cover fixture totals, multibyte UTF-8, routes, unsubscribe, and a
  bus that returns no unsubscribe function.
- Browser assertions: 8 passed, including initial state, rendered totals, six
  devices, pretty JSON, the 12-message limit, cumulative totals after eviction,
  subscription cleanup, and DOM removal.
- Browser-only TypeScript check passed without skipping library checks. Its
  explicit `types: []` avoids unrelated Node declarations from an ancestor.
- Explicit-file anti-slop lint passed for all six JavaScript files.
- agent-browser session `cr-reveal` launched its own browser. Width and document
  scroll width matched at 320, 400, 768, and 1440 pixels.
- Reduced motion: preference true, zero running animations during replay.
- Dark theme: background rgb(24, 40, 33). Default light background #f5f3ec.
  Text colors use #20342e / #52645c in light and #e5ece3 / #b4c8ba in dark.
- Screenshots: `1440.png`, `320.png`, and `dark-768.png`. The 320 px label
  bounds stay between x=22 and x=285 without wrapping device IDs.

Browser assertion command with the preview server running:

```sh
agent-browser --session cr-reveal \
  open http://127.0.0.1:4186/tests/reveal/
agent-browser --session cr-reveal eval \
  'import("/tests/reveal/browser-check.js").then(m=>m.checkRendered())'
agent-browser --session cr-reveal close
```

Cleanup: the owned agent-browser session was closed, and the preview server
was stopped. Port 4186 was checked for remaining listeners.
