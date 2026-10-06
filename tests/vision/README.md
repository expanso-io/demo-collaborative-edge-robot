# Vision checks

Run the committed image and envelope checks with no dependencies:

```sh
node --test tests/vision/vision.test.mjs
```

Check browser JavaScript types:

```sh
npm exec --package=typescript -- tsc -p tests/vision/tsconfig.json
```

Regenerate synthetic fixtures from the printable SVGs (requires
`rsvg-convert` and Pillow):

```sh
uv run --no-project --with pillow \
  tests/vision/generate-fixtures.py
```

The PPM files are raster fixtures, generated from the printable SVGs with
independent Pillow transformations. They cover both digits front-on, small,
at an angle, small at an angle, partly covered, fully covered inside the
frame, blurred, and dimmed, plus blank input. They are not photographs.
The print PNGs provide a quick visual reference.

The confidence threshold is 0.80. Positive bands are 0.80–1.00; negative
bands are 0–0.799 with a null value. Results are recorded in `results.txt`.
Fixtures establish deterministic behavior, not reliability on unseen scenes.

Before a stage run, collect actual webcam photographs at 1, 2, and 3 m in
the venue lighting for both cards, including hand occlusion, defocus, and
background clutter. Add them to the fixture manifest before claiming the
physical-distance requirement is verified.

With the standalone server running, the browser lifecycle checks can be run
in a dedicated agent-browser session:

```sh
agent-browser --session vision-check open \
  http://127.0.0.1:4187/tests/vision/
agent-browser --session vision-check eval \
  'import("./browser-check.js").then(m => m.runBrowserCheck())'
agent-browser --session vision-check close
```

These checks substitute a local canvas media stream, then verify recognition,
raw-byte accounting, permission denial, normal stop, and cancellation while
permission is pending. They never request a physical camera.
