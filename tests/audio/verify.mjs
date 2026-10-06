import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execute = promisify(execFile);

const session = `cr-audio-proof-${process.pid}`;

const server = spawn(process.execPath, [new URL('./serve.mjs', import.meta.url).pathname], {
  env: { ...process.env, MIC_TEST_PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'],
});

async function browser(...args) {
  const result = await execute('agent-browser', ['--session', session, ...args], {
    timeout: 100000, maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, AGENT_BROWSER_DEFAULT_TIMEOUT: '90000' },
  });

  return result.stdout.trim();
}

try {
  const [data] = await once(server.stdout, 'data');
  const url = data.toString().trim();
  await browser('--args', '--autoplay-policy=no-user-gesture-required', 'open', url);
  await browser('click', '#fixtures');

  // Poll with short evaluate calls: one long awaited evaluate outlives the
  // browser protocol's own per-call timeout on slower CI runners.
  const deadline = Date.now() + 180000;
  let report = null;

  while (!report) {
    if (Date.now() > deadline) throw new Error('WAV proof timed out');

    report = JSON.parse(await browser('eval', 'globalThis.audioReport ?? null'));

    if (!report) await new Promise(resolve => setTimeout(resolve, 1000));
  }

  await writeFile(new URL('./results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.results?.filter(item => item.pass).length ?? 0}/${report.results?.length ?? 0} WAV fixtures passed`);

  if (!report.pass) process.exitCode = 1;
} finally {
  try { await browser('close'); } finally {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await exited;
  }
}
