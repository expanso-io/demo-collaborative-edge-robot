import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spectrum } from '../../web/devices/mic/spectrum.mjs';

test('silence produces finite floor values', () => {
  assert.deepEqual(spectrum(new Float32Array(2048)), new Float32Array(232).fill(-100));
});

test('FFT agrees with the WebAudio Blackman-window DFT definition', () => {
  const size = 2048;

  const samples = Float32Array.from({ length: size }, (_, index) =>
    0.2 * Math.sin(index * 0.071) + 0.3 * Math.cos(index * 0.039) + 0.01 * Math.sin(index * index));

  const actual = spectrum(samples);

  // A direct DFT is deliberately independent of the production radix-2 FFT.
  for (let bin = 0; bin < actual.length; bin++) {
    let real = 0;
    let imaginary = 0;

    for (let index = 0; index < size; index++) {
      const phase = 2 * Math.PI * index / size;
      const value = samples[index] * (0.42 - 0.5 * Math.cos(phase) + 0.08 * Math.cos(2 * phase));
      real += value * Math.cos(bin * phase);
      imaginary -= value * Math.sin(bin * phase);
    }

    const expected = Math.max(-100, 20 * Math.log10(Math.hypot(real, imaginary) / size));
    assert.ok(Math.abs(actual[bin] - expected) < 0.00001, `bin ${bin}: ${actual[bin]} != ${expected}`);
  }
});
