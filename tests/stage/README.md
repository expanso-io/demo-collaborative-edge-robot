# Presenter stage verification

Run from the repository root with Node 22 or later and `agent-browser` installed:

```sh
node --test tests/stage/adapter.test.mjs
node tests/stage/rendered.mjs
```

The rendered test starts fixtures on OS-assigned loopback ports and closes its
own browser session and servers. It rewrites endpoint ports in served JavaScript
only; the production files keep the integration contract endpoints. Fixture nodes
accept only POST with simple CORS, so a preflight would fail the routing check.
The fixtures broadcast explicitly supplied commands. They do not implement
coordination rules or claim Expanso integration proof.

For a standalone shell preview:

```sh
node tests/stage/serve.mjs
```

Open the `origin` URL printed in the terminal. This static preview uses an
OS-assigned localhost port and shows missing modules or unavailable device nodes.
Use the integration launcher at port 4180 for actual device-node CORS. Ctrl-C
closes the standalone preview.

For browser-source type checking, use TypeScript 5.9 or later:

```sh
tsc -p tests/stage/tsconfig.json
```

Verification covers move/pause/hold/resume and retained targets, addressed and
repeated commands, hardware transport delegation, one SSE source with in-page
subscriptions, overflow at 320/400/768/1440 px, remembered theme, script navigation
and scroll retention, all five manual event routes, and command-driven arrival.
Screenshots are saved alongside this file. Manual events use `raw_bytes: 0`
because no captured frame or audio was replaced.

Integration mount points are `#camera-1`, `#mic-1`, and `#reveal`.
The shell loads `web/devices/camera.js` and `web/devices/mic.js`, calls optional
`mount(element)`, then calls `start(postEvent)` from the explicit Start button.
`stop()` is called from the Stop button and on page exit. The reveal entry point
is `web/reveal/index.js`, exporting `mount(element, bus)`. The shared bus supports
`on(kind, handler)`, wildcard `on('*', handler)`, and unsubscribe callbacks.
Recognition and device-state POSTs use `Content-Type: text/plain` with JSON bodies.

The visual direction uses Vanmoof's large utilitarian hierarchy and flat surfaces,
with B-Line's restrained outlined controls. Project requirements take precedence:
neutral off-white canvas, local Helvetica/Arial, no remote assets, light default,
and persistent dark preference. Status and station selection also have text cues.
