const encoder = new TextEncoder();

/** Count compact UTF-8 JSON payloads, excluding transport headers/framing. */
export function envelopeBytes(envelope) {
  return encoder.encode(JSON.stringify(envelope)).byteLength;
}

export function createAccounting() {
  let bytes = 0n;
  let rawBytes = 0n;
  let count = 0;

  return {
    add(envelope) {
      const size = envelopeBytes(envelope);
      bytes += BigInt(size);
      rawBytes += BigInt(envelope.raw_bytes);
      count += 1;

      return size;
    },
    snapshot() {
      return { bytes, rawBytes, count, ratio: `${bytes}:${rawBytes}` };
    },
  };
}

export function route(envelope) {
  if (envelope.kind === 'command') return [envelope.from, envelope.body.target];

  if (envelope.from !== 'coordinator') return [envelope.from, 'coordinator'];

  return ['coordinator', 'coordinator'];
}

export function observe(bus, onEnvelope) {
  const accounting = createAccounting();

  const subscriptions = ['recognition', 'decision', 'command', 'state'].map(kind => {
    const handler = envelope => onEnvelope(envelope, accounting.add(envelope), accounting.snapshot());
    const unsubscribe = bus.on(kind, handler);

    return () => {
      unsubscribe?.();
    };
  });

  return { snapshot: accounting.snapshot, destroy: () => subscriptions.forEach(off => off()) };
}
