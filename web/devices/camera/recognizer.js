// The printed digit is part of the template: the frame alone carries no ID.
export const DIGITS = {
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
};

export const THRESHOLD = 0.8;

export function inkAt(value, u, v) {
  if (u < 0 || v < 0 || u > 1 || v > 1) return false;

  if (u < 0.055 || v < 0.055 || u > 0.945 || v > 0.945) return true;
  const col = Math.floor((u - 0.2) / 0.12);
  const row = Math.floor((v - 0.15) / 0.1);

  return col >= 0 && col < 5 && row >= 0 && row < 7 && DIGITS[value][row][col] === '1';
}

// Project a unit square onto the four outer frame corners, clockwise from TL.
export function projection(corners) {
  const [a, b, c, d] = corners;
  const dx = a.x - b.x + c.x - d.x;
  const dy = a.y - b.y + c.y - d.y;
  const bx = b.x - c.x, by = b.y - c.y;
  const cx = d.x - c.x, cy = d.y - c.y;
  const det = bx * cy - cx * by;

  if (Math.abs(det) < 1) return null;
  const g = (dx * cy - cx * dy) / det;
  const h = (bx * dy - dx * by) / det;

  return (u, v) => {
    const den = g * u + h * v + 1;

    return {
      x: ((b.x - a.x + g * b.x) * u + (d.x - a.x + h * d.x) * v + a.x) / den,
      y: ((b.y - a.y + g * b.y) * u + (d.y - a.y + h * d.y) * v + a.y) / den,
    };
  };
}

function components(gray, width, height, threshold) {
  const seen = new Uint8Array(gray.length);
  const queue = new Int32Array(gray.length);
  const regions = [];

  for (let seed = 0; seed < gray.length; seed++) {
    if (seen[seed] || gray[seed] >= threshold) continue;
    let head = 0, tail = 1;
    queue[0] = seed;
    seen[seed] = 1;
    let left = width, right = 0, top = height, bottom = 0;
    let tl, tr, br, bl;

    while (head < tail) {
      const i = queue[head++], x = i % width, y = Math.floor(i / width);
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);

      if (!tl || x + y < tl.x + tl.y) tl = { x, y };

      if (!tr || x - y > tr.x - tr.y) tr = { x, y };

      if (!br || x + y > br.x + br.y) br = { x, y };

      if (!bl || x - y < bl.x - bl.y) bl = { x, y };

      for (const n of [x > 0 ? i - 1 : -1, x + 1 < width ? i + 1 : -1, i - width, i + width]) {
        if (n >= 0 && n < gray.length && !seen[n] && gray[n] < threshold) {
          seen[n] = 1;
          queue[tail++] = n;
        }
      }
    }

    const w = right - left, h = bottom - top;

    if (w >= 48 && h >= 48 && w / h > 0.5 && w / h < 2 && tail > 100 &&
        left > 1 && top > 1 && right < width - 2 && bottom < height - 2) {
      regions.push([tl, tr, br, bl]);
    }
  }

  return regions;
}

function scoreRegion(gray, width, height, corners) {
  const map = projection(corners);

  if (!map) return null;
  const samples = [];
  const blacks = [], whites = [];

  for (let row = 0; row < 40; row++) {
    for (let col = 0; col < 40; col++) {
      const u = (col + 0.5) / 40, v = (row + 0.5) / 40;
      const p = map(u, v);
      const x = Math.round(p.x), y = Math.round(p.y);

      if (x < 0 || y < 0 || x >= width || y >= height) return null;
      const light = gray[y * width + x];
      samples.push({ u, v, light });

      if (u < 0.04 || u > 0.96 || v < 0.04 || v > 0.96) blacks.push(light);

      if ((u > 0.08 && u < 0.15) || (u > 0.86 && u < 0.92)) whites.push(light);
    }
  }

  const mean = values => values.reduce((sum, n) => sum + n, 0) / values.length;
  const black = mean(blacks), white = mean(whites), contrast = white - black;

  if (contrast < 75) return null;
  const threshold = (white + black) / 2;

  const scores = [1, 2].map(value => {
    let missedInk = 0, ink = 0, extraInk = 0, paper = 0, soft = 0;

    for (const { u, v, light } of samples) {
      // Compare the entire digit area including expected blank paper.
      if (u < 0.12 || u > 0.88 || v < 0.10 || v > 0.90) continue;
      const expected = inkAt(value, u, v), actual = light < threshold;

      if (expected) { ink++;

 if (!actual) missedInk++; }
      else { paper++;

 if (actual) extraInk++; }

      if (light > black + contrast * 0.2 && light < white - contrast * 0.2) soft++;
    }

    const error = Math.max(missedInk / ink, extraInk / paper);
    const softness = soft / (ink + paper);

    return { value, confidence: Math.max(0, Math.min(1, 1 - error * 3 - softness * 2)), error, softness };
  }).sort((a, b) => b.confidence - a.confidence);

  const winner = scores[0];

  if (winner.confidence - scores[1].confidence < 0.15) winner.confidence = Math.min(0.79, winner.confidence);

  return { ...winner, region: corners };
}

/** Pure recognizer. Input is ImageData-compatible RGBA, never transmitted. */
export function recognize({ data, width, height }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4) {
    throw new TypeError('Expected RGBA image data');
  }

  const gray = new Uint8Array(width * height);
  const histogram = new Uint32Array(256);

  for (let i = 0; i < gray.length; i++) {
    gray[i] = Math.round((data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3);
    histogram[gray[i]]++;
  }

  let cumulative = 0, low = 0, high = 255;

  for (let i = 0; i < 256; i++) { cumulative += histogram[i];

 if (cumulative >= gray.length * 0.001) { low = i; break; } }

  cumulative = 0;

  for (let i = 255; i >= 0; i--) { cumulative += histogram[i];

 if (cumulative >= gray.length * 0.001) { high = i; break; } }

  const none = { value: null, confidence: 0, region: null };

  if (high - low < 75) return none;

  const results = components(gray, width, height, (low + high) / 2)
    .map(corners => scoreRegion(gray, width, height, corners)).filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence);

  if (!results.length) return none;
  const best = results[0];

  if (results.filter(result => result.confidence >= THRESHOLD).length > 1) {
    return { value: null, confidence: 0, region: best.region };
  }

  return { value: best.confidence >= THRESHOLD ? best.value : null,
    confidence: Math.round(best.confidence * 1000) / 1000, region: best.region };
}
