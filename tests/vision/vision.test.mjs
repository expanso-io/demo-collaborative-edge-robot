import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recognize } from '../../web/devices/camera/recognizer.js';
import { createEmitter } from '../../web/devices/camera/emitter.js';

const manifest = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url)));

function readPPM(file) {
  const bytes = readFileSync(new URL(file, import.meta.url));
  const header = bytes.subarray(0, 64).toString().match(/^P6\n(\d+) (\d+)\n255\n/);
  assert.ok(header, 'binary RGB fixture');
  const width = Number(header[1]), height = Number(header[2]);
  const data = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    data.set(bytes.subarray(header[0].length + i * 3, header[0].length + i * 3 + 3), i * 4);
    data[i * 4 + 3] = 255;
  }

  return { width, height, data };
}

for (const fixture of manifest) {
  test(fixture.file, () => {
    const result = recognize(readPPM(fixture.file));
    console.log(`${fixture.file}: value=${result.value} confidence=${result.confidence}`);
    assert.equal(result.value, fixture.value);
    assert.ok(result.confidence >= fixture.min && result.confidence <= fixture.max);
  });
}

test('envelopes: transitions, throttle, heartbeat, raw accounting', () => {
  const events = [];
  const emit = createEmitter(event => events.push(event));
  assert.equal(emit({ value: null, confidence: 0 }, 1280, 720, 0), true);
  assert.equal(emit({ value: 1, confidence: .95 }, 1280, 720, 100), false);
  assert.equal(emit({ value: 1, confidence: .95 }, 1280, 720, 250), true);
  assert.equal(emit({ value: 1, confidence: .90 }, 1280, 720, 500), false);
  assert.equal(emit({ value: 1, confidence: .92 }, 1280, 720, 2249), false);
  assert.equal(emit({ value: 1, confidence: .92 }, 1280, 720, 2250), true);
  assert.equal(emit({ value: null, confidence: .4 }, 1280, 720, 2500), true);
  assert.equal(emit({ value: null, confidence: 0 }, 1280, 720, 5000), false);
  assert.equal(emit({ value: 2, confidence: .99 }, 1280, 720, 5250), true);
  assert.equal(new Set(events.map(event => event.id)).size, events.length);

  for (const event of events) {
    assert.ok(JSON.stringify(event).length < 1024);
    assert.equal(event.raw_bytes, 2764800);
    assert.equal(event.from, 'camera-1');
    assert.equal(event.kind, 'recognition');
    assert.equal(event.body.task, 'card');
    assert.equal(event.v, 1);
    assert.ok(Number.isFinite(Date.parse(event.ts)));
    assert.deepEqual(Object.keys(event.body).sort(), ['confidence', 'task', 'value']);
  }
});

test('malformed input fails explicitly', () => {
  assert.throws(() => recognize({ width: 10, height: 10, data: [] }), TypeError);
});
