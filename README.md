# NEON PONG

A small, glossy 3D Pong game built with **three.js** and the **WebGPU** renderer. First to five; the ball speeds up on every exchange and the CPU's read on your shots gets less reliable as the rally stretches.

![WebGPU](https://img.shields.io/badge/renderer-WebGPU-48f4ff) ![three.js](https://img.shields.io/badge/three.js-r187-7d6bff) ![Vite](https://img.shields.io/badge/Vite-8-ff4fbe)

## Play

```bash
npm install
npm run dev
```

Open the local URL that Vite prints. WebGPU needs a secure context, so use `localhost` / `127.0.0.1` during development (or HTTPS when deployed).

If the browser cannot create a WebGPU device, the game automatically falls back to the WebGL 2 backend of `WebGPURenderer` and shows a `WEBGL 2` badge. The game stays fully playable.

### Controls

| Input | Action |
| --- | --- |
| Mouse / touch drag | Move the left paddle |
| `W` / `S` or `↑` / `↓` | Move the left paddle |
| `Space` | Start a match or serve early |
| `P` / `Esc` | Pause / resume |
| `M` | Mute / unmute |
| `Enter` | Start or rematch |
| HUD pause button | Pause / resume on touch devices |

## What's inside

- `THREE.WebGPURenderer` with an async device init and automatic WebGL 2 fallback.
- TSL bloom post-processing through `RenderPipeline`, plus ACES tone mapping.
- A 3D arena with emissive paddles, goal pylons, a scrolling starfield, contact glow, a ball trail, particles, and impact rings.
- Fixed-timestep-safe continuous paddle collision (the ball cannot tunnel through at high speed).
- Mouse-to-world raycasting, so the paddle tracks where you point on the actual table.
- An AI that predicts wall bounces but misreads sharp shots, giving skilled returns a way through.
- Procedural Web Audio sound effects — no audio files.
- Responsive camera framing for desktop, portrait, and short landscape / phone screens.
- Scores, match point, pause, and rematch flows with keyboard and touch support.

## Scripts

```bash
npm run dev      # start Vite
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## Project structure

```
index.html          UI shell, panels, HUD
src/main.js         renderer boot, resize, render loop
src/world.js        scene, arena, materials, effects, camera fitting
src/game.js         input, state machine, physics, AI, UI wiring
src/audio.js        procedural Web Audio effects
src/style.css       typography, layout, transitions, responsive rules
public/fonts/       bundled Chakra Petch + Space Grotesk (SIL OFL 1.1)
```

## Credits

Typefaces are bundled locally and licensed under the SIL Open Font License 1.1:

- **Chakra Petch** — Cadson Demak
- **Space Grotesk** — Florian Karsten

See the `public/fonts/OFL-*.txt` files for the full license text.
