import { mount } from '../../web/reveal/index.js';
import { fakeBus, fixtures } from './fixtures.js';

export function checkRendered() {
  const host = document.createElement('div');
  document.body.append(host);
  const bus = fakeBus();
  const mounted = mount(host, bus);

  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  try {
    check(host.querySelector('.reveal-ratio').textContent === '0:0', 'empty accounting');
    fixtures.forEach(event => bus.emit(event));
    check(host.querySelector('.reveal-ratio').textContent === '1735:953600', 'rendered ratio');
    check(host.querySelectorAll('.reveal-device').length === 6, 'six devices');
    check(host.querySelector('pre').textContent === JSON.stringify(fixtures[8], null, 2), 'pretty JSON');
    fixtures.forEach(event => bus.emit(event));
    check(host.querySelectorAll('.reveal-envelope').length === 12, 'bounded transcript');
    check(mounted.snapshot().bytes === 3470n, 'totals retain older messages');
    mounted.destroy();
    bus.emit(fixtures[0]);
    check(mounted.snapshot().count === 18, 'destroy unsubscribes');
    check(!host.querySelector('.reveal'), 'destroy removes UI');

    return { passed: 8 };
  } finally {
    mounted.destroy();
    host.remove();
  }
}
