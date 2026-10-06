# Edge pipelines proof, 2026-10-06

Six local Expanso Edge v2.1.21 processes ran the device and coordinator jobs on macOS. Fixtures entered through the public device HTTP endpoints and assertions read the real SSE bus. No model calls or Cloud credentials were used.

## Fixture execution

```sh
uv run --offline --no-project tests/pipelines/run.py
```

The suite observed 66 unique envelopes with consecutive SSE IDs. Every envelope used a UTC timestamp and was below 1 KB. Checks passed for:

- Go without a destination waits with the specified reason.
- Confidence exactly 0.80 selects station 1.
- Go emits move_to for rover-1, drone-1, and drone-2 after the stop window.
- Repeated readings of the selected card preserve a pending go.
- Stop pauses every device and retains the destination.
- Stop wins over both a preceding and a following go within 1.5 seconds.
- A later go resumes toward the retained station.
- Low confidence holds all devices, gives a reason, and blocks go.
- An unreadable card waits; a new confident card replaces the station.
- State envelopes from all three moving devices reach the bus.
- Invalid confidence, source identity, and raw payload fields are filtered.
- Device endpoints accept the presenter's simple text/plain CORS requests.
- Ctrl-C shutdown releases every declared port.

Final test output included:

```text
PASS stop cancels preceding go inside 1.5 seconds
PASS ordered SSE: 66 unique UTC envelopes, each below 1 KB
PASS Ctrl-C shutdown releases every declared port
```

All six job files also passed `expanso-edge validate`. `shellcheck scripts/run scripts/stop` completed with exit 0. Python syntax checks passed for the renderer, runtime, and fixture runner.

## Real browser CORS and SSE check

At 16:03:36 UTC, an isolated headless `agent-browser` session named `cr-pipes-proof` loaded a page from `http://127.0.0.1:4180/`. The stage entry page was not yet integrated in this checkout, so the static server's directory page supplied the real presenter origin.

```sh
agent-browser --config config/browser-proof.json \
  --session cr-pipes-proof --allowed-domains 127.0.0.1 \
  --headed false open http://127.0.0.1:4180/
```

The browser opened one EventSource connection to port 4190 and used `fetch` to POST a camera-1 JSON envelope to port 4101 with `Content-Type: text/plain`. The response was readable and returned HTTP 200. The same browser received:

| SSE ID | Envelope | Result |
|---|---|---|
| 1 | camera-1 recognition | card 2, confidence 0.96 |
| 2 | coordinator decision | destination 2, ready |
| 3 | coordinator command | rover-1 hold, station 2 |
| 4 | coordinator command | drone-1 hold, station 2 |
| 5 | coordinator command | drone-2 hold, station 2 |

The recognition ID was `0dd9bc48-d72a-4653-a5e9-4dca8f0c1ac3`. The browser's network log showed:

```text
GET  http://127.0.0.1:4180/        200
GET  http://127.0.0.1:4190/stream  200
POST http://127.0.0.1:4101/events  200
```

There was no OPTIONS request. The browser error command returned no page errors. An unrelated favicon request returned 404 on the directory page. The owned browser session was closed, then `scripts/stop` confirmed shutdown. No user browser was opened or attached.

## Scope and limits

This proves local Edge pipeline execution, coordination, message transport, browser CORS, and process cleanup. It does not claim webcam or microphone inference quality, rendered stage usability, real hardware motion, hosted CI, or a completed integrated public-demo review. Those belong to the other blocks and the integration pass.

`just up` launches the block at the contracted endpoints. Browser POSTs must retain the agreed `text/plain` content type while sending a JSON body. The coordinator intentionally delays go by 1.5 seconds. The architecture document describes replay, reset, validation acknowledgements, and transport limits.
