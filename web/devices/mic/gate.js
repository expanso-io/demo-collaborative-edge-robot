export const CONFIDENCE_THRESHOLD = 0.75;

export const WINDOW_SECONDS = (43 * 1024) / 44100;

export const RAW_BYTES = Math.round(16000 * 2 * WINDOW_SECONDS);

/** Require three agreeing windows; stable non-command words suppress their tails. */
export function createKeywordGate() {
  let held = false;
  let candidate = null;
  let candidateSince = 0;
  let candidateCount = 0;
  let lastCandidateAt = -Infinity;

  return (labels, scores, now) => {
    const index = scores.reduce((best, score, i) => score > scores[best] ? i : best, 0);
    const value = labels[index];
    const confidence = scores[index];

    const accepted = value !== '_background_noise_' && value !== '_unknown_' &&
      Number.isFinite(confidence) && confidence >= CONFIDENCE_THRESHOLD && confidence <= 1;

    if (!accepted) {
      candidate = null;
      candidateCount = 0;

      if (now - lastCandidateAt >= 650) held = false;

      return null;
    }

    lastCandidateAt = now;

    if (held) return null;

    if (candidate !== value) {
      candidate = value;
      candidateSince = now;
      candidateCount = 1;

      return null;
    }

    candidateCount++;

    if (candidateCount < 3 || now - candidateSince < 180) return null;
    held = true;

    return value === 'go' || value === 'stop' ? { value, confidence } : null;
  };
}

export function recognitionEnvelope(keyword) {
  return {
    v: 1, id: crypto.randomUUID(), ts: new Date().toISOString(),
    from: 'mic-1', kind: 'recognition',
    body: { task: 'keyword', ...keyword }, raw_bytes: RAW_BYTES,
  };
}
