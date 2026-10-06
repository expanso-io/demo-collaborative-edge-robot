# A job for the robot

A volunteer gives a robot a job using two things anyone can do: hold up a card
and say a word. A camera reads the card, a microphone hears "go" or "stop", and
a rover and two drones carry out the job together.

Each device has its own Expanso Edge pipeline. Stage 1 runs the six logical
nodes on one Mac, with map adapters for the rover and drones. Each model does one narrow task
on its own device. The camera reads one digit, and the microphone hears two
words. Only small JSON results, about 200 bytes each, travel between devices.
Frames and audio never leave the machine that captured them. The rules that
decide what happens live in the coordinator pipeline:

1. A card read at 80% confidence or higher sets the destination.
2. Below that, the system waits and says why. Nothing moves.
3. "Go" sends the rover and both drones to the destination.
4. "Stop" beats "go". A stop pauses every device and wins over any go that
   arrives within 1.5 seconds. The destination is kept.
5. A later "go" resumes toward the kept destination.

When the rover reports that it has reached the station, the job is done.

[Explore the six pipelines](web/example.html): real fixture input and output,
coordination decisions, and local run and deploy commands. With `just up`
running, open `http://127.0.0.1:4180/example.html`.

## Run it

You need `expanso-edge`, `expanso-cli`, `just`, `uv` and Node.js on a Mac with a webcam and a
microphone. The first run installs the pinned speech libraries once, which
needs a network connection. After that it runs offline.

```sh
just up
```

Open the address it prints, `http://127.0.0.1:4180/`. The command returns once
all six nodes are ready. Run
`just down` to stop them and verify that the ports are free.

Everything binds to `127.0.0.1` and runs offline. There are no cloud speech or
vision services, no API keys, and no network calls once it is running.

## Present it

Print the two cards in `docs/cards/`. Click **Start camera** and **Start
microphone**, then use the Left and Right arrow keys to step through the
script:

1. **Give the robot a job.** Show the camera, microphone, rover and drones.
2. **Choose a destination.** The volunteer holds up card 1 or 2, and the
   screen shows the station.
3. **Permission.** The volunteer says "go", and the rover and drones move.
   Two devices contributed to one action.
4. **Interrupt.** On a second run, the volunteer says "stop". Everything
   pauses, and the destination stays selected.
5. **Unclear input.** The volunteer covers the number. The camera reports it
   cannot read it, and the system waits instead of guessing.
6. **Reveal.** The panel at the bottom shows every message the devices
   exchanged, its size, and the raw frames and audio they replaced.

The **Manual input for rehearsal** panel sends the same messages from the
keyboard: 1, 2, C for a covered card, G for go and S for stop. Messages typed
there carry no raw frames or audio, so they add nothing to the bytes-saved
total.

## How it fits together

[docs/architecture.md](docs/architecture.md) shows the six nodes, their ports
and the message flow. The pieces are:

| Path | Device | What it does |
|---|---|---|
| `web/devices/camera/` | camera-1 | Reads a printed 1 or 2 in the browser, with a confidence score |
| `web/devices/mic/` | mic-1 | Hears only "go" and "stop" in the browser |
| `pipelines/` | all six | One Expanso Edge pipeline per device; the coordinator holds the rules |
| `web/adapters/` | rover-1, drone-1, drone-2 | Every move goes through a device adapter |
| `web/stage/` | | The stage map that the room watches |
| `web/reveal/` | | The live message view for the reveal |

The rover and drones on the map are one adapter implementation. A real rover
or drone implements the same interface, `moveTo`, `pause`, `resume`, `hold` and
`onState`, so the hardware can replace the map without touching the rules.
[docs/hardware.md](docs/hardware.md) names the rover, drones and camera to buy,
and the adapter work each needs.

## Proof

Each part was tested on its own, and the whole demo was run end to end:

| Test | Command | Result |
|---|---|---|
| Coordination rules on six real Edge nodes | `uv run --offline --no-project tests/pipelines/run.py` | 13 of 13 pass |
| Card recognizer | `node --test tests/vision/vision.test.mjs` | 20 of 20 pass: cards 1 and 2 at angle and distance, covered, blurred and blank |
| Go and stop | `node tests/audio/verify.mjs` | 12 of 12 clips correct |
| Device adapters | `node --test tests/stage/adapter.test.mjs` | 5 of 5 pass |
| Reveal byte accounting | `node --test tests/reveal/accounting.test.js` | 4 of 4 pass |

[docs/proof/2026-10-06-stage-1.md](docs/proof/2026-10-06-stage-1.md) records
the end-to-end run with a screenshot of each beat.

## Public checks

Stop the demo with `just down`, then run `just check` for all five Stage 1
suites. `just public-check` installs pinned browser-check dependencies and
runs the vendored public bar, including six file replays and the rendered
explorer. It needs a network connection on first setup. Reports are written to
`artifacts/public-bar.md` and `artifacts/public-bar.json`.

`just record-check` stops the stage, runs the suites, starts a fresh stage and
prints the recording checklist. Finish with `just down`.
`just recording-preflight` uses the sibling `_demo-kit` checkout and is for
maintainers who have that kit installed beside this repository.

The public workflow checks all five criteria. A separate Stage 1 workflow
runs the recognizer, coordination, adapter and accounting suites. Local proof
is recorded under `docs/proof/`; hosted CI evidence begins after publication.
