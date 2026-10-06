import * as camera from "../../web/devices/camera.js";

/** Run on the standalone page in an isolated browser; never asks for a webcam. */
export async function runBrowserCheck() {
  const checks = [];

  const assert = (condition, name) => {
    if (!condition) throw new Error(name);
    checks.push(name);
  };

  const original = navigator.mediaDevices.getUserMedia;
  const tracks = [];

  try {
    const bytes = new Uint8Array(
      await (await fetch("./card-1-clear.ppm")).arrayBuffer(),
    );

    const header = new TextDecoder()
      .decode(bytes.slice(0, 64))
      .match(/^P6\n(\d+) (\d+)\n255\n/);

    const canvas = document.createElement("canvas");
    canvas.width = Number(header[1]);
    canvas.height = Number(header[2]);
    const pixels = new ImageData(canvas.width, canvas.height);

    for (let i = 0; i < canvas.width * canvas.height; i++) {
      pixels.data.set(
        bytes.slice(header[0].length + i * 3, header[0].length + i * 3 + 3),
        i * 4,
      );
      pixels.data[i * 4 + 3] = 255;
    }

    canvas.getContext("2d").putImageData(pixels, 0, 0);
    const stream = canvas.captureStream(4);
    tracks.push(...stream.getTracks());
    /** @type {MediaStreamConstraints} */
    let requested = { audio: true };
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      requested = constraints;

      return stream;
    };

    const events = [];
    await camera.start((event) => events.push(event));
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert(requested.audio === false, "camera does not request audio");
    assert(
      events.length === 1 &&
        events[0].body.value === 1 &&
        events[0].body.confidence >= 0.8,
      "video frame produces one confident card envelope",
    );
    assert(
      events[0].raw_bytes === 640 * 480 * 3,
      "raw byte count uses source frame",
    );
    camera.stop();
    assert(
      stream.getTracks().every((track) => track.readyState === "ended"),
      "stop releases media tracks",
    );
    const preview = document.querySelector("#camera canvas");

    if (!(preview instanceof HTMLCanvasElement))
      throw new Error("Preview canvas missing");
    assert(
      preview
        .getContext("2d")
        .getImageData(0, 0, preview.width, preview.height)
        .data.every((value) => value === 0),
      "stop clears preview pixels",
    );
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Permission denied", "NotAllowedError");
    };

    let denied = false;

    try {
      await camera.start(() => {});
    } catch (error) {
      denied = error.name === "NotAllowedError";
    }

    assert(
      denied &&
        document
          .querySelector("#camera [role=status]")
          .textContent.includes("Permission denied"),
      "permission failure rejects and explains",
    );

    /** @type {(stream: MediaStream) => void} */
    let resolveMedia = () => {
      throw new Error("No media request pending");
    };

    navigator.mediaDevices.getUserMedia = () =>
      new Promise((resolve) => {
        resolveMedia = resolve;
      });

    const pending = camera.start(() => {
      throw new Error("Stale emission");
    });

    camera.stop();
    const late = canvas.captureStream(4);
    tracks.push(...late.getTracks());
    resolveMedia(late);
    await pending;
    assert(
      late.getTracks().every((track) => track.readyState === "ended"),
      "stop while permission pending releases late stream",
    );

    return checks;
  } finally {
    camera.stop();
    tracks.forEach((track) => track.stop());
    navigator.mediaDevices.getUserMedia = original;
  }
}
