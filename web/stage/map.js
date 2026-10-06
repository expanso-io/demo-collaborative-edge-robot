import { MapAdapter, connectAdapter } from '../adapters/map.js';

export function mountStage(element, bus, postEvent, reportError) {
  const specs = [
    { id: 'rover-1', label: 'Rover', x: 0.5, y: 0.82, lane: 0.15 },
    { id: 'drone-1', label: 'Drone 1', x: 0.38, y: 0.69, lane: -0.09 },
    { id: 'drone-2', label: 'Drone 2', x: 0.62, y: 0.69, lane: 0.03 },
  ];

  const disposers = [];

  const adapters = specs.map(spec => {
    const adapter = new MapAdapter(spec.id, spec);
    const marker = document.createElement('div');
    marker.className = `vehicle ${spec.id === 'rover-1' ? 'rover' : 'drone'}`;
    marker.dataset.device = spec.id;
    const glyph = document.createElement('span');
    glyph.className = 'vehicle-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'vehicle-label';
    label.textContent = spec.label;
    marker.append(glyph, label);
    element.append(marker);
    disposers.push(adapter.onState(state => {
      marker.style.left = `${state.x * 100}%`;
      marker.style.top = `${state.y * 100}%`;
      marker.dataset.phase = state.phase;
      marker.setAttribute('aria-label', `${spec.label}: ${state.phase}`);
    }));
    disposers.push(connectAdapter(adapter, bus, postEvent, reportError));

    return adapter;
  });

  let last;
  let frame;

  function animate(time) {
    if (last !== undefined) for (const adapter of adapters) adapter.tick(Math.min((time - last) / 1000, 0.1));
    last = time;
    frame = requestAnimationFrame(animate);
  }

  frame = requestAnimationFrame(animate);

  return () => { cancelAnimationFrame(frame);

 for (const dispose of disposers) dispose(); };
}
