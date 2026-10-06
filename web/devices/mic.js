import { createKeywordGate, recognitionEnvelope } from './mic/gate.js';
import { captureKeywords } from './mic/capture.js';

let modelPromise;

let recognizer;

let pendingStart;

let generation = 0;

let meter;

let label;

let active = false;

let closeCapture;

function show(message) {
  if (label) label.textContent = message;
}

/** Mount before start; shell owns the user-gesture start/stop controls. */
export function mount(element) {
  const title = document.createElement('label');
  title.textContent = 'Microphone level ';
  meter = document.createElement('meter');
  meter.min = 0;
  meter.max = 1;
  meter.value = 0;
  meter.setAttribute('aria-label', 'Microphone level');
  title.append(meter);
  label = document.createElement('p');
  label.setAttribute('role', 'status');
  label.setAttribute('aria-live', 'polite');
  element.replaceChildren(title, label);
  show(active ? 'Listening for “go” or “stop”.' : 'Microphone off.');
}

function loadScript(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(path, import.meta.url).href;
    script.onload = () => resolve(undefined);
    script.onerror = () => {
      script.remove();
      reject(new Error(`Cannot load local mic dependency: ${path}`));
    };

    document.head.append(script);
  });
}

async function loadModel() {
  if (!globalThis.tf) await loadScript('./mic/vendor/tf.min.js');

  if (!globalThis.speechCommands) await loadScript('./mic/vendor/speech-commands.min.js');

  const model = globalThis.speechCommands.create(
    'BROWSER_FFT', undefined,
    new URL('./mic/model/model.json', import.meta.url).href,
    new URL('./mic/model/metadata.json', import.meta.url).href,
  );

  await model.ensureModelLoaded();

  return model;
}

async function begin(postEvent, token) {
  show('Loading local keyword model…');

  try {
    modelPromise ??= loadModel().catch(error => { modelPromise = undefined; throw error; });
    recognizer = await modelPromise;

    if (token !== generation) return;
    const gate = createKeywordGate();
    const labels = recognizer.wordLabels();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: {
      echoCancellation: false, noiseSuppression: false, autoGainControl: false,
    } });

    if (token !== generation) {
      stream.getTracks().forEach(track => track.stop());

      return;
    }

    try {
      closeCapture = await captureKeywords(recognizer, stream, scores => {
        if (token !== generation) return;
        const keyword = gate(labels, scores, performance.now());

        if (!keyword) return;
        show(`Last heard: ${keyword.value} (${Math.round(keyword.confidence * 100)}%).`);
        Promise.resolve().then(() => postEvent(recognitionEnvelope(keyword))).catch(error => {
          show(`Event delivery failed: ${error.message}`);
        });
      }, level => { if (meter) meter.value = level; }, error => {
        void stop().then(() => show(`Recognition failed: ${error.message}`));
      });
    } catch (error) {
      stream.getTracks().forEach(track => track.stop());
      throw error;
    }

    if (token !== generation) {
      await closeCapture();
      closeCapture = undefined;

      return;
    }

    active = true;
    show('Listening for “go” or “stop”.');
  } catch (error) {
    show(`Microphone unavailable: ${error.message}. Check permission and retry.`);
    throw error;
  }
}

/** Call from the shell's start button after mount(element). */
export async function start(postEvent) {
  if (active) return;

  if (pendingStart) return pendingStart;
  const token = ++generation;
  pendingStart = begin(postEvent, token);

  try { await pendingStart; } finally { pendingStart = undefined; }
}

export async function stop() {
  ++generation;

  if (active) {
    active = false;
    await closeCapture();
    closeCapture = undefined;
  }

  // A permission prompt may resolve after stop; begin then releases its stream.
  if (meter) meter.value = 0;
  show('Microphone off.');
}
