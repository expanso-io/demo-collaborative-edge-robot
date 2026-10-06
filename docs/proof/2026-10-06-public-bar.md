# Public demo proof, 2026-10-06

The local public-bar run passed all five criteria on implementation commit
`82433bd`. This is local evidence; no remote repository or hosted CI run was
created by this task.

| Criterion | Result | Evidence |
| --- | --- | --- |
| Runs | PASS | Six complete jobs validate with Edge and CLI and replay from files |
| Platform | PASS | Local Edge scope, future hardware scope and platform contract |
| Structure | PASS | Explanation, six fixture stages, run and deploy instructions |
| Usability | PASS | Both themes, AA contrast, axe, 320/400/768/1440 px, keyboard scroll preservation and local copy feedback |
| Regressions | PASS | Retained routes, controls, stages and assertions; initial adoption baseline |

[Full dated report](public-bar/2026-10-06-report.md) and
[machine report](public-bar/2026-10-06-report.json) record every assertion,
tool version and fixture digest. The unmodified vendored checker is 1.1.3,
from released kit commit `2b2fac927f2c8eb39d6e15cb00d06cc2ffb6cbfe`.
Every vendored file was compared byte-for-byte with that commit. The pending
1.2.0 work was not adopted.

## Reproduction

Install Expanso Edge and CLI v2.1.21, uv, just and Node.js. Then:

```sh
just down
just check
just public-check
uv run -s .demo-kit/public-bar.py --selftest
```

The public-check recipe installs pinned browser dependencies before invoking:

```sh
uv run -s .demo-kit/public-bar.py \
  --repo . --manifest public-bar.toml \
  --report artifacts/public-bar.md
```

The recipe sets `PUBLIC_BAR_AXE_PATH` to its local axe-core installation.
The checker owns and stops its local Edge jobs, real event-bus service,
explorer server and bundled headless Chromium. No credentials are needed.

Selftest passed: two accepted fixtures and five failures isolated to their
intended criterion. Actionlint passed for both workflows. The explorer passed
anti-slop lint and strict TypeScript checking with browser-only types.

## Existing suites

| Suite | Result |
| --- | --- |
| Pipeline coordination on six real Edge nodes | 13/13 |
| Vision | 20/20 |
| Audio WAV fixtures | 12/12 |
| Stage adapters | 5/5 |
| Reveal accounting | 4/4 |

[Actual suite output](public-bar/2026-10-06-suites.txt) includes a final
13-case pipeline rerun after preserving the original HTTP validation guard.
The added public contract also passed: all twelve displayed input/output
records match their fixture files, coordinator processors match their rule
sources, and retained presenter and explorer controls exist.

The file replay replaces only transport input and output. The coordinator
also validates at the shared processor boundary so file input receives the
same schema checks. HTTP validation remains before timer events are merged,
preventing clients from injecting timer ticks. Confidence defaults to the
launcher's existing 0.80 when no environment override exists. Coordination
rules and timing remain in the coordinator pipeline. The coordinator golden
records were captured from Edge; its schema checks ordered exact bodies and
valid fresh UUIDs and UTC timestamps. Other pipelines compare exact records.

## Lifecycle and browser readback

`just up` returned after readiness and printed the presenter and explorer
addresses. The presenter, six nodes and explorer were reachable. A named
agent-browser session inspected the explorer, confirmed remembered dark mode
across navigation, and measured all six stages at 320 px with scroll width
exactly 320 px. The session was closed.

[Desktop explorer](public-bar/explorer-desktop.png) and
[phone explorer](public-bar/explorer-phone.png) preserve the rendered readback.
The explorer uses the presenter's existing palette and typography and is
linked from its header, without changing the presenter stage layout.

`just down` stopped the launcher and all six Edge nodes. A second invocation
was harmless. Both checks found ports 4100–4199 and all six Edge API ports
free. No task-owned browser or server remains running.

To inspect the example:

```sh
just up
open -a "Google Chrome" http://127.0.0.1:4180/example.html
```

Finish with `just down`. The physical camera, live microphone in the venue,
and hardware adapters retain the verification limits in the Stage 1 report
and future hardware buying guide.
