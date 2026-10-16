import { spectrum } from './spectrum.mjs';

class KeywordFrames extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Float32Array(2048);
    this.position = 0;
    this.hop = 0;
    this.filled = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];

    if (!input) return true;

    for (let index = 0; index < input.length; index++) {
      this.samples[this.position] = input[index];
      this.position = (this.position + 1) % this.samples.length;
      this.filled++;
      this.hop++;

      if (this.hop !== 1024) continue;
      this.hop = 0;

      if (this.filled < this.samples.length) continue;
      const ordered = new Float32Array(this.samples.length);
      ordered.set(this.samples.subarray(this.position));
      ordered.set(this.samples.subarray(0, this.position), this.samples.length - this.position);
      const features = spectrum(ordered);
      let energy = 0;

      for (let sample = 1024; sample < ordered.length; sample++) energy += ordered[sample] ** 2;
      this.port.postMessage({
        features, rms: Math.sqrt(energy / 1024),
        atMs: (currentFrame + index + 1) / sampleRate * 1000,
      }, [features.buffer]);
    }

    return true;
  }
}

registerProcessor('keyword-frames', KeywordFrames);
