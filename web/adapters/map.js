/** DeviceAdapter implementation. Station selection and permission stay in pipelines. */
export class MapAdapter {
  constructor(id, { x = 0.5, y = 0.82, speed = 0.12, lane = 0 } = {}) {
    this.id = id;
    this.position = { x, y };
    this.speed = speed;
    this.lane = lane;
    this.station = null;
    this.phase = "idle";
    this.listeners = new Set();
  }
  onState(callback) {
    this.listeners.add(callback);
    callback(this.state());

    return () => this.listeners.delete(callback);
  }
  state() {
    return { phase: this.phase, station: this.station, ...this.position };
  }
  emit() {
    for (const callback of this.listeners) callback(this.state());
  }
  moveTo(station) {
    if (station !== 1 && station !== 2)
      throw new RangeError("Station must be 1 or 2");
    this.station = station;
    this.phase = "moving";
    this.emit();
  }
  pause() {
    if (this.phase === "moving") {
      this.phase = "paused";
      this.emit();
    }
  }
  resume() {
    if (this.phase === "paused" && this.station !== null) {
      this.phase = "moving";
      this.emit();
    }
  }
  hold() {
    this.pause();
  }
  /** Advance by elapsed seconds; the browser owns the animation clock. */
  tick(seconds) {
    if (this.phase !== "moving" || !Number.isFinite(seconds) || seconds <= 0)
      return;
    const target = { x: this.station === 1 ? 0.22 : 0.78, y: 0.4 + this.lane };
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const distance = Math.hypot(dx, dy);
    const step = this.speed * seconds;

    if (distance <= step) {
      this.position = target;
      this.phase = "arrived";
    } else {
      this.position = {
        x: this.position.x + (dx / distance) * step,
        y: this.position.y + (dy / distance) * step,
      };
    }

    this.emit();
  }
}

export function connectAdapter(
  adapter,
  bus,
  postState,
  reportError = console.error,
) {
  const seen = new Set();

  const actions = {
    move_to: (station) => adapter.moveTo(station),
    pause: () => adapter.pause(),
    resume: () => adapter.resume(),
    hold: () => adapter.hold(),
  };

  const offCommand = bus.on("command", (envelope) => {
    if (envelope.from !== "coordinator" || envelope.body.target !== adapter.id)
      return;

    if (seen.has(envelope.id)) return;
    const { action, station } = envelope.body;

    if (!Object.hasOwn(actions, action)) return;

    if (action === "move_to" && station !== 1 && station !== 2) return;
    seen.add(envelope.id);

    if (seen.size > 256) seen.delete(seen.values().next().value);

    try {
      Promise.resolve(actions[action](station)).catch(reportError);
    } catch (error) {
      reportError(error);
    }
  });

  let previousPhase;
  let lastSent = -Infinity;

  const offState = adapter.onState((state) => {
    const now = performance.now();

    if (state.phase === previousPhase && now - lastSent < 250) return;
    previousPhase = state.phase;
    lastSent = now;
    Promise.resolve(
      postState({
        v: 1,
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
        from: adapter.id,
        kind: "state",
        body: state,
        raw_bytes: 0,
      }),
    ).catch(reportError);
  });

  return () => {
    offCommand();
    offState();
  };
}
