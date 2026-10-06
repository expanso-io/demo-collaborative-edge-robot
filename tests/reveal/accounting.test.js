import test from 'node:test';
import assert from 'node:assert/strict';
import { observe, envelopeBytes, route } from '../../web/reveal/accounting.js';
import { fixtures, fakeBus } from './fixtures.js';

test('fixture bus accounts for every envelope, raw inputs, and exact ratio', () => {
  const bus = fakeBus();
  const sizes = [];
  const observer = observe(bus, (_event, size) => sizes.push(size));
  assert.deepEqual(observer.snapshot(), { bytes: 0n, rawBytes: 0n, count: 0, ratio: '0:0' });
  fixtures.forEach(event => bus.emit(event));
  const expectedBytes = fixtures.reduce((sum, event) => sum + Buffer.byteLength(JSON.stringify(event), 'utf8'), 0);
  assert.equal(expectedBytes, 1735);
  assert.deepEqual(observer.snapshot(), { bytes: 1735n, rawBytes: 953600n, count: 9, ratio: '1735:953600' });
  assert.equal(sizes.length, 9);
  observer.destroy();
  bus.emit(fixtures[0]);
  assert.equal(observer.snapshot().count, 9);
});

test('UTF-8 accounting includes multibyte text; presentation whitespace is excluded', () => {
  const event = { ...fixtures[2], body: { reason: 'Arrêt → station' } };
  assert.equal(envelopeBytes(event), Buffer.byteLength(JSON.stringify(event), 'utf8'));
  assert.ok(envelopeBytes(event) > JSON.stringify(event).length);
});

test('routes describe input, targeted commands, state back, and local decisions', () => {
  assert.deepEqual(route(fixtures[0]), ['camera-1', 'coordinator']);
  assert.deepEqual(route(fixtures[1]), ['mic-1', 'coordinator']);
  assert.deepEqual(route(fixtures[2]), ['coordinator', 'coordinator']);
  assert.deepEqual(route(fixtures[4]), ['coordinator', 'drone-1']);
  assert.deepEqual(route(fixtures[8]), ['drone-2', 'coordinator']);
});
