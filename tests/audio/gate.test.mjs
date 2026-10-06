import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeywordGate, recognitionEnvelope, RAW_BYTES } from '../../web/devices/mic/gate.js';

const labels = ['_background_noise_', 'go', 'stop', 'no', 'yes', 'left'];

function scores(index, confidence = 0.96) {
  const values = Array(6).fill((1 - confidence) / 5);
  values[index] = confidence;

  return values;
}

test('only confident winning go and stop produce envelopes', () => {
  for (let i = 0; i < labels.length; i++) {
    const gate = createKeywordGate();
    gate(labels, scores(i), 0);
    gate(labels, scores(i), 120);
    const hit = gate(labels, scores(i), 240);
    assert.equal(hit?.value ?? null, [1, 2].includes(i) ? labels[i] : null);
  }

  assert.equal(createKeywordGate()(labels, scores(1, 0.749), 0), null);
  const boundary = createKeywordGate();
  boundary(labels, scores(1, 0.75), 0);
  boundary(labels, scores(1, 0.75), 120);
  assert.equal(boundary(labels, scores(1, 0.75), 240).value, 'go');
  assert.equal(createKeywordGate()(labels, scores(1, Infinity), 0), null);
});

test('one utterance emits once despite changing tails; quiet re-arms', () => {
  const gate = createKeywordGate();
  assert.equal(gate(labels, scores(1), 0), null);
  assert.equal(gate(labels, scores(1), 120), null);
  assert.equal(gate(labels, scores(1), 240).value, 'go');
  assert.equal(gate(labels, scores(2), 360), null);
  assert.equal(gate(labels, scores(2), 480), null);
  assert.equal(gate(labels, scores(0), 1200), null);
  assert.equal(gate(labels, scores(2), 1400), null);
  assert.equal(gate(labels, scores(2), 1520), null);
  assert.equal(gate(labels, scores(2), 1640).value, 'stop');
});

test('envelope matches contract and carries no audio', () => {
  const envelope = recognitionEnvelope({ value: 'go', confidence: 0.9 });
  assert.equal(envelope.from, 'mic-1');
  assert.equal(envelope.kind, 'recognition');
  assert.equal(envelope.v, 1);
  assert.deepEqual(envelope.body, { task: 'keyword', value: 'go', confidence: 0.9 });
  assert.match(envelope.id, /^[0-9a-f-]{36}$/);
  assert.equal(new Date(envelope.ts).toISOString(), envelope.ts);
  assert.equal(envelope.raw_bytes, RAW_BYTES);
  assert.equal(RAW_BYTES, 31951);
  assert.ok(Buffer.byteLength(JSON.stringify(envelope)) < 1024);
});

test('stable non-command words cannot emit a misleading command tail', () => {
  const gate = createKeywordGate();

  for (const time of [0, 120, 240]) assert.equal(gate(labels, scores(3), time), null);

  for (const time of [360, 480, 600]) assert.equal(gate(labels, scores(1), time), null);
});
