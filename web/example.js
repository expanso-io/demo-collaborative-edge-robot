// @ts-check
const stages = Array.from(document.querySelectorAll('[data-stage-id]'));

const panels = Array.from(document.querySelectorAll('[data-stage-panel]'));

let current = 0;

/** @param {number} index */
function selectStage(index) {
  current = (index + stages.length) % stages.length;
  stages.forEach((stage, i) => {
    if (i === current) stage.setAttribute('aria-current', 'step');
    else stage.removeAttribute('aria-current');
  });
  panels.forEach((panel, i) => { panel.toggleAttribute('hidden', i !== current); });
}

stages.forEach((stage, i) => stage.addEventListener('click', () => selectStage(i)));

document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;

  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    selectStage(current + (event.key === 'ArrowRight' ? 1 : -1));
  }
});

const themeButton = document.querySelector('#theme');
/** @param {string} theme */

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButton?.setAttribute('aria-pressed', String(theme === 'dark'));

  if (themeButton) themeButton.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
}

try { setTheme(localStorage.getItem('robot-example-theme') === 'dark' ? 'dark' : 'light'); }
catch { setTheme('light'); }

themeButton?.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);

  try { localStorage.setItem('robot-example-theme', theme); }
  catch { /* Theme still works when browser storage is disabled. */ }
});

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const id = button.getAttribute('data-copy');
    const source = id ? document.getElementById(id) : null;
    const feedback = document.getElementById(`${button.id}-status`);

    if (!feedback) return;

    try {
      if (!source) throw new Error('Missing command');
      await navigator.clipboard.writeText(source.textContent ?? '');
      feedback.textContent = 'Copied';
    } catch {
      feedback.textContent = 'Copy failed. Select the text and copy it manually.';
    }
  });
});
