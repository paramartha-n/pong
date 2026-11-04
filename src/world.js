import * as THREE from "three/webgpu";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const CONFIG = Object.freeze({
  winScore: 5,
  tableWidth: 26,
  tableDepth: 15.2,
  halfDepth: 7.6,
  playY: 0.42,
  ballRadius: 0.34,
  ballZLimit: 7.04,
  paddleX: 10.8,
  paddleHalfWidth: 0.19,
  paddleHalfDepth: 1.36,
  paddleZLimit: 5.48,
  goalX: 12.32,
  baseSpeed: 10.8,
  maxSpeed: 18.6,
  speedStep: 0.52,
  playerSpeed: 27,
  playerKeySpeed: 11,
  aiSpeed: 5.6,
  aiMaxSpeed: 6.8,
  pointPause: 1.05,
  colors: {
    cyan: 0x48f4ff,
    cyanSoft: 0xa5fbff,
    magenta: 0xff4fbe,
    magentaSoft: 0xffb0e4,
    violet: 0x7d6bff,
    white: 0xf4fbff,
  },
});

const LEFT_CONTACT = -CONFIG.paddleX + CONFIG.paddleHalfWidth + CONFIG.ballRadius;
const RIGHT_CONTACT = CONFIG.paddleX - CONFIG.paddleHalfWidth - CONFIG.ballRadius;
export const CONTACTS = Object.freeze({ left: LEFT_CONTACT, right: RIGHT_CONTACT });

/* ── Procedural textures ───────────────────────────────────────────── */

function createGlowTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  const half = size / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);

  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.08, "rgba(255,255,255,0.98)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.46)");
  gradient.addColorStop(0.48, "rgba(255,255,255,0.11)");
  gradient.addColorStop(0.74, "rgba(255,255,255,0.025)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createParticleTexture(size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  const half = size / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);

  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.3, "rgba(255,255,255,0.85)");
  gradient.addColorStop(0.65, "rgba(255,255,255,0.22)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createNebulaTexture(size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  const half = size / 2;
  const gradient = context.createRadialGradient(half, half * 0.92, 0, half, half, half);

  gradient.addColorStop(0, "rgba(196,213,255,0.72)");
  gradient.addColorStop(0.16, "rgba(123,151,255,0.42)");
  gradient.addColorStop(0.42, "rgba(77,81,195,0.16)");
  gradient.addColorStop(0.72, "rgba(80,36,135,0.045)");
  gradient.addColorStop(1, "rgba(10,10,30,0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTableTexture(renderer) {
  const width = 1024;
  const height = 600;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  context.fillStyle = "#061021";
  context.fillRect(0, 0, width, height);

  const centerLight = context.createRadialGradient(width * 0.5, height * 0.5, 12, width * 0.5, height * 0.5, width * 0.64);
  centerLight.addColorStop(0, "rgba(34,80,128,0.16)");
  centerLight.addColorStop(0.45, "rgba(10,30,66,0.08)");
  centerLight.addColorStop(1, "rgba(1,5,14,0.45)");
  context.fillStyle = centerLight;
  context.fillRect(0, 0, width, height);

  const cyanGlow = context.createRadialGradient(0, height * 0.5, 0, 0, height * 0.5, width * 0.33);
  cyanGlow.addColorStop(0, "rgba(31,203,235,0.16)");
  cyanGlow.addColorStop(0.5, "rgba(20,108,173,0.055)");
  cyanGlow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = cyanGlow;
  context.fillRect(0, 0, width * 0.45, height);

  const magentaGlow = context.createRadialGradient(width, height * 0.5, 0, width, height * 0.5, width * 0.33);
  magentaGlow.addColorStop(0, "rgba(232,49,171,0.13)");
  magentaGlow.addColorStop(0.5, "rgba(132,30,117,0.045)");
  magentaGlow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = magentaGlow;
  context.fillRect(width * 0.55, 0, width * 0.45, height);

  const cell = 32;
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += cell) {
    context.strokeStyle = x % 160 === 0 ? "rgba(92,145,219,0.095)" : "rgba(73,117,177,0.045)";
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
    context.stroke();
  }
  for (let y = 0; y <= height; y += cell) {
    context.strokeStyle = y % 160 === 0 ? "rgba(92,145,219,0.095)" : "rgba(73,117,177,0.045)";
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
  }

  // A faint scan shimmer gives the surface depth under the moving lights.
  for (let y = 0; y < height; y += 4) {
    context.fillStyle = "rgba(137,200,255,0.013)";
    context.fillRect(0, y, width, 1);
  }

  // Inner border lines, just inside the neon rails.
  context.strokeStyle = "rgba(107,168,255,0.18)";
  context.lineWidth = 2;
  context.strokeRect(13, 13, width - 26, height - 26);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.getMaxAnisotropy?.() ?? 4);
  return texture;
}

/* ── Small helpers ─────────────────────────────────────────────────── */

function makeGlowSprite(texture, color, opacity = 0.3) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 3;
  return sprite;
}

function makeFloorGlow(texture, color, size = 3) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}

function neonMaterial(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: opacity >= 1,
    toneMapped: false,
  });
}

function addPointUvs(geometry, count) {
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * 2), 2));
}

/* ── Particle system ───────────────────────────────────────────────── */

class ParticleSystem {
  constructor(scene, texture, maximum = 240) {
    this.maximum = maximum;
    this.cursor = 0;
    this.positions = new Float32Array(maximum * 3);
    this.colors = new Float32Array(maximum * 3);
    this.velocities = new Float32Array(maximum * 3);
    this.baseColors = new Float32Array(maximum * 3);
    this.life = new Float32Array(maximum);
    this.maxLife = new Float32Array(maximum);

    for (let i = 0; i < maximum; i += 1) {
      this.positions[i * 3 + 1] = -100;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    addPointUvs(geometry, maximum);

    const material = new THREE.PointsMaterial({
      map: texture,
      size: 0.16,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
      alphaTest: 0.01,
      toneMapped: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);
  }

  spawn(x, y, z, color, count = 12, power = 1) {
    const rgb = new THREE.Color(color);
    for (let i = 0; i < count; i += 1) {
      const index = this.cursor;
      this.cursor = (this.cursor + 1) % this.maximum;
      const offset = index * 3;
      const angle = Math.random() * Math.PI * 2;
      const horizontal = (0.7 + Math.random() * 2.5) * power;
      const vertical = (1.2 + Math.random() * 3.4) * power;

      this.positions[offset] = x + (Math.random() - 0.5) * 0.3;
      this.positions[offset + 1] = y + (Math.random() - 0.5) * 0.2;
      this.positions[offset + 2] = z + (Math.random() - 0.5) * 0.3;

      this.velocities[offset] = Math.cos(angle) * horizontal;
      this.velocities[offset + 1] = vertical;
      this.velocities[offset + 2] = Math.sin(angle) * horizontal;

      const brightness = 0.7 + Math.random() * 0.6;
      const r = rgb.r * brightness;
      const g = rgb.g * brightness;
      const b = rgb.b * brightness;
      this.baseColors[offset] = r;
      this.baseColors[offset + 1] = g;
      this.baseColors[offset + 2] = b;
      this.colors[offset] = r;
      this.colors[offset + 1] = g;
      this.colors[offset + 2] = b;

      this.life[index] = 0.45 + Math.random() * 0.55;
      this.maxLife[index] = this.life[index];
    }

    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  update(dt) {
    let changed = false;

    for (let i = 0; i < this.maximum; i += 1) {
      if (this.life[i] <= 0) continue;
      changed = true;
      const offset = i * 3;

      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[offset + 1] = -100;
        this.colors[offset] = 0;
        this.colors[offset + 1] = 0;
        this.colors[offset + 2] = 0;
        continue;
      }

      this.velocities[offset + 1] -= 7.5 * dt;
      this.velocities[offset] *= 1 - 0.9 * dt;
      this.velocities[offset + 2] *= 1 - 0.9 * dt;

      this.positions[offset] += this.velocities[offset] * dt;
      this.positions[offset + 1] += this.velocities[offset + 1] * dt;
      this.positions[offset + 2] += this.velocities[offset + 2] * dt;

      if (this.positions[offset + 1] < 0.05) {
        this.positions[offset + 1] = 0.05;
        this.velocities[offset + 1] *= -0.38;
      }

      const fade = Math.max(0, this.life[i] / this.maxLife[i]) ** 1.35;
      this.colors[offset] = this.baseColors[offset] * fade;
      this.colors[offset + 1] = this.baseColors[offset + 1] * fade;
      this.colors[offset + 2] = this.baseColors[offset + 2] * fade;
    }

    if (changed) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
  }
}

/* ── Impact rings ──────────────────────────────────────────────────── */

class ImpactRings {
  constructor(scene, count = 10) {
    this.rings = [];
    const geometry = new THREE.RingGeometry(0.44, 0.5, 64);

    for (let i = 0; i < count; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 3;
      mesh.userData.life = 0;
      scene.add(mesh);
      this.rings.push(mesh);
    }
  }

  spawn(x, z, color, scale = 1) {
    const ring = this.rings.find((candidate) => candidate.userData.life <= 0) ?? this.rings[0];
    ring.visible = true;
    ring.position.set(x, 0.085, z);
    ring.userData.startScale = 0.3 * scale;
    ring.scale.setScalar(ring.userData.startScale);
    ring.material.color.set(color);
    ring.material.opacity = 0.6;
    ring.userData.life = 0.5;
    ring.userData.maxLife = 0.5;
    ring.userData.growth = 2.15 * scale;
  }

  update(dt) {
    for (const ring of this.rings) {
      if (ring.userData.life <= 0) continue;
      ring.userData.life -= dt;
      if (ring.userData.life <= 0) {
        ring.visible = false;
        continue;
      }
      const progress = 1 - ring.userData.life / ring.userData.maxLife;
      ring.scale.setScalar(ring.userData.startScale + progress * ring.userData.growth);
      ring.material.opacity = (1 - progress) * 0.5;
    }
  }
}

/* ── World ─────────────────────────────────────────────────────────── */

export class PongWorld {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03050c);
    this.scene.fog = new THREE.FogExp2(0x03050c, 0.0135);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 240);
    this.cameraBase = new THREE.Vector3();
    this.cameraLook = new THREE.Vector3();
    this.shake = 0;
    this.elapsed = 0;
    this.pipeline = null;
    this.renderFailed = false;

    this.glowTexture = createGlowTexture();
    this.particleTexture = createParticleTexture();
    this.nebulaTexture = createNebulaTexture();
    this.tableTexture = createTableTexture(renderer);

    this.goalFlashes = { left: 0, right: 0 };
    this.paddles = {};
    this.starLayers = [];
    this._cameraCorners = [
      new THREE.Vector3(-13.4, 0.1, -8.0),
      new THREE.Vector3(13.4, 0.1, -8.0),
      new THREE.Vector3(-13.4, 0.1, 8.0),
      new THREE.Vector3(13.4, 0.1, 8.0),
    ];
    this._projected = new THREE.Vector3();

    this.build();
  }

  build() {
    this.buildEnvironment();
    this.buildTable();
    this.buildCenterDetails();
    this.buildGoalEffects();
    this.buildPaddles();
    this.buildBall();
    this.buildEffects();
    this.setupPipeline();
    this.fitCamera();
  }

  buildEnvironment() {
    const { scene } = this;

    const hemisphere = new THREE.HemisphereLight(0x84adff, 0x03020a, 1.35);
    scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xc7e2ff, 3.2);
    key.position.set(2, 17, 13);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x8d67ff, 1.7);
    fill.position.set(-15, 7, -9);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xff5ac5, 0.8);
    rim.position.set(15, 4, -7);
    scene.add(rim);

    const leftGlow = new THREE.PointLight(0x27eaff, 9, 24, 2);
    leftGlow.position.set(-14, 4.5, 0);
    scene.add(leftGlow);

    const rightGlow = new THREE.PointLight(0xff3ab8, 8, 24, 2);
    rightGlow.position.set(14, 4.5, 0);
    scene.add(rightGlow);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({
        color: 0x040711,
        roughness: 0.82,
        metalness: 0.34,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.15;
    scene.add(floor);

    const floorGrid = new THREE.GridHelper(130, 72, 0x1e3762, 0x0a1427);
    floorGrid.position.y = -1.12;
    floorGrid.material.transparent = true;
    floorGrid.material.opacity = 0.22;
    floorGrid.material.depthWrite = false;
    scene.add(floorGrid);

    const halo = makeGlowSprite(this.nebulaTexture, 0x7f83e8, 0.5);
    halo.position.set(0, 6, -42);
    halo.scale.set(92, 54, 1);
    halo.material.depthTest = false;
    halo.renderOrder = -10;
    scene.add(halo);

    const haloWarm = makeGlowSprite(this.nebulaTexture, 0xc84bb4, 0.17);
    haloWarm.position.set(31, -1, -38);
    haloWarm.scale.set(62, 40, 1);
    haloWarm.material.depthTest = false;
    haloWarm.renderOrder = -9;
    scene.add(haloWarm);

    this.halo = halo;
    this.haloWarm = haloWarm;

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(760 * 3);
    for (let i = 0; i < 760; i += 1) {
      const radius = 30 + Math.random() * 65;
      const angle = Math.random() * Math.PI * 2;
      starPositions[i * 3] = Math.cos(angle) * radius;
      starPositions[i * 3 + 1] = 1 + Math.random() * 35;
      starPositions[i * 3 + 2] = Math.sin(angle) * radius - 18;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    addPointUvs(starGeometry, 760);

    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0x91b1ff,
        size: 0.12,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    stars.frustumCulled = false;
    scene.add(stars);
    this.stars = stars;

    const nearStarGeometry = new THREE.BufferGeometry();
    const nearStarPositions = new Float32Array(170 * 3);
    for (let i = 0; i < 170; i += 1) {
      nearStarPositions[i * 3] = (Math.random() - 0.5) * 70;
      nearStarPositions[i * 3 + 1] = 2 + Math.random() * 26;
      nearStarPositions[i * 3 + 2] = -8 + Math.random() * 46;
    }
    nearStarGeometry.setAttribute("position", new THREE.BufferAttribute(nearStarPositions, 3));
    addPointUvs(nearStarGeometry, 170);

    const nearStars = new THREE.Points(
      nearStarGeometry,
      new THREE.PointsMaterial({
        color: 0xd8c9ff,
        size: 0.19,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    nearStars.frustumCulled = false;
    scene.add(nearStars);
    this.starLayers.push(stars, nearStars);
  }

  buildTable() {
    const { scene } = this;

    const slabMaterial = new THREE.MeshStandardMaterial({
      color: 0x061020,
      metalness: 0.78,
      roughness: 0.26,
    });
    const slab = new THREE.Mesh(new RoundedBoxGeometry(26.55, 0.5, 15.75, 3, 0.16), slabMaterial);
    slab.position.y = -0.28;
    scene.add(slab);

    const surfaceMaterial = new THREE.MeshStandardMaterial({
      map: this.tableTexture,
      color: 0xffffff,
      metalness: 0.56,
      roughness: 0.24,
      emissive: 0x071529,
      emissiveIntensity: 0.28,
    });
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(26, 15.2), surfaceMaterial);
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 0.006;
    scene.add(surface);

    // Fine, real-time grid over the texture. It catches the light from the paddles.
    const grid = new THREE.GridHelper(25.9, 52, 0x2c4e83, 0x162747);
    grid.position.y = 0.018;
    grid.material.transparent = true;
    grid.material.opacity = 0.3;
    grid.material.depthWrite = false;
    scene.add(grid);

    const railGroup = new THREE.Group();
    const railY = 0.14;
    const railZ = CONFIG.halfDepth - 0.06;
    const halfWidth = CONFIG.tableWidth / 2;

    // Long side rails are split at the centre: cyan on the player's half,
    // magenta on the CPU's half.
    for (const z of [-railZ, railZ]) {
      const leftRail = new THREE.Mesh(new THREE.BoxGeometry(halfWidth - 0.1, 0.055, 0.055), neonMaterial(CONFIG.colors.cyan));
      leftRail.position.set(-halfWidth / 2, railY, z);
      railGroup.add(leftRail);

      const rightRail = new THREE.Mesh(new THREE.BoxGeometry(halfWidth - 0.1, 0.055, 0.055), neonMaterial(CONFIG.colors.magenta));
      rightRail.position.set(halfWidth / 2, railY, z);
      railGroup.add(rightRail);
    }

    // Goal rails glow with the defending side's colour.
    for (const [x, color] of [
      [-halfWidth - 0.03, CONFIG.colors.cyan],
      [halfWidth + 0.03, CONFIG.colors.magenta],
    ]) {
      const goalRail = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, CONFIG.tableDepth + 0.3), neonMaterial(color));
      goalRail.position.set(x, railY + 0.02, 0);
      railGroup.add(goalRail);
    }

    // A low under-rim gives the table a machined, floating silhouette.
    const rim = new THREE.Mesh(
      new RoundedBoxGeometry(26.8, 0.08, 16.0, 2, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x152747, metalness: 0.9, roughness: 0.2 }),
    );
    rim.position.y = -0.56;
    railGroup.add(rim);

    // Corner pylons frame the field and add a little vertical parallax.
    for (const x of [-13.02, 13.02]) {
      for (const z of [-7.58, 7.58]) {
        const pylon = new THREE.Mesh(
          new THREE.BoxGeometry(0.085, 2.5, 0.085),
          new THREE.MeshStandardMaterial({
            color: 0x0a1730,
            metalness: 0.86,
            roughness: 0.24,
            emissive: x < 0 ? 0x08252d : 0x240a20,
            emissiveIntensity: 0.8,
          }),
        );
        pylon.position.set(x, 1.24, z);
        railGroup.add(pylon);

        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.09, 0.15),
          neonMaterial(x < 0 ? CONFIG.colors.cyan : CONFIG.colors.magenta),
        );
        cap.position.set(x, 2.51, z);
        railGroup.add(cap);
      }
    }

    scene.add(railGroup);
    this.railGroup = railGroup;

    const goalPlaneMaterialLeft = new THREE.MeshBasicMaterial({
      color: CONFIG.colors.cyan,
      transparent: true,
      opacity: 0.022,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const goalPlaneMaterialRight = goalPlaneMaterialLeft.clone();
    goalPlaneMaterialRight.color.set(CONFIG.colors.magenta);

    const goalPlaneLeft = new THREE.Mesh(new THREE.PlaneGeometry(15.1, 2.3), goalPlaneMaterialLeft);
    goalPlaneLeft.rotation.y = Math.PI / 2;
    goalPlaneLeft.position.set(-13.01, 1.14, 0);
    scene.add(goalPlaneLeft);

    const goalPlaneRight = new THREE.Mesh(new THREE.PlaneGeometry(15.1, 2.3), goalPlaneMaterialRight);
    goalPlaneRight.rotation.y = Math.PI / 2;
    goalPlaneRight.position.set(13.01, 1.14, 0);
    scene.add(goalPlaneRight);

    this.goalPlanes = { left: goalPlaneLeft, right: goalPlaneRight };
  }

  buildCenterDetails() {
    const { scene } = this;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.92, 1.985, 80),
      new THREE.MeshBasicMaterial({
        color: 0x3f74ac,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.045;
    scene.add(ring);
    this.centerRing = ring;

    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.325, 48),
      new THREE.MeshBasicMaterial({
        color: 0x5b99d6,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.048;
    scene.add(innerRing);

    const dashMaterial = new THREE.MeshBasicMaterial({
      color: 0x2d5f94,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    const dashGeometry = new THREE.BoxGeometry(0.075, 0.012, 0.58);
    for (let z = -6.1; z <= 6.1; z += 1.22) {
      if (Math.abs(z) < 2.25) continue;
      const dash = new THREE.Mesh(dashGeometry, dashMaterial);
      dash.position.set(0, 0.052, z);
      scene.add(dash);
    }

    const centerGlow = makeFloorGlow(this.glowTexture, 0x2e6a9d, 5.2);
    centerGlow.material.opacity = 0.17;
    centerGlow.position.y = 0.03;
    scene.add(centerGlow);
    this.centerGlow = centerGlow;
  }

  buildGoalEffects() {
    const leftGlowMaterial = new THREE.MeshBasicMaterial({
      color: CONFIG.colors.cyan,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const rightGlowMaterial = leftGlowMaterial.clone();
    rightGlowMaterial.color.set(CONFIG.colors.magenta);

    const leftGlow = new THREE.Mesh(new THREE.PlaneGeometry(15, 3.4), leftGlowMaterial);
    leftGlow.rotation.y = Math.PI / 2;
    leftGlow.position.set(-12.96, 1.7, 0);
    leftGlow.renderOrder = 3;
    this.scene.add(leftGlow);

    const rightGlow = new THREE.Mesh(new THREE.PlaneGeometry(15, 3.4), rightGlowMaterial);
    rightGlow.rotation.y = Math.PI / 2;
    rightGlow.position.set(12.96, 1.7, 0);
    rightGlow.renderOrder = 3;
    this.scene.add(rightGlow);

    const leftLight = new THREE.PointLight(0x39efff, 0, 11, 2);
    leftLight.position.set(-12.6, 1.7, 0);
    this.scene.add(leftLight);

    const rightLight = new THREE.PointLight(0xff45c4, 0, 11, 2);
    rightLight.position.set(12.6, 1.7, 0);
    this.scene.add(rightLight);

    this.goalGlow = { left: leftGlow, right: rightGlow };
    this.goalLight = { left: leftLight, right: rightLight };
  }

  buildPaddles() {
    this.paddles.player = this.createPaddle(-CONFIG.paddleX, CONFIG.colors.cyan, -1);
    this.paddles.cpu = this.createPaddle(CONFIG.paddleX, CONFIG.colors.magenta, 1);
  }

  createPaddle(x, color, side) {
    const group = new THREE.Group();
    group.position.set(x, 0, 0);

    const bodyGeometry = new RoundedBoxGeometry(0.34, 1.7, 2.62, 4, 0.13);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x07152a,
      metalness: 0.62,
      roughness: 0.2,
      emissive: color,
      emissiveIntensity: 0.22,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.9;
    group.add(body);

    const inner = -side * 0.178;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.38, 2.34), neonMaterial(color, 0.95));
    blade.position.set(inner, 0.9, 0);
    group.add(blade);

    const hotCore = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.85, 0.17),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    );
    hotCore.position.set(inner - side * 0.003, 0.9, 0);
    group.add(hotCore);

    const halo = makeGlowSprite(this.glowTexture, color, 0.2);
    halo.position.set(0, 0.9, 0);
    halo.scale.set(3.8, 4.6, 1);
    group.add(halo);

    const floorGlow = makeFloorGlow(this.glowTexture, color, 4.3);
    floorGlow.position.y = 0.035;
    floorGlow.material.opacity = 0.33;
    group.add(floorGlow);

    const baseRing = new THREE.Mesh(
      new THREE.RingGeometry(1.02, 1.08, 56),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.y = 0.04;
    group.add(baseRing);

    const light = new THREE.PointLight(color, 16, 7, 2);
    light.position.set(0, 1.45, 0);
    group.add(light);

    const object = { group, body, halo, floorGlow, baseRing, light, z: 0, velocity: 0 };
    this.scene.add(group);
    return object;
  }

  buildBall() {
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(CONFIG.ballRadius, 32, 22),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xc9ffff,
        emissiveIntensity: 3.2,
        metalness: 0.18,
        roughness: 0.12,
      }),
    );
    core.position.y = CONFIG.playY;
    group.add(core);

    const halo = makeGlowSprite(this.glowTexture, 0x93f7ff, 0.78);
    halo.position.y = CONFIG.playY;
    halo.scale.set(2.7, 2.7, 1);
    group.add(halo);

    const floorGlow = makeFloorGlow(this.glowTexture, 0x68e9ff, 2.8);
    floorGlow.position.y = 0.036;
    group.add(floorGlow);

    const light = new THREE.PointLight(0x9cfbff, 13, 7.5, 2);
    light.position.y = CONFIG.playY + 0.3;
    group.add(light);

    this.scene.add(group);

    const trailGroup = new THREE.Group();
    const trailGeometry = new THREE.SphereGeometry(CONFIG.ballRadius, 14, 10);
    const trail = [];
    for (let i = 0; i < 14; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: i < 4 ? 0xc5ffff : 0x58dfff,
        transparent: true,
        opacity: 0.24 * (1 - i / 16),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const ghost = new THREE.Mesh(trailGeometry, material);
      ghost.position.y = CONFIG.playY;
      ghost.visible = false;
      trailGroup.add(ghost);
      trail.push(ghost);
    }
    this.scene.add(trailGroup);

    this.ball = {
      group,
      core,
      halo,
      floorGlow,
      light,
      trail,
      trailGroup,
      history: Array.from({ length: 14 }, () => new THREE.Vector3(0, CONFIG.playY, 0)),
      visible: true,
    };
  }

  buildEffects() {
    this.particles = new ParticleSystem(this.scene, this.particleTexture);
    this.rings = new ImpactRings(this.scene);
  }

  setupPipeline() {
    try {
      const scenePass = pass(this.scene, this.camera);
      const sceneColor = scenePass.getTextureNode();
      const bloomPass = bloom(sceneColor, 0.52, 0.34, 0.7);
      this.pipeline = new THREE.RenderPipeline(this.renderer);
      this.pipeline.outputNode = sceneColor.add(bloomPass);
    } catch (error) {
      console.warn("Post-processing unavailable; using direct render.", error);
      this.pipeline = null;
    }
  }

  fitCamera() {
    const width = this.renderer.domElement.width || window.innerWidth;
    const height = this.renderer.domElement.height || window.innerHeight;
    const aspect = Math.max(0.4, width / Math.max(1, height));

    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.9 ? 45 : 42;
    this.camera.updateProjectionMatrix();

    const direction = new THREE.Vector3(0, 0.69, 0.73).normalize();
    const look = new THREE.Vector3(0, 0.14, 0);
    const xLimit = aspect < 0.7 ? 1.12 : aspect < 0.95 ? 1.0 : 0.92;
    const yLimit = 0.665;
    let distance = 22.5;

    for (let iteration = 0; iteration < 16; iteration += 1) {
      this.camera.position.copy(direction).multiplyScalar(distance).add(look);
      this.camera.lookAt(look);
      this.camera.updateMatrixWorld(true);

      let maxX = 0;
      let maxY = 0;
      for (const corner of this._cameraCorners) {
        this._projected.copy(corner).project(this.camera);
        maxX = Math.max(maxX, Math.abs(this._projected.x));
        maxY = Math.max(maxY, Math.abs(this._projected.y));
      }

      const correction = Math.max(maxX / xLimit, maxY / yLimit);
      if (Math.abs(correction - 1) < 0.004) break;
      distance *= correction;
    }

    this.cameraBase.copy(this.camera.position);
    this.cameraLook.copy(look);
    this.camera.lookAt(this.cameraLook);
  }

  resize() {
    this.fitCamera();
  }

  setBallVisible(visible) {
    const { ball } = this;
    ball.visible = visible;
    ball.core.visible = visible;
    ball.halo.visible = visible;
    ball.floorGlow.visible = visible;
    ball.light.intensity = visible ? 13 : 0;
    ball.trailGroup.visible = visible && this.trailVisible;
  }

  resetBall() {
    const { ball } = this;
    ball.group.position.set(0, 0, 0);
    ball.core.position.y = CONFIG.playY;
    ball.visible = true;
    this.setBallVisible(true);
    this.trailVisible = false;
    ball.trailGroup.visible = false;
    ball.history.forEach((point) => point.set(0, CONFIG.playY, 0));
    ball.trail.forEach((ghost, index) => {
      ghost.position.set(0, CONFIG.playY, index * 0.03);
      ghost.visible = false;
    });
  }

  setTrailVisible(visible) {
    this.trailVisible = visible;
    if (this.ball) this.ball.trailGroup.visible = visible;
  }

  syncPaddles(playerZ, cpuZ) {
    this.paddles.player.group.position.z = playerZ;
    this.paddles.cpu.group.position.z = cpuZ;
    this.paddles.player.z = playerZ;
    this.paddles.cpu.z = cpuZ;
  }

  updateTrail(x, z) {
    const { ball } = this;
    if (!this.trailVisible) return;

    for (let i = ball.history.length - 1; i > 0; i -= 1) {
      ball.history[i].copy(ball.history[i - 1]);
    }
    ball.history[0].set(x, CONFIG.playY, z);

    ball.trail.forEach((ghost, index) => {
      ghost.visible = true;
      ghost.position.copy(ball.history[index]);
      const fade = 1 - index / ball.trail.length;
      ghost.material.opacity = 0.24 * fade * fade;
      ghost.scale.setScalar(1 - index * 0.035);
    });
  }

  hitEffect(x, z, color, power = 1) {
    this.particles.spawn(x, CONFIG.playY, z, color, 10 + Math.round(power * 6), 0.8 + power * 0.35);
    this.rings.spawn(x, z, color, 1);
    this.addShake(0.08 + power * 0.045);
  }

  wallEffect(z, color = CONFIG.colors.cyan) {
    const x = this.ball.group.position.x;
    this.particles.spawn(x, CONFIG.playY, z, color, 5, 0.55);
  }

  scoreEffect(side) {
    const left = side === "left";
    this.goalFlashes[left ? "left" : "right"] = 1;
    const color = left ? CONFIG.colors.cyan : CONFIG.colors.magenta;
    const x = left ? -12.1 : 12.1;
    this.particles.spawn(x, 0.7, this.ball.group.position.z, color, 48, 1.8);
    this.rings.spawn(x, this.ball.group.position.z, color, 1.6);
    this.addShake(0.6);
    this.setTrailVisible(false);
    this.setBallVisible(false);
  }

  addShake(amount) {
    this.shake = Math.min(1, this.shake + amount);
  }

  updateCamera(dt, time, phase) {
    this.shake = Math.max(0, this.shake - dt * 1.75);
    const menu = phase === "menu";
    const breathe = menu ? 1 : 0.22;
    const xDrift = Math.sin(time * 0.25) * 0.22 * breathe;
    const yDrift = Math.sin(time * 0.21 + 1.3) * 0.12 * breathe;
    const zDrift = Math.cos(time * 0.19) * 0.17 * breathe;
    const intensity = this.shake * this.shake;
    const shakeX = intensity * Math.sin(time * 77) * 0.22;
    const shakeY = intensity * Math.cos(time * 61) * 0.16;

    this.camera.position.set(
      this.cameraBase.x + xDrift + shakeX,
      this.cameraBase.y + yDrift + shakeY,
      this.cameraBase.z + zDrift,
    );
    this.camera.lookAt(
      this.cameraLook.x + Math.sin(time * 0.34) * 0.03 * breathe + shakeX * 0.4,
      this.cameraLook.y + Math.cos(time * 0.28) * 0.025 * breathe + shakeY * 0.4,
      this.cameraLook.z,
    );
    this.camera.updateMatrixWorld();
  }

  update(dt, time, phase) {
    this.elapsed = time;

    if (this.stars) this.stars.rotation.y += dt * 0.004;
    if (this.starLayers[1]) this.starLayers[1].rotation.y -= dt * 0.002;
    if (this.halo) this.halo.material.opacity = 0.46 + Math.sin(time * 0.33) * 0.035;
    if (this.centerRing) this.centerRing.rotation.z += dt * 0.09;
    if (this.centerGlow) this.centerGlow.material.opacity = 0.15 + Math.sin(time * 1.1) * 0.02;

    const player = this.paddles.player;
    const cpu = this.paddles.cpu;
    player.halo.material.opacity = 0.19 + Math.sin(time * 2.4) * 0.03;
    cpu.halo.material.opacity = 0.19 + Math.sin(time * 2.1 + 1.8) * 0.03;
    player.floorGlow.material.opacity = 0.31 + Math.sin(time * 1.8) * 0.035;
    cpu.floorGlow.material.opacity = 0.31 + Math.sin(time * 1.7 + 2.2) * 0.035;

    if (this.ball.visible) {
      const pace = phase === "playing" ? 1 : 0.45;
      this.ball.core.scale.setScalar(1 + Math.sin(time * 12) * 0.012 * pace);
      this.ball.halo.material.opacity = 0.7 + Math.sin(time * 3.1) * 0.05;
    }

    for (const side of ["left", "right"]) {
      const flash = this.goalFlashes[side];
      if (flash > 0) {
        this.goalFlashes[side] = Math.max(0, flash - dt * 1.9);
        this.goalGlow[side].material.opacity = this.goalFlashes[side] * 0.22;
        this.goalLight[side].intensity = this.goalFlashes[side] * 38;
      } else {
        this.goalGlow[side].material.opacity = 0;
        this.goalLight[side].intensity = 0;
      }
    }

    this.particles.update(dt);
    this.rings.update(dt);
  }

  render() {
    if (this.renderFailed) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    try {
      if (this.pipeline) {
        this.pipeline.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    } catch (error) {
      console.warn("Render pipeline failed; falling back to direct rendering.", error);
      this.pipeline = null;
      this.renderFailed = true;
      this.renderer.render(this.scene, this.camera);
    }
  }
}
