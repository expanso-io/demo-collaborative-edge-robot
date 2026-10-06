import { mount, start, stop } from '../../web/devices/mic.js';

const output = document.querySelector('#output');

mount(document.querySelector('#mic'));

let events = [];

function receive(event) { events.push(event); output.textContent = JSON.stringify(events, null, 2); }

document.querySelector('#live').onclick = () => start(receive).catch(error => { output.textContent = error.message; });

document.querySelector('#stop').onclick = () => stop();

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function runFixtures() {
  await stop();
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  const context = new AudioContext({ sampleRate: 44100 });
  await context.resume();
  const destination = context.createMediaStreamDestination();
  const issuedStreams = [];
  navigator.mediaDevices.getUserMedia = async () => {
    const stream = destination.stream.clone();
    issuedStreams.push(stream);

    return stream;
  };

  const results = [];

  try {
    await start(receive);

    for (const voice of ['samantha', 'daniel']) {
      for (const word of ['go', 'stop', 'no', 'yes', 'left']) {
        results.push(await play(`${voice}-${word}`, word === 'go' || word === 'stop' ? word : null));
      }
    }

    results.push(await play('noise', null));
    results.push(await play('silence', null));
  } finally {
    await stop();
    navigator.mediaDevices.getUserMedia = original;
    destination.stream.getTracks().forEach(track => track.stop());
    await context.close();
  }

  const streamsReleased = issuedStreams.every(stream => stream.getTracks().every(track => track.readyState === 'ended'));
  const localResourcesOnly = performance.getEntriesByType('resource').every(entry => new URL(entry.name).origin === location.origin);

  const report = {
    pass: results.every(result => result.pass) && streamsReleased && localResourcesOnly,
    testedAt: new Date().toISOString(),
    browser: navigator.userAgent,
    streamsReleased, localResourcesOnly, results,
  };

  globalThis.audioReport = report;
  output.textContent = JSON.stringify(report, null, 2);

  return report;

  async function play(name, expected) {
    await delay(1600);
    events = [];
    const buffer = await context.decodeAudioData(await (await fetch(`./fixtures/${name}.wav`)).arrayBuffer());
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    source.start();
    await delay(buffer.duration * 1000 + 1400);
    source.disconnect();
    const heard = events.map(event => ({ value: event.body.value, confidence: event.body.confidence, raw_bytes: event.raw_bytes }));
    const pass = expected ? heard.length === 1 && heard[0].value === expected : heard.length === 0;

    return { fixture: `${name}.wav`, expected, heard, pass };
  }
}

document.querySelector('#fixtures').onclick = () => {
  document.querySelector('#fixtures').disabled = true;
  runFixtures().catch(error => { globalThis.audioReport = { pass: false, error: error.message }; output.textContent = error.stack; })
    .finally(() => { document.querySelector('#fixtures').disabled = false; });
};
