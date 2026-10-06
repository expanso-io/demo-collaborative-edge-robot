export const fixtures = [
  ['camera-1', 'recognition', { task: 'card', value: 2, confidence: 0.96 }, 921600],
  ['mic-1', 'recognition', { task: 'keyword', value: 'go', confidence: 0.94 }, 32000],
  ['coordinator', 'decision', { destination: 2, phase: 'moving', reason: 'Card and permission received' }, 0],
  ...['rover-1', 'drone-1', 'drone-2'].map(target => ['coordinator', 'command', { target, action: 'move_to', station: 2 }, 0]),
  ...['rover-1', 'drone-1', 'drone-2'].map(id => [id, 'state', { phase: 'moving', station: 2, x: 0.4, y: 0.6 }, 0]),
].map(([from, kind, body, raw_bytes], index) => ({
  v: 1, id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  ts: '2026-10-06T16:00:00.000Z', from, kind, body, raw_bytes,
}));

export function fakeBus() {
  const listeners = new Map();

  return {
    on(kind, handler) {
      if (!listeners.has(kind)) listeners.set(kind, new Set());
      listeners.get(kind).add(handler);

      return () => listeners.get(kind).delete(handler);
    },
    emit(envelope) { listeners.get(envelope.kind)?.forEach(handler => handler(envelope)); },
  };
}
