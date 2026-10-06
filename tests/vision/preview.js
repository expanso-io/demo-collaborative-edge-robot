import { mount, start, stop } from "../../web/devices/camera.js";
import { recognize } from "../../web/devices/camera/recognizer.js";

const output = document.querySelector("#event");

const theme = document.querySelector("#theme");

function setTheme(value) {
  document.documentElement.dataset.theme = value;
  theme.textContent = value === "dark" ? "Light mode" : "Dark mode";
  localStorage.setItem("camera-check-theme", value);
}

setTheme(localStorage.getItem("camera-check-theme") || "light");

theme.addEventListener("click", () =>
  setTheme(
    document.documentElement.dataset.theme === "dark" ? "light" : "dark",
  ),
);

mount(document.querySelector("#camera"));

document.querySelector("#start").addEventListener("click", async () => {
  try {
    await start((envelope) => {
      output.textContent = JSON.stringify(envelope, null, 2);
    });
  } catch (error) {
    output.textContent = error.message;
  }
});

document.querySelector("#stop").addEventListener("click", stop);

window.addEventListener("pagehide", stop);

document.querySelector("#image").addEventListener("change", async (event) => {
  if (!(event.target instanceof HTMLInputElement)) return;

  const file = event.target.files[0];

  if (!file) return;
  const bitmap = await createImageBitmap(file);
  const canvas = document.querySelector("#fixture");

  if (!(canvas instanceof HTMLCanvasElement)) return;

  canvas.width = Math.min(1280, bitmap.width);
  canvas.height = Math.round((bitmap.height * canvas.width) / bitmap.width);
  canvas.hidden = false;
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const result = recognize(
    context.getImageData(0, 0, canvas.width, canvas.height),
  );

  document.querySelector("#image-result").textContent = JSON.stringify(result);
});
