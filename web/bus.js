/** One SSE connection shared by device displays, adapters and the reveal. */
export function createBus(
  url = "http://127.0.0.1:4190/stream",
  Source = EventSource,
) {
  const listeners = new Map();
  const source = new Source(url);

  function emit(kind, value) {
    for (const handler of listeners.get(kind) ?? []) {
      try {
        handler(value);
      } catch (error) {
        console.error("Bus subscriber failed", error);
      }
    }
  }

  function receive(event) {
    try {
      const envelope = JSON.parse(event.data);

      if (envelope.v !== 1 || !envelope.kind || !envelope.body) return;
      emit(envelope.kind, envelope);
      emit("*", envelope);
    } catch (error) {
      console.error("Invalid bus envelope", error);
    }
  }

  source.onmessage = receive;

  for (const kind of ["recognition", "decision", "command", "state"]) {
    source.addEventListener(kind, receive);
  }

  source.onopen = () => emit("connection", "connected");
  source.onerror = () => emit("connection", "reconnecting");

  return {
    on(kind, handler) {
      if (!listeners.has(kind)) listeners.set(kind, new Set());
      listeners.get(kind).add(handler);

      return () => listeners.get(kind)?.delete(handler);
    },
    close() {
      source.close();
      listeners.clear();
    },
  };
}
