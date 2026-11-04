import * as THREE from "three/webgpu";
import "./style.css";
import { PongWorld } from "./world.js";
import { PongGame } from "./game.js";
import { SoundEngine } from "./audio.js";

const ui = {
  scene: document.querySelector("#scene"),
  loading: document.querySelector("#loading-screen"),
  playButton: document.querySelector("#play-btn"),
  rendererBadge: document.querySelector("#renderer-badge"),
  rendererName: document.querySelector("#renderer-name"),
  buildBackend: document.querySelector("#build-backend"),
  errorOverlay: document.querySelector("#unsupported"),
  errorTitle: document.querySelector("#error-title"),
  errorMessage: document.querySelector("#error-message"),
  retryButton: document.querySelector("#retry-btn"),
};

const sound = new SoundEngine();
let previousFrame = performance.now();
let elapsedTime = 0;

let renderer = null;
let world = null;
let game = null;
let booted = false;
let loopFailures = 0;

ui.playButton.disabled = true;
ui.retryButton.addEventListener("click", () => window.location.reload());

function setBackendBadge(isWebGPU) {
  ui.rendererName.textContent = isWebGPU ? "WEBGPU" : "WEBGL 2";
  ui.buildBackend.textContent = isWebGPU ? "WEBGPU" : "WEBGL 2";
  ui.rendererBadge.classList.toggle("is-fallback", !isWebGPU);
  ui.rendererBadge.title = isWebGPU
    ? "Rendering through the WebGPU backend"
    : "WebGPU is unavailable — running on the WebGL 2 fallback";
}

function showFatal(error, force = false) {
  if (booted && !force) return;
  console.error(error);
  ui.loading.classList.add("done");
  ui.errorOverlay.classList.remove("hidden");
  ui.errorTitle.textContent = booted ? "RENDERER LOST" : "GPU OFFLINE";

  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message) {
    ui.errorMessage.textContent = `${message} Try reloading, or open this page in a browser with WebGPU enabled.`;
  }
}

function getRenderPixelRatio() {
  const base = Math.min(window.devicePixelRatio || 1, 1.6);
  const pixels = Math.max(1, window.innerWidth * window.innerHeight) * base * base;
  const budget = 8_500_000;
  return base * Math.min(1, Math.sqrt(budget / pixels));
}

async function boot() {
  const started = performance.now();

  try {
    renderer = new THREE.WebGPURenderer({
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(getRenderPixelRatio());
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.setAttribute("aria-label", "Neon Pong 3D arena");
    ui.scene.appendChild(renderer.domElement);

    await renderer.init();

    const isWebGPU = renderer.backend?.isWebGPUBackend === true;
    setBackendBadge(isWebGPU);

    world = new PongWorld(renderer);
    game = new PongGame(world, sound);

    world.fitCamera();
    world.update(0, 0, "menu");
    world.render();
    game.activate();

    const resize = () => {
      if (!renderer || !world) return;
      renderer.setPixelRatio(getRenderPixelRatio());
      renderer.setSize(window.innerWidth, window.innerHeight);
      world.resize();
    };

    window.addEventListener("resize", resize, { passive: true });
    window.visualViewport?.addEventListener("resize", resize, { passive: true });

    document.body.classList.add("ready");
    booted = true;

    renderer.setAnimationLoop(loop);

    if (!isWebGPU) {
      window.setTimeout(() => {
        game?.showToast("WEBGPU UNAVAILABLE / WEBGL 2 FALLBACK", "neutral", 3200);
      }, 900);
    }

    // Keep the loading state up long enough to read on fast machines, then
    // dissolve it into the arena.
    const minimumLoad = 520;
    const elapsed = performance.now() - started;
    await new Promise((resolve) => window.setTimeout(resolve, Math.max(0, minimumLoad - elapsed)));
    ui.loading.classList.add("done");
  } catch (error) {
    showFatal(error);
  }
}

function loop() {
  try {
    const now = performance.now();
    const frameTime = Math.min(0.1, Math.max(0, (now - previousFrame) / 1000));
    previousFrame = now;
    elapsedTime += frameTime;
    const dt = Math.min(frameTime, 1 / 30);
    const time = elapsedTime;

    world.update(dt, time, game.phase);
    game.update(dt, time);
    world.updateCamera(dt, time, game.phase);
    world.render();
    loopFailures = 0;
  } catch (error) {
    loopFailures += 1;
    console.error("Frame failed", error);
    if (loopFailures > 4) {
      renderer?.setAnimationLoop(null);
      showFatal(error, true);
    }
  }
}

window.addEventListener("error", (event) => {
  if (!booted) showFatal(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  if (!booted) showFatal(event.reason);
});

boot();
