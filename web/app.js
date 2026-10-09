import { servicePort } from "./port-config.js";
import { createBus } from "./bus.js";
import { mountStage } from "./stage/map.js";

const endpoints = {
  "camera-1": servicePort(4101),
  "mic-1": servicePort(4102),
  "rover-1": servicePort(4111),
  "drone-1": servicePort(4121),
  "drone-2": servicePort(4122),
};

const get = (id) => document.getElementById(id);

function button(id) {
  const element = get(id);

  if (!(element instanceof HTMLButtonElement))
    throw new Error("Missing button: " + id);

  return element;
}

function openManualPanel() {
  const panel = get("manual-panel");

  if (panel instanceof HTMLDetailsElement) panel.open = true;
}

export async function postEvent(envelope) {
  const port = endpoints[envelope.from];

  if (!port) throw new Error("Unknown device");
  const json = JSON.stringify(envelope);

  if (new TextEncoder().encode(json).length >= 1024)
    throw new Error("Envelope exceeds 1 KB");

  const response = await fetch(`http://127.0.0.1:${port}/events`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: json,
    signal: AbortSignal.timeout(3000),
  });

  if (!response.ok)
    throw new Error(`${envelope.from} returned ${response.status}`);
}

const bus = createBus();

const cleanups = [];

function reportError(error) {
  get("connection").textContent =
    `Device delivery failed: ${error.message}. Check the local nodes.`;
}

cleanups.push(mountStage(get("stage-map"), bus, postEvent, reportError));

bus.on("connection", (status) => {
  get("connection").textContent =
    status === "connected"
      ? "Device bus connected"
      : "Device bus disconnected. Reconnecting…";
});

bus.on("decision", (envelope) => {
  if (envelope.from !== "coordinator") return;
  const { destination, phase, reason } = envelope.body;
  get("destination").textContent =
    destination === null ? "Not selected" : `Station ${destination}`;
  get("phase").textContent = phase;
  get("reason").textContent = reason;

  for (const station of document.querySelectorAll("[data-station]")) {
    if (!(station instanceof HTMLElement)) continue;
    station.dataset.selected = String(
      Number(station.dataset.station) === destination,
    );
  }
});

bus.on("recognition", (envelope) => {
  const { value, confidence } = envelope.body;

  const target = { "camera-1": "camera-reading", "mic-1": "mic-reading" }[
    envelope.from
  ];

  if (!target || !Number.isFinite(confidence)) return;
  get(target).textContent =
    `${value === null ? "Unclear input" : value} · ${Math.round(confidence * 100)}% confidence`;
});

const beats = [
  ["Give the robot a job", "A camera, a microphone and three moving devices."],
  ["Choose a destination", "Hold up card 1 or 2. Watch the selected station."],
  ["Give permission", "Say “go”. Two devices contribute to one action."],
  ["Interrupt the journey", "Say “stop”. The destination stays selected."],
  [
    "Try an unclear input",
    "Cover the number. Watch the system wait, then uncover it.",
  ],
  [
    "Show what travels",
    "Open the event reveal: small recognition results between devices.",
  ],
];

let beat = 0;

function showBeat(next) {
  const y = window.scrollY;
  beat = Math.max(0, Math.min(beats.length - 1, next));
  get("beat-count").textContent = `Step ${beat + 1} of ${beats.length}`;
  get("beat-name").textContent = beats[beat][0];
  get("beat-cue").textContent = beats[beat][1];
  button("previous").disabled = beat === 0;
  button("next").disabled = beat === beats.length - 1;
  window.scrollTo({ top: y, behavior: "instant" });
}

get("previous").addEventListener("click", () => showBeat(beat - 1));

get("next").addEventListener("click", () => showBeat(beat + 1));

showBeat(0);

async function manual(value) {
  const card = ["1", "2", "covered"].includes(value);

  const envelope = {
    v: 1,
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    from: card ? "camera-1" : "mic-1",
    kind: "recognition",
    raw_bytes: 0,
    body: card
      ? {
          task: "card",
          value: value === "covered" ? null : Number(value),
          confidence: value === "covered" ? 0.1 : 0.99,
        }
      : { task: "keyword", value, confidence: 0.99 },
  };

  get("manual-status").textContent = `Sending manual ${value}…`;

  try {
    await postEvent(envelope);
    get("manual-status").textContent =
      `Manual ${value} delivered to ${envelope.from}. Waiting for the pipeline.`;
  } catch (error) {
    get("manual-status").textContent =
      `Manual input failed: ${error.message}. Start the local device nodes.`;
  }
}

for (const button of document.querySelectorAll("[data-input]")) {
  if (!(button instanceof HTMLButtonElement)) continue;
  button.addEventListener("click", () => manual(button.dataset.input));
}

document.addEventListener("keydown", (event) => {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey
  )
    return;

  if (
    event.target instanceof Element &&
    event.target.closest('input,textarea,select,[contenteditable="true"]')
  )
    return;

  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    showBeat(beat + (event.key === "ArrowRight" ? 1 : -1));

    return;
  }

  const value = { 1: "1", 2: "2", c: "covered", g: "go", s: "stop" }[
    event.key.toLowerCase()
  ];

  if (value) {
    event.preventDefault();
    openManualPanel();
    void manual(value);
  }
});

function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  get("theme").setAttribute("aria-pressed", String(dark));
  get("theme").textContent = dark ? "Light mode" : "Dark mode";
}

try {
  setTheme(localStorage.getItem("stage-theme") === "dark");
} catch (error) {
  console.warn("Theme storage unavailable", error);
  setTheme(false);
}

get("theme").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  setTheme(dark);

  try {
    localStorage.setItem("stage-theme", dark ? "dark" : "light");
  } catch (error) {
    console.warn("Theme preference could not be saved", error);
  }
});

async function optionalModule(path) {
  const response = await fetch(path, { method: "HEAD" });

  if (response.status === 404) return null;

  if (!response.ok) throw new Error(`Module check returned ${response.status}`);

  return import(path);
}

async function wireDevice(name, id) {
  const status = get(`${name}-status`);
  const control = button(`start-${name}`);

  try {
    const module = await optionalModule(`./devices/${name}.js`);

    if (!module) {
      status.textContent =
        "Device module not installed yet. Manual input is available.";

      return;
    }

    module.mount?.(get(id));
    status.textContent = "Ready. Start this device when presenting.";
    control.disabled = false;
    let running = false;
    control.addEventListener("click", async () => {
      control.disabled = true;

      try {
        if (running) {
          await module.stop();
          running = false;
          status.textContent = "Device stopped.";
        } else {
          await module.start((envelope) => {
            if (envelope.from !== id)
              return Promise.reject(new Error("Device identity mismatch"));

            return postEvent(envelope);
          });
          running = true;
          status.textContent = "Device started.";
        }

        control.textContent = `${running ? "Stop" : "Start"} ${name === "mic" ? "microphone" : "camera"}`;
      } catch (error) {
        status.textContent = `Device could not start or stop: ${error.message}`;
      } finally {
        control.disabled = false;
      }
    });
    cleanups.push(() => module.stop());
  } catch (error) {
    status.textContent = `Device module unavailable: ${error.message}`;
  }
}

void wireDevice("camera", "camera-1");

void wireDevice("mic", "mic-1");

async function wireReveal() {
  try {
    const module = await optionalModule("./reveal/index.js");

    if (module) {
      get("reveal").replaceChildren();
      module.mount(get("reveal"), bus);
    }
  } catch (error) {
    get("reveal").textContent = `Event reveal unavailable: ${error.message}`;
  }
}

void wireReveal();

window.addEventListener("pagehide", () => {
  for (const cleanup of cleanups) cleanup();
  bus.close();
});
