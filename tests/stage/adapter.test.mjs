import test from "node:test";
import assert from "node:assert/strict";
import { MapAdapter, connectAdapter } from "../../web/adapters/map.js";
import { createBus } from "../../web/bus.js";
import {
  RealRoverAdapter,
  RealDroneAdapter,
} from "../../web/adapters/hardware.js";

test("move reaches station; pause and hold preserve target and position; resume arrives", () => {
  for (const id of ["rover-1", "drone-1", "drone-2"]) {
    const adapter = new MapAdapter(id);
    adapter.moveTo(1);
    adapter.tick(1);
    assert.equal(adapter.phase, "moving");
    adapter.pause();
    const paused = adapter.state();
    adapter.tick(100);
    assert.deepEqual(adapter.state(), paused);
    assert.equal(adapter.station, 1);
    adapter.resume();
    adapter.tick(100);
    assert.equal(adapter.phase, "arrived");
    assert.equal(adapter.position.x, 0.22);
    adapter.moveTo(2);
    adapter.tick(1);
    adapter.hold();
    assert.equal(adapter.phase, "paused");
    assert.equal(adapter.station, 2);
    adapter.resume();
    adapter.tick(100);
    assert.equal(adapter.position.x, 0.78);
    assert.throws(() => adapter.moveTo(3), RangeError);
  }
});

test("only addressed coordinator commands act; duplicates and invalid stations are ignored", async () => {
  let handle;
  const posted = [];
  const adapter = new MapAdapter("rover-1");

  const disconnect = connectAdapter(
    adapter,
    {
      on: (_kind, cb) => {
        handle = cb;

        return () => {};
      },
    },
    (e) => posted.push(e),
  );

  const command = {
    id: "a",
    from: "coordinator",
    body: { target: "drone-1", action: "move_to", station: 1 },
  };

  handle(command);
  assert.equal(adapter.phase, "idle");
  command.body.target = "rover-1";
  handle(command);
  assert.equal(adapter.phase, "moving");
  adapter.pause();
  handle(command);
  assert.equal(adapter.phase, "paused");
  handle({ ...command, id: "b", body: { ...command.body, station: 9 } });
  assert.equal(adapter.station, 1);
  assert.equal(posted.at(-1).body.phase, "paused");
  assert.ok(
    posted.every(
      (e) =>
        e.from === "rover-1" &&
        e.raw_bytes === 0 &&
        JSON.stringify(e).length < 1024,
    ),
  );
  disconnect();
});

test("hardware scaffolds pass instructions and telemetry through the supplied transport", () => {
  const calls = [];

  const transport = {
    send: (...args) => calls.push(args),
    subscribe: (_id, cb) => {
      cb({ phase: "idle" });

      return () => {};
    },
  };

  const rover = new RealRoverAdapter(transport);
  const drone = new RealDroneAdapter("drone-2", transport);
  rover.moveTo(1);
  rover.pause();
  rover.resume();
  rover.hold();
  drone.moveTo(2);
  assert.deepEqual(calls[0], ["rover-1", "move_to", 1]);
  assert.deepEqual(calls[4], ["drone-2", "move_to", 2]);
});

test("one source fans ordinary and named SSE messages out, unsubscribes and closes", () => {
  let source;
  let count = 0;
  let deliveries = 0;

  class Source {
    constructor() {
      count++;
      source = this;
      this.handlers = {};
    }
    addEventListener(name, cb) {
      this.handlers[name] = cb;
    }
    close() {
      this.closed = true;
    }
  }

  const bus = createBus("test", Source);
  const off = bus.on("decision", () => deliveries++);

  const event = {
    data: JSON.stringify({ v: 1, kind: "decision", body: { phase: "moving" } }),
  };

  source.onmessage(event);
  source.handlers.decision(event);
  assert.equal(count, 1);
  assert.equal(deliveries, 2);
  off();
  source.onmessage(event);
  assert.equal(deliveries, 2);
  bus.close();
  assert.equal(source.closed, true);
});

test("light and dark text palettes meet WCAG AA on both surfaces", () => {
  function luminance(hex) {
    const channels = hex.match(/[a-f0-9]{2}/gi).map((channel) => {
      const value = parseInt(channel, 16) / 255;

      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });

    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }

  for (const palette of [
    { text: ["202724", "4b5650"], surfaces: ["f4f4f0", "e6e8e5"] },
    { text: ["edf1e9", "bcc8bf"], surfaces: ["19201d", "29332d"] },
  ]) {
    for (const text of palette.text)
      for (const surface of palette.surfaces) {
        const values = [luminance(text), luminance(surface)].sort(
          (a, b) => a - b,
        );

        assert.ok((values[1] + 0.05) / (values[0] + 0.05) >= 4.5);
      }
  }
});
