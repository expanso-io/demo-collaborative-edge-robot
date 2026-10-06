import { mount } from '../../web/reveal/index.js';
import { fixtures, fakeBus } from './fixtures.js';

const bus = fakeBus();

let mounted = mount(document.querySelector('#reveal'), bus);

fixtures.forEach(event => bus.emit(event));

let timers = [];

document.querySelector('#replay').addEventListener('click', () => {
  timers.forEach(timer => clearTimeout(timer));
  mounted.destroy();
  mounted = mount(document.querySelector('#reveal'), bus);
  timers = fixtures.map((event, index) => setTimeout(() => bus.emit(event), index * 550));
});

const theme = document.querySelector('#theme');

function setTheme(value) {
  document.documentElement.dataset.theme = value;
  theme.textContent = value === 'dark' ? 'Light mode' : 'Dark mode';
}

setTheme(localStorage.getItem('reveal-preview-theme') || 'light');

theme.addEventListener('click', () => {
  const value = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(value);
  localStorage.setItem('reveal-preview-theme', value);
});
