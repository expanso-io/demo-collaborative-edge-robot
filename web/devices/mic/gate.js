export const CONFIDENCE_THRESHOLD = 0.75;

export const WINDOW_SECONDS = (43 * 1024) / 44100;

export const RAW_BYTES = Math.round(16000 * 2 * WINDOW_SECONDS);

/** Suppress overlapping windows until 650 ms without that keyword. */
export function createKeywordGate() {
  let held = null;
  let lastCandidateAt = -Infinity;

  return (labels, scores, now) => {
    const index = scores.reduce((best, score, i) => score > scores[best] ? i : best, 0);
    const value = labels[index];
    const confidence = scores[index];

    const accepted = (value === 'go' || value === 'stop') &&
      Number.isFinite(confidence) && confidence >= CONFIDENCE_THRESHOLD && confidence <= 1;

    if (!accepted) {
      if (now - lastCandidateAt >= 650) held = null;

      return null;
    }

    lastCandidateAt = now;

    if (held === value) return null;
    held = value;

    return { value, confidence };
  };
}

export function recognitionEnvelope(keyword) {
  return {
    v: 1, id: crypto.randomUUID(), ts: new Date().toISOString(),
    from: 'mic-1', kind: 'recognition',
    body: { task: 'keyword', ...keyword }, raw_bytes: RAW_BYTES,
  };
}
