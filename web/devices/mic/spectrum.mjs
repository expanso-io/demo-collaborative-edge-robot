const SIZE = 2048;

const BINS = 232;

const window = Float64Array.from({ length: SIZE }, (_, index) =>
  0.42 - 0.5 * Math.cos(2 * Math.PI * index / SIZE) + 0.08 * Math.cos(4 * Math.PI * index / SIZE));

const cosine = Float64Array.from({ length: SIZE / 2 }, (_, index) => Math.cos(2 * Math.PI * index / SIZE));

const sine = Float64Array.from({ length: SIZE / 2 }, (_, index) => -Math.sin(2 * Math.PI * index / SIZE));

const reversed = Uint16Array.from({ length: SIZE }, (_, index) => {
  let result = 0;

  for (let bit = 0; bit < 11; bit++) result = result * 2 + ((index >>> bit) & 1);

  return result;
});

/** Match AnalyserNode's Blackman window, FFT scaling, and decibel output. */
export function spectrum(samples) {
  const real = new Float64Array(SIZE);
  const imaginary = new Float64Array(SIZE);

  for (let index = 0; index < SIZE; index++) real[reversed[index]] = samples[index] * window[index];

  for (let width = 2; width <= SIZE; width *= 2) {
    const half = width / 2;
    const step = SIZE / width;

    for (let start = 0; start < SIZE; start += width) {
      for (let offset = 0; offset < half; offset++) {
        const even = start + offset;
        const odd = even + half;
        const twiddle = offset * step;
        const re = real[odd] * cosine[twiddle] - imaginary[odd] * sine[twiddle];
        const im = real[odd] * sine[twiddle] + imaginary[odd] * cosine[twiddle];
        real[odd] = real[even] - re;
        imaginary[odd] = imaginary[even] - im;
        real[even] += re;
        imaginary[even] += im;
      }
    }
  }

  return Float32Array.from({ length: BINS }, (_, index) =>
    Math.max(-100, 20 * Math.log10(Math.hypot(real[index], imaginary[index]) / SIZE)));
}
