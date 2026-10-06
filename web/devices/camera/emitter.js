import { THRESHOLD } from "./recognizer.js";

export function createEmitter(postEvent) {
  let lastTime = -Infinity,
    lastValue,
    lastConfident;

  return (result, width, height, now = performance.now()) => {
    const confident = result.confidence >= THRESHOLD;
    const changed = result.value !== lastValue || confident !== lastConfident;
    const heartbeat = result.value !== null && now - lastTime >= 2000;

    if (now - lastTime < 250 || (!changed && !heartbeat)) return false;

    const envelope = {
      v: 1,
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      from: "camera-1",
      kind: "recognition",
      body: {
        task: "card",
        value: result.value,
        confidence: result.confidence,
      },
      raw_bytes: width * height * 3,
    };

    postEvent(envelope);
    lastTime = now;
    lastValue = result.value;
    lastConfident = confident;

    return true;
  };
}
