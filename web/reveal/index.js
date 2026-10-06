import { observe, route } from './accounting.js';

const devices = [
  ['camera-1', 'Camera', 'Local model: reads card 1 or 2.', 16, 22],
  ['mic-1', 'Microphone', 'Local model: hears “go” or “stop”.', 16, 76],
  ['coordinator', 'Coordinator', 'Pipeline: combines results and permissions.', 50, 49],
  ['rover-1', 'Rover', 'Adapter: moves to the selected station.', 84, 14],
  ['drone-1', 'Drone 1', 'Adapter: follows the selected station.', 84, 49],
  ['drone-2', 'Drone 2', 'Adapter: follows the selected station.', 84, 84],
];

function node(tag, className, text = '') {
  const result = document.createElement(tag);
  result.className = className;
  result.textContent = text;

  return result;
}

/** Mount into a host element. Returns destroy() and an exact accounting snapshot(). */
export function mount(element, bus) {
  const root = node('section', 'reveal');
  root.setAttribute('aria-label', 'Device collaboration reveal');
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./style.css', import.meta.url).href;
  root.append(stylesheet);
  root.append(node('h2', 'reveal-title', 'Small messages. A shared job.'));
  root.append(node('p', 'reveal-intro', 'Each device contributes one result. The pipelines carry it to the next device.'));
  const diagram = node('div', 'reveal-diagram');
  diagram.setAttribute('aria-label', 'Camera and microphone send to coordinator; coordinator exchanges commands and state with rover and two drones.');
  const links = node('div', 'reveal-links');
  links.setAttribute('aria-hidden', 'true');
  diagram.append(links);
  const deviceElements = new Map();

  for (const [id, label, task, x, y] of devices) {
    const device = node('div', 'reveal-device');
    device.style.left = `${x}%`;
    device.style.top = `${y}%`;
    device.append(node('strong', '', String(label)), node('span', '', String(id)));
    diagram.append(device);
    deviceElements.set(id, device);
  }

  root.append(diagram);
  const latest = node('p', 'reveal-latest', 'Waiting for device envelopes.');
  root.append(latest);
  const stats = node('div', 'reveal-stats');
  const ratio = node('strong', 'reveal-ratio', '0:0');
  const sentence = node('p', 'reveal-sentence', 'No envelopes received yet.');
  stats.append(node('p', '', 'Envelope bytes : raw input bytes'), ratio, sentence,
    node('small', '', 'Compact UTF-8 JSON payloads. Raw input sizes are reported by the camera and microphone. Transport headers are excluded.'));
  root.append(stats);
  const tasks = node('dl', 'reveal-tasks');

  for (const [, label, task] of devices) tasks.append(node('dt', '', String(label)), node('dd', '', String(task)));
  root.append(tasks, node('h3', '', 'Latest envelopes'));
  const empty = node('p', 'reveal-empty', 'The last 12 messages will appear here, newest first.');
  const list = node('ol', 'reveal-envelopes');
  root.append(empty, list);
  element.append(root);
  let destroyed = false;

  function drawLinks() {
    links.replaceChildren();
    const box = diagram.getBoundingClientRect();

    const center = id => {
      const rect = deviceElements.get(id).getBoundingClientRect();

      return [rect.left + rect.width / 2 - box.left, rect.top + rect.height / 2 - box.top];
    };

    for (const [id] of devices) {
      if (id === 'coordinator') continue;
      const [x, y] = center(id);
      const [cx, cy] = center('coordinator');
      const line = node('div', 'reveal-link');
      line.style.left = `${x}px`;
      line.style.top = `${y}px`;
      line.style.width = `${Math.hypot(cx - x, cy - y)}px`;
      line.style.transform = `rotate(${Math.atan2(cy - y, cx - x)}rad)`;
      links.append(line);
    }
  }

  const resize = new ResizeObserver(drawLinks);
  resize.observe(diagram);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();

  function animate(from, to) {
    if (reducedMotion.matches) return;
    const source = deviceElements.get(from);
    const target = deviceElements.get(to);

    if (!source || !target) return;
    const a = source.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const box = diagram.getBoundingClientRect();
    const dot = node('span', 'reveal-packet');
    dot.style.left = `${a.left + a.width / 2 - box.left}px`;
    dot.style.top = `${a.top + a.height / 2 - box.top}px`;
    links.append(dot);

    const animation = dot.animate([
      { transform: 'translate(0, 0)', opacity: 0.65 },
      { transform: `translate(${b.left + b.width / 2 - a.left - a.width / 2}px, ${b.top + b.height / 2 - a.top - a.height / 2}px)`, opacity: 0.2 },
    ], { duration: 450, easing: 'ease-out' });

    animations.add(animation);
    animation.onfinish = () => { animations.delete(animation); dot.remove(); };
  }

  const observer = observe(bus, (envelope, size, total) => {
    if (destroyed) return;
    const [from, to] = route(envelope);
    animate(from, to);
    latest.textContent = from === to ? `${from}: ${envelope.kind}` : `${from} → ${to} · ${envelope.kind}`;
    ratio.textContent = total.ratio;
    sentence.textContent = `${total.count} envelopes exchanged ${total.bytes.toLocaleString('en-US')} bytes, replacing ${total.rawBytes.toLocaleString('en-US')} bytes of raw frames and audio that stayed on their devices.`;
    const entry = node('li', 'reveal-envelope');
    entry.append(node('p', '', `${envelope.from} · ${envelope.kind} · ${size} bytes`), node('pre', '', JSON.stringify(envelope, null, 2)));
    list.prepend(entry);
    empty.hidden = true;

    while (list.children.length > 12) list.lastElementChild.remove();
  });

  return {
    snapshot: observer.snapshot,
    destroy() {
      destroyed = true;
      observer.destroy();
      resize.disconnect();
      animations.forEach(animation => animation.cancel());
      root.remove();
    },
  };
}
