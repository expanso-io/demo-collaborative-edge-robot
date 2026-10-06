# Offline microphone device

Setup once (network is needed only to install the pinned npm dependencies):

```sh
npm ci --prefix web/devices/mic
```

The postinstall copies TensorFlow.js 4.22.0 and speech-commands 0.5.4 into the ignored `vendor/` directory. Serve that directory with the rest of `web/`. The lockfile records dependency integrity hashes. Model weights and metadata are committed, so runtime requests stay local. No cloud speech service or model API is used.

The speech-commands `browser_fft/18w` model is from:
`https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/`.
It has 18 word labels plus background and unknown classes. Only winning `go` and `stop` scores at least 0.75, agreeing across three consecutive windows, can produce events. Stable non-command words also latch the utterance gate, preventing a clipped word ending from being emitted as a new command. Everything else stays local. Licenses are in `vendor/`; committed model file checksums are in `model/checksums.json`.

## Shell integration

Import `mount`, `start`, and `stop` from `web/devices/mic.js`. Call `mount(element)` for the level meter and last-heard status. From a user-gesture start button, call `await start(postEvent)`; catch a rejected promise and retain a retry control. `postEvent` receives only the specified `mic-1` recognition envelope. Call `await stop()` to release capture. Mounting and model loading do not start capture automatically.

The browser must permit microphone capture on localhost. If the shell sets a CSP, TensorFlow.js requires `script-src 'self' 'unsafe-eval'`; its other resources can remain restricted to self. No raw audio, spectrogram, recording, or model scores are posted to an endpoint.

The model uses 43 frames of 1024 samples at 44.1 kHz (about 0.9985 seconds). `raw_bytes` is 31951, its rounded 16 kHz signed-16-bit PCM equivalent, as required by the device contract. It is not the browser's actual internal sample format. The meter uses local RMS amplitude; inference skips near-silent windows. Only one inference runs at a time.

Coordination, destination memory, and stop/go priority are owned by the pipeline. This module makes no movement decisions.

## Standalone preview and checks

```sh
node tests/audio/serve.mjs
```

Open `http://127.0.0.1:4189/tests/audio/index.html`. Start microphone exercises the real Mac capture path. Run WAV proof injects local fixture audio through a MediaStream into the same capture, model, gate, and envelope code without requesting hardware access or posting events. Stop the server with Ctrl-C.

```sh
node tests/audio/verify.mjs
node --test tests/audio/gate.test.mjs
npm exec --yes --package=typescript -- \
  tsc -p tests/audio/tsconfig.json
```

The automated WAV command uses its own headless agent-browser session and ephemeral localhost server, saves `tests/audio/results.json`, and closes both. It requires agent-browser to be installed.

The WAV fixtures were generated locally with macOS `say`, using Samantha and Daniel for go, stop, no, yes, and left, plus seeded noise and silence. Regenerate on macOS with `node tests/audio/generate.mjs`. Synthetic fixtures check this narrow vocabulary; they do not establish accuracy for every speaker, accent, or stage noise condition. A physical microphone rehearsal remains necessary before presentation.
