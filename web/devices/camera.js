import { recognize } from './camera/recognizer.js';
import { createEmitter } from './camera/emitter.js';

let host, video, canvas, label, stream, timer;

let generation = 0;

/** Shell calls mount(element) once, then start(postEvent) from a user gesture. */
export function mount(element) {
  stop();
  host = element;
  video = document.createElement('video');
  video.autoplay = true; video.muted = true; video.playsInline = true;
  video.hidden = true;
  canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Live camera preview with detected card outline');
  canvas.style.cssText = 'display:block;width:100%;max-width:480px;height:auto;border-radius:8px';
  label = document.createElement('p');
  label.setAttribute('role', 'status');
  label.textContent = 'Camera stopped';
  host.replaceChildren(video, canvas, label);
}

export async function start(postEvent) {
  if (!host) throw new Error('Call camera.mount(element) before camera.start(postEvent)');
  stop();
  const token = generation;
  label.textContent = 'Requesting camera access';
  let acquired;

  try {
    acquired = await navigator.mediaDevices.getUserMedia({ audio: false,
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' } });

    if (token !== generation) { acquired.getTracks().forEach(track => track.stop());

 return; }

    stream = acquired;
    video.srcObject = stream;
    await video.play();

    if (token !== generation) return;
    // Keep distant A4 cards readable; bound work to the requested 720p frame.
    canvas.width = Math.min(1280, video.videoWidth);
    canvas.height = Math.round(video.videoHeight * canvas.width / video.videoWidth);
    const context = canvas.getContext('2d', { willReadFrequently: true });

    const emit = createEmitter(envelope => {
      Promise.resolve(postEvent(envelope)).catch(error => {
        if (token === generation) label.textContent = `Camera event delivery failed: ${error.message}`;
      });
    });

    const tick = () => {
      if (token !== generation) return;

      if (video.readyState >= 2) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const result = recognize(context.getImageData(0, 0, canvas.width, canvas.height));
        emit(result, video.videoWidth, video.videoHeight);

        if (result.region) {
          context.beginPath();
          result.region.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
          context.closePath(); context.lineWidth = 3;
          context.strokeStyle = result.value === null ? '#b45309' : '#087f5b'; context.stroke();
        }

        label.textContent = result.value === null ? 'No readable card · waiting' : `Card ${result.value} · ${Math.round(result.confidence * 100)}% confidence`;
      }

      timer = setTimeout(tick, 260);
    };

    label.textContent = 'Camera ready';
    tick();
  } catch (error) {
    acquired?.getTracks().forEach(track => track.stop());

    if (token === generation) { stop(); label.textContent = `Camera unavailable: ${error.message}`; }

    throw error;
  }
}

export function stop() {
  generation++;
  clearTimeout(timer);
  stream?.getTracks().forEach(track => track.stop());
  stream = undefined;

  if (video) video.srcObject = null;

  if (label) label.textContent = 'Camera stopped';
}
