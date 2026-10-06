const SAMPLE_RATE = 44100;

const FFT_HOP = 1024;

const FRAMES = 43;

const BINS = 232;

/** WebAudio features matching the vendored browser_fft model, including silence. */
export async function captureKeywords(model, stream, onScores, onLevel, onError) {
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_HOP * 2;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);
  await context.resume();
  const spectrum = new Float32Array(FFT_HOP);
  const waveform = new Float32Array(FFT_HOP);
  const frames = [];
  const levels = [];
  let ticks = 0;
  let busy = false;
  let closed = false;
  const timer = setInterval(sample, FFT_HOP / SAMPLE_RATE * 1000);

  function sample() {
    analyser.getFloatFrequencyData(spectrum);
    analyser.getFloatTimeDomainData(waveform);
    let energy = 0;

    for (const value of waveform) energy += value * value;
    const rms = Math.sqrt(energy / waveform.length);
    onLevel(Math.min(1, rms * 8));
    frames.push(spectrum.slice(0, BINS).map(value => Math.max(-100, value)));
    levels.push(rms);

    if (frames.length > FRAMES) { frames.shift(); levels.shift(); }

    ticks++;

    if (frames.length < FRAMES || ticks % 5 !== 0 || busy) return;

    if (Math.max(...levels) < 0.002) {
      onScores(new Float32Array(model.wordLabels().map(word => word === '_background_noise_' ? 1 : 0)));

      return;
    }

    const input = new Float32Array(FRAMES * BINS);
    frames.forEach((frame, index) => input.set(frame, index * BINS));
    let sum = 0;

    for (const value of input) sum += value;
    const mean = sum / input.length;
    let variance = 0;

    for (const value of input) variance += (value - mean) ** 2;
    const deviation = Math.sqrt(variance / input.length) + 1e-7;

    for (let i = 0; i < input.length; i++) input[i] = (input[i] - mean) / deviation;
    busy = true;
    model.recognize(input).then(result => {
      if (!closed) onScores(result.scores);
    }).catch(error => {
      if (!closed) onError(error);
    }).finally(() => { busy = false; });
  }

  return async () => {
    closed = true;
    clearInterval(timer);
    source.disconnect();
    analyser.disconnect();
    stream.getTracks().forEach(track => track.stop());
    await context.close();
  };
}
