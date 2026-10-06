import assert from "node:assert/strict";
import net from "node:net";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

const session = `cr-stage-rendered-${process.pid}`;

let origin;

let ports = {};

const env = {
  ...process.env,
  AGENT_BROWSER_HEADED: "false",
};

delete env.AGENT_BROWSER_AUTO_CONNECT;

delete env.AGENT_BROWSER_CDP;

delete env.AGENT_BROWSER_PROFILE;

function browser(...args) {
  return execFileSync(
    "agent-browser",
    [
      "--session",
      session,
      "--auto-connect",
      "false",
      "--headed",
      "false",
      ...args,
    ],
    {
      cwd: root,
      env,
      encoding: "utf8",
    },
  ).trim();
}

function evaluate(script) {
  return JSON.parse(browser("eval", script));
}

async function fixture(kind, body) {
  const response = await fetch(`${origin}/__fixture`, {
    method: "POST",
    body: JSON.stringify({
      v: 1,
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      from: "coordinator",
      kind,
      body,
      raw_bytes: 0,
    }),
  });

  assert.equal(response.status, 200);
}

const server = spawn(
  process.execPath,
  ["tests/stage/serve.mjs", "--fixtures"],
  { cwd: root, stdio: ["ignore", "pipe", "inherit"] },
);

try {
  const [ready] = await Promise.race([
    once(server.stdout, "data"),
    once(server, "exit").then(() => {
      throw new Error("Fixture server failed to start");
    }),
  ]);

  ({ origin, ports } = JSON.parse(ready.toString()));
  browser("open", origin);
  browser("wait", "#stage-map");

  for (const width of [1440, 768, 400, 320]) {
    browser("set", "viewport", String(width), "1000");
    assert.equal(
      evaluate("document.documentElement.scrollWidth <= innerWidth"),
      true,
      `overflow at ${width}`,
    );
    browser("screenshot", "--full", `tests/stage/stage-${width}.png`);
  }

  browser("set", "viewport", "1440", "1000");
  evaluate("window.scrollTo(0, 120); true");
  const y = evaluate("window.scrollY");
  browser("press", "ArrowRight");
  assert.equal(
    evaluate('document.querySelector("#beat-count").textContent'),
    "Step 2 of 6",
  );
  assert.equal(evaluate("window.scrollY"), y);
  browser("press", "ArrowLeft");
  assert.equal(
    evaluate('document.querySelector("#beat-count").textContent'),
    "Step 1 of 6",
  );
  browser("click", "#theme");
  browser("reload");
  assert.equal(evaluate("document.documentElement.dataset.theme"), "dark");
  browser("screenshot", "--full", "tests/stage/stage-dark.png");
  browser("click", "#theme");

  for (const key of ["1", "2", "c", "g", "s"]) browser("press", key);
  const received = await (await fetch(`${origin}/__received`)).json();

  const recognitions = received.filter(
    (item) => item.envelope.kind === "recognition",
  );

  assert.deepEqual(
    recognitions.map((item) => item.port),
    [4101, 4101, 4101, 4102, 4102],
  );
  assert.deepEqual(
    recognitions.map((item) => item.envelope.body.value),
    [1, 2, null, "go", "stop"],
  );
  assert.ok(recognitions.every((item) => item.envelope.raw_bytes === 0));
  assert.ok(recognitions.every((item) => item.contentType === "text/plain"));
  await fixture("decision", {
    destination: 2,
    phase: "moving",
    reason: "Camera and microphone agree.",
  });

  for (const target of ["rover-1", "drone-1", "drone-2"]) {
    await fixture("command", { target, action: "move_to", station: 2 });
  }

  browser("wait", '[data-device="rover-1"][data-phase="moving"]');
  await fixture("command", { target: "rover-1", action: "pause", station: 2 });
  browser("wait", '[data-device="rover-1"][data-phase="paused"]');

  const left = evaluate(
    'document.querySelector("[data-device=rover-1]").style.left',
  );

  assert.equal(
    evaluate('document.querySelector("#destination").textContent'),
    "Station 2",
  );
  assert.equal(
    evaluate('document.querySelector("[data-device=rover-1]").style.left'),
    left,
  );
  await fixture("command", { target: "rover-1", action: "resume", station: 2 });
  browser("wait", '[data-device="rover-1"][data-phase="arrived"]');
  browser("screenshot", "--full", "tests/stage/stage-arrived.png");
  assert.equal(browser("errors"), "");
  console.log(
    "PASS: 4 viewport widths, beat navigation, scroll retention, theme persistence, 5 manual routes, bus movement/pause/resume/arrival, no browser errors.",
  );
} finally {
  try {
    browser("close");
  } finally {
    if (server.exitCode === null) {
      server.kill("SIGTERM");
      await once(server, "exit");
    }
  }
}

for (const port of [Number(new URL(origin).port), ...Object.values(ports)]) {
  await new Promise((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      reject(new Error("Fixture port still listening: " + port));
    });
    socket.once("error", (error) => {
      if (error.code === "ECONNREFUSED") resolve();
      else reject(error);
    });
  });
}

console.log("PASS: every owned fixture port is closed.");
