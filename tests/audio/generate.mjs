import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('./fixtures/', import.meta.url));

for (const voice of ['Samantha', 'Daniel']) {
  for (const word of ['go', 'stop', 'no', 'yes', 'left']) {
    const base = `${directory}${voice.toLowerCase()}-${word}`;
    execFileSync('/usr/bin/say', ['-v', voice, '-r', '150', '-o', `${base}.aiff`, word]);
    execFileSync('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', `${base}.aiff`, `${base}.wav`]);
    unlinkSync(`${base}.aiff`);
  }
}

function writeNoise(name, amplitude) {
  const frames = 32000;
  const wav = Buffer.alloc(44 + frames * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(frames * 2, 40);
  let seed = 17;

  for (let i = 0; i < frames; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    wav.writeInt16LE(Math.round((seed / 4294967296 * 2 - 1) * amplitude), 44 + i * 2);
  }

  writeFileSync(`${directory}${name}.wav`, wav);
}

writeNoise('noise', 5000);

writeNoise('silence', 0);
