const SAMPLE_RATE = 44100;

const FRAMES = 43;

const BINS = 232;

/** WebAudio features matching the vendored browser_fft model, including silence. */
export async function captureKeywords(model, stream, onScores, onLevel, onError) {
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  const source = context.createMediaStreamSource(stream);

  try {
    await context.audioWorklet.addModule(new URL('./capture-worklet.js', import.meta.url));
  } catch (error) {
    await context.close();
    throw error;
  }

  const processor = new AudioWorkletNode(context, 'keyword-frames', {
    channelCount: 1, channelCountMode: 'explicit',
  });

  source.connect(processor);
  processor.connect(context.destination);
  await context.resume();
  const frames = [];
  const levels = [];
  const pending = [];
  let ticks = 0;
  let busy = false;
  let closed = false;
  processor.port.onmessage = event => sample(event.data);
  processor.onprocessorerror = () => onError(new Error('Keyword audio processor failed'));

  function sample({ features, rms, atMs }) {
    if (closed) return;
    onLevel(Math.min(1, rms * 8));
    frames.push(features);
    levels.push(rms);

    if (frames.length > FRAMES) { frames.shift(); levels.shift(); }

    ticks++;

    if (frames.length < FRAMES || ticks % 5 !== 0) return;

    if (Math.max(...levels) < 0.002) {
      pending.push({ atMs, input: null });
    } else {
      const input = new Float32Array(FRAMES * BINS);
      frames.forEach((frame, index) => input.set(frame, index * BINS));
      pending.push({ atMs, input });
    }

    // Keep chronological windows through short stalls, but refuse unbounded lag.
    if (pending.length > 10) {
      closed = true;
      onError(new Error('Keyword inference cannot keep up with captured audio'));

      return;
    }

    void drain();
  }

  async function drain() {
    if (busy || closed) return;
    busy = true;

    try {
      while (pending.length && !closed) {
        const { input, atMs } = pending.shift();

        if (!input) {
          onScores(new Float32Array(model.wordLabels().map(word => word === '_background_noise_' ? 1 : 0)), atMs);

          continue;
        }

        const result = await model.recognize(normalize(input));

        if (!closed) onScores(result.scores, atMs);
      }
    } catch (error) {
      if (!closed) onError(error);
    } finally {
      busy = false;
    }
  }

  function normalize(input) {
    let sum = 0;

    for (const value of input) sum += value;
    const mean = sum / input.length;
    let variance = 0;

    for (const value of input) variance += (value - mean) ** 2;
    const deviation = Math.sqrt(variance / input.length) + 1e-7;

    for (let i = 0; i < input.length; i++) input[i] = (input[i] - mean) / deviation;

    return input;
  }

  return async () => {
    closed = true;
    pending.length = 0;
    processor.port.onmessage = null;
    processor.port.close();
    source.disconnect();
    processor.disconnect();
    stream.getTracks().forEach(track => track.stop());
    await context.close();
  };
}
