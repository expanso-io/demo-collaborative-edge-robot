# Camera cards

Print `card-1.svg` and `card-2.svg` on A4 at **100% / actual size**.
Each is an A4 page with a 190 mm square frame and a large geometric digit.
No fonts, linked images, or runtime assets are required. Use matte paper,
keep the entire frame visible, and hold the sheet upright. The frame is
identical on both cards; recognition depends on seeing the digit.

These SVGs were authored directly because the local Paper endpoint was
unavailable. The fixture generator renders the actual SVGs through librsvg.

The recognizer needs a frame at least 48 pixels wide and high in its
processing image (up to 1280 pixels wide). It accepts moderate perspective,
but extreme rotation, glare, motion blur, and low contrast cause it to wait.
At 1–3 m, use the full-size sheet and a 720p or better camera. That distance
range is a rehearsal target, **not a measured hardware result**. If a distant
card is unreadable, move closer or print larger; do not lower the threshold.

Run the standalone check from the repository root:

```sh
uv run --no-project python -m http.server 4187 \
  --bind 127.0.0.1
```

Open `http://127.0.0.1:4187/tests/vision/`, then press Start camera.
The page displays recognition envelopes locally. It does not post to Edge.
Stop the server with Ctrl-C when finished. The optional image picker checks
local photographs without uploading them.

For integration, import `mount`, `start`, and `stop` from
`web/devices/camera.js`. Call `mount(element)` before `start(postEvent)`;
call `stop()` on teardown. `start` requests only camera permission, with
no audio. The shell supplies the callback that sends recognition envelopes
to the camera node. Frames remain inside the browser. A failure to obtain
camera access rejects `start` and displays the cause in the preview.

`mount(element)` is the one required addition to the fixed `start`/`stop`
contract: the shell must provide the preview container. This module contains
no movement or coordination rules.

Confidence is a deterministic quality score calibrated against the committed
synthetic fixtures, not a statistical probability. It penalizes missing digit
ink, unexpected ink, soft edges, and ambiguous matches. Scores below 0.80
emit a null value. Two readable cards in one frame also emit null. Real camera
photographs and measured stage-lighting calibration remain to be collected.
