import { Plane, Raycaster, Vector2, Vector3, MathUtils } from "three/webgpu";
import { CONFIG, CONTACTS } from "./world.js";

const clamp = MathUtils.clamp;

function moveToward(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

function foldZ(value, limit) {
  const period = limit * 4;
  let folded = ((value + limit) % period + period) % period;
  if (folded > limit * 2) folded = period - folded;
  return folded - limit;
}

export class PongGame {
  constructor(world, sound) {
    this.world = world;
    this.sound = sound;
    this.ready = false;
    this.phase = "boot";
    this.phaseBeforePause = "playing";
    this.isTouch = window.matchMedia
      ? window.matchMedia("(pointer: coarse)").matches
      : navigator.maxTouchPoints > 0;

    this.playerScore = 0;
    this.cpuScore = 0;
    this.rally = 0;
    this.pointTimer = 0;
    this.pointWinner = null;
    this.serveTimer = 0;
    this.serveDuration = 0;
    this.serveDirection = 1;
    this.lastCountdownValue = null;

    this.playerZ = 0;
    this.playerTargetZ = 0;
    this.playerVelocity = 0;
    this.cpuZ = 0;
    this.cpuVelocity = 0;
    this.ai = {
      targetZ: 0,
      reaction: 0,
      seed: Math.random() * 20,
      readOffset: 0,
    };

    this.ballVelocity = new Vector2();
    this.currentSpeed = CONFIG.baseSpeed;
    this.keys = new Set();
    this.raycaster = new Raycaster();
    this.pointerNdc = new Vector2();
    this.pointerPlane = new Plane(new Vector3(0, 1, 0), -0.85);
    this.pointerHit = new Vector3();
    this.toastTimeout = null;

    this.ui = {
      startPanel: document.querySelector("#start-panel"),
      pausePanel: document.querySelector("#pause-panel"),
      endPanel: document.querySelector("#end-panel"),
      playButton: document.querySelector("#play-btn"),
      resumeButton: document.querySelector("#resume-btn"),
      rematchButton: document.querySelector("#rematch-btn"),
      pauseButton: document.querySelector("#pause-btn"),
      soundButton: document.querySelector("#sound-btn"),
      playerScore: document.querySelector("#player-score"),
      cpuScore: document.querySelector("#cpu-score"),
      finalPlayer: document.querySelector("#final-player"),
      finalCpu: document.querySelector("#final-cpu"),
      endTitle: document.querySelector("#end-title"),
      endSubtitle: document.querySelector("#end-subtitle"),
      countdown: document.querySelector("#countdown"),
      countdownValue: document.querySelector("#countdown-value"),
      toast: document.querySelector("#toast"),
      hintText: document.querySelector("#hint-text"),
      winTarget: document.querySelector("#win-target"),
      moveKey: document.querySelector("#move-key"),
      moveText: document.querySelector("#move-text"),
      keysKey: document.querySelector("#keys-key"),
      keysText: document.querySelector("#keys-text"),
      serveKey: document.querySelector("#serve-key"),
      serveText: document.querySelector("#serve-text"),
      pauseHint: document.querySelector("#pause-hint"),
      endHint: document.querySelector("#end-hint"),
    };

    this.ui.winTarget.textContent = String(CONFIG.winScore);
    this.applyControlLabels();
    this.bindEvents();
    this.updateSoundButton();
  }

  bindEvents() {
    this.ui.playButton.addEventListener("click", () => this.startMatch());
    this.ui.rematchButton.addEventListener("click", () => this.startMatch());
    this.ui.resumeButton.addEventListener("click", () => this.resume());
    this.ui.pauseButton.addEventListener("click", () => {
      if (this.phase === "paused") {
        this.resume();
      } else {
        this.pause();
      }
    });

    this.ui.soundButton.addEventListener("click", () => {
      const enabled = this.sound.toggle();
      this.updateSoundButton(enabled);
    });

    window.addEventListener("keydown", (event) => this.onKeyDown(event), { passive: false });
    window.addEventListener("keyup", (event) => this.onKeyUp(event), { passive: false });
    window.addEventListener("pointerdown", (event) => this.onPointer(event), { passive: true });
    window.addEventListener("pointermove", (event) => this.onPointer(event), { passive: true });
    window.addEventListener("blur", () => this.pause());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause();
    });
  }

  activate() {
    this.ready = true;
    this.ui.playButton.disabled = false;
    this.playerScore = 0;
    this.cpuScore = 0;
    this.updateScoreboard();
    this.enterMenu();
  }

  applyControlLabels() {
    if (this.isTouch) {
      this.ui.moveKey.textContent = "TOUCH";
      this.ui.moveText.textContent = "Drag to move";
      this.ui.keysKey.textContent = "PAUSE";
      this.ui.keysText.textContent = "HUD button";
      this.ui.serveKey.textContent = "FIRST TO 5";
      this.ui.serveText.textContent = "Win the match";
      this.ui.pauseHint.textContent = "Tap resume to continue";
      this.ui.endHint.textContent = "Tap rematch to run it back";
    } else {
      this.ui.moveKey.textContent = "MOUSE";
      this.ui.moveText.textContent = "Move paddle";
      this.ui.keysKey.textContent = "W / S";
      this.ui.keysText.textContent = "Or arrow keys";
      this.ui.serveKey.textContent = "SPACE";
      this.ui.serveText.textContent = "Launch ball";
      this.ui.pauseHint.innerHTML = 'Press <kbd>P</kbd> or <kbd>ESC</kbd> to resume';
      this.ui.endHint.innerHTML = 'Press <kbd>ENTER</kbd> to run it back';
    }
  }

  syncPauseButton() {
    const visible = this.phase === "playing" || this.phase === "serving";
    this.ui.pauseButton.classList.toggle("is-hidden", !visible);
  }

  enterMenu() {
    this.phase = "menu";
    this.playerZ = 0;
    this.playerTargetZ = 0;
    this.cpuZ = 0;
    this.ballVelocity.set(0, 0);
    this.world.resetBall();
    this.world.setTrailVisible(false);
    this.world.syncPaddles(0, 0);
    this.world.setBallVisible(true);
    this.world.ball.core.position.y = CONFIG.playY;
    this.showPanel("start");
    this.hideCountdown();
    this.updateHint("menu");
    this.syncPauseButton();
    document.body.dataset.state = "menu";
  }

  startMatch() {
    if (!this.ready) return;

    this.sound.unlock();
    this.keys.clear();
    this.playerScore = 0;
    this.cpuScore = 0;
    this.rally = 0;
    this.playerZ = 0;
    this.playerTargetZ = 0;
    this.cpuZ = 0;
    this.ai.targetZ = 0;
    this.ai.reaction = 0;
    this.ai.readOffset = 0;
    this.currentSpeed = CONFIG.baseSpeed;
    this.ballVelocity.set(0, 0);
    this.world.setTrailVisible(false);
    this.world.syncPaddles(0, 0);
    this.world.resetBall();
    this.updateScoreboard();
    this.ui.endPanel.classList.remove("is-defeat");
    this.hideToast();
    this.serveDirection = Math.random() < 0.5 ? -1 : 1;
    this.beginServe(2.7);
    this.clearFocus();
  }

  beginServe(duration = 2.2, direction = this.serveDirection) {
    if (!this.ready) return;

    this.phase = "serving";
    this.serveDirection = direction;
    this.serveDuration = duration;
    this.serveTimer = duration;
    this.lastCountdownValue = null;
    this.ballVelocity.set(0, 0);
    this.currentSpeed = CONFIG.baseSpeed;
    this.world.resetBall();
    this.world.setTrailVisible(false);
    this.world.setBallVisible(true);
    this.world.ball.core.position.y = CONFIG.playY;
    this.world.syncPaddles(this.playerZ, this.cpuZ);
    this.hidePanel("all");
    this.hideToast();
    this.updateHint("serving");
    this.syncPauseButton();
    document.body.dataset.state = "serving";
    this.updateCountdownDisplay(3, true);
  }

  launchBall(skipCountdown = false) {
    if (this.phase !== "serving") return;
    if (!skipCountdown && this.serveTimer > 0.12) return;

    this.phase = "playing";
    this.world.setBallVisible(true);
    this.world.setTrailVisible(true);
    this.world.ball.core.position.y = CONFIG.playY;
    this.hideCountdown();
    this.updateHint("playing");
    this.syncPauseButton();
    document.body.dataset.state = "playing";
    this.clearFocus();

    const angle = (Math.random() * 2 - 1) * 0.2;
    this.ballVelocity.set(
      this.serveDirection * CONFIG.baseSpeed * Math.cos(angle),
      CONFIG.baseSpeed * Math.sin(angle),
    );
    this.currentSpeed = CONFIG.baseSpeed;
    this.rally = 0;
    this.ai.readOffset = 0;
    this.sound.launch();
  }

  pause() {
    if (!this.ready || (this.phase !== "playing" && this.phase !== "serving")) return;
    this.keys.clear();
    this.phaseBeforePause = this.phase;
    this.phase = "paused";
    this.hideCountdown();
    this.showPanel("pause");
    this.updateHint("paused");
    this.syncPauseButton();
    document.body.dataset.state = "paused";
  }

  resume() {
    if (!this.ready || this.phase !== "paused") return;

    this.phase = this.phaseBeforePause;
    this.hidePanel("pause");
    this.updateHint(this.phase);
    this.syncPauseButton();
    document.body.dataset.state = this.phase;
    this.clearFocus();

    if (this.phase === "serving") {
      const ratio = this.serveDuration > 0 ? this.serveTimer / this.serveDuration : 0;
      const value = clamp(Math.ceil(ratio * 3), 1, 3);
      this.lastCountdownValue = null;
      this.updateCountdownDisplay(value, true);
    }
  }

  onKeyDown(event) {
    if (!this.ready) return;
    const code = event.code;

    if (code === "Space") {
      if (event.target instanceof HTMLButtonElement) event.preventDefault();
      if (this.phase === "menu") {
        event.preventDefault();
        this.startMatch();
      } else if (this.phase === "gameover") {
        event.preventDefault();
        this.startMatch();
      } else if (this.phase === "serving") {
        event.preventDefault();
        this.serveTimer = Math.min(this.serveTimer, 0.1);
        this.launchBall(true);
      } else if (this.phase === "paused") {
        event.preventDefault();
        this.resume();
      }
      return;
    }

    if (code === "Enter") {
      if (this.phase === "menu" || this.phase === "gameover") {
        event.preventDefault();
        this.startMatch();
      } else if (this.phase === "paused") {
        event.preventDefault();
        this.resume();
      }
      return;
    }

    if (code === "Escape" || code === "KeyP") {
      if (this.phase === "paused") {
        event.preventDefault();
        this.resume();
      } else if (this.phase === "playing" || this.phase === "serving") {
        event.preventDefault();
        this.pause();
      }
      return;
    }

    if (code === "KeyM") {
      const enabled = this.sound.toggle();
      this.updateSoundButton(enabled);
      return;
    }

    if (["ArrowUp", "ArrowDown", "KeyW", "KeyS"].includes(code)) {
      if (this.phase === "playing" || this.phase === "serving") {
        event.preventDefault();
        this.keys.add(code);
      }
    }
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }

  onPointer(event) {
    if (!event.isPrimary) return;
    if (event.target instanceof Element && event.target.closest(".hud-actions, .panel")) return;
    if (this.phase !== "playing" && this.phase !== "serving") return;

    this.pointerNdc.set(
      (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1,
      -(event.clientY / Math.max(1, window.innerHeight)) * 2 + 1,
    );

    this.raycaster.setFromCamera(this.pointerNdc, this.world.camera);
    if (this.raycaster.ray.intersectPlane(this.pointerPlane, this.pointerHit)) {
      this.playerTargetZ = clamp(this.pointerHit.z, -CONFIG.paddleZLimit, CONFIG.paddleZLimit);
    }
  }

  update(dt, time) {
    if (!this.ready) return;

    if (this.phase === "menu") {
      this.updateMenu(time);
    } else if (this.phase === "serving") {
      this.updatePaddles(dt, false);
      this.updateServing(dt);
    } else if (this.phase === "playing") {
      this.updatePaddles(dt, true);
      this.updateBall(dt);
    } else if (this.phase === "point") {
      this.updatePoint(dt);
    }

    if (this.phase === "playing" || this.phase === "serving") {
      this.world.syncPaddles(this.playerZ, this.cpuZ);
    }
  }

  updateMenu(time) {
    this.playerZ = Math.sin(time * 0.5) * 1.45;
    this.cpuZ = Math.sin(time * 0.42 + 2.1) * 1.7;
    this.world.syncPaddles(this.playerZ, this.cpuZ);
    this.world.ball.group.position.set(0, 0, Math.sin(time * 0.55) * 0.65);
    this.world.ball.core.position.y = CONFIG.playY + Math.sin(time * 1.9) * 0.045;
  }

  updatePaddles(dt, competitively) {
    const down = this.keys.has("ArrowDown") || this.keys.has("KeyS");
    const up = this.keys.has("ArrowUp") || this.keys.has("KeyW");
    const axis = (down ? 1 : 0) - (up ? 1 : 0);

    if (axis !== 0) {
      this.playerTargetZ = clamp(
        this.playerTargetZ + axis * CONFIG.playerKeySpeed * dt,
        -CONFIG.paddleZLimit,
        CONFIG.paddleZLimit,
      );
    }

    const previousPlayerZ = this.playerZ;
    this.playerZ = moveToward(this.playerZ, this.playerTargetZ, CONFIG.playerSpeed * dt);
    this.playerVelocity = (this.playerZ - previousPlayerZ) / Math.max(dt, 0.0001);

    if (!competitively) {
      this.cpuZ = moveToward(this.cpuZ, 0, CONFIG.aiSpeed * 0.6 * dt);
      this.cpuVelocity = 0;
      return;
    }

    this.updateAi(dt);
  }

  updateAi(dt) {
    const ball = this.world.ball.group.position;
    this.ai.reaction -= dt;

    if (this.ballVelocity.x > 0.4) {
      if (this.ai.reaction <= 0) {
        const distanceToPaddle = Math.max(0, CONFIG.paddleX - CONFIG.ballRadius - ball.x);
        const travelTime = Math.min(1.6, distanceToPaddle / Math.max(0.1, this.ballVelocity.x));
        const predicted = foldZ(ball.z + this.ballVelocity.y * travelTime, CONFIG.ballZLimit);
        const speedRatio = clamp(
          (this.currentSpeed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed),
          0,
          1,
        );
        // The longer the rally, the less reliable the CPU's read gets. This
        // keeps the AI dangerous early while giving the player a late opening.
        const wobble = Math.sin(this.world.elapsed * 1.7 + this.ai.seed) * (0.42 + speedRatio * 0.9);
        const noise = (Math.random() - 0.5) * (0.2 + speedRatio * 0.55);
        this.ai.targetZ = clamp(
          predicted * 0.76 + ball.z * 0.24 + wobble + noise + this.ai.readOffset,
          -CONFIG.paddleZLimit,
          CONFIG.paddleZLimit,
        );
        this.ai.reaction = 0.07 + Math.random() * 0.08;
      }
    } else {
      const recenter = MathUtils.damp(this.ai.targetZ, ball.z * 0.2, 1.3, dt);
      this.ai.targetZ = clamp(recenter, -CONFIG.paddleZLimit, CONFIG.paddleZLimit);
    }

    const speed = Math.min(CONFIG.aiMaxSpeed, CONFIG.aiSpeed + this.rally * 0.045);
    const previousCpuZ = this.cpuZ;
    this.cpuZ = moveToward(this.cpuZ, this.ai.targetZ, speed * dt);
    this.cpuVelocity = (this.cpuZ - previousCpuZ) / Math.max(dt, 0.0001);
  }

  updateServing(dt) {
    this.serveTimer -= dt;

    if (this.serveTimer <= 0) {
      this.launchBall(true);
      return;
    }

    const ratio = this.serveTimer / this.serveDuration;
    const value = clamp(Math.ceil(ratio * 3), 1, 3);
    this.updateCountdownDisplay(value);
    this.world.ball.core.position.y = CONFIG.playY + Math.sin(this.world.elapsed * 2.4) * 0.025;
  }

  updateCountdownDisplay(value, force = false) {
    if (!force && value === this.lastCountdownValue) {
      this.ui.countdown.classList.add("is-visible");
      return;
    }

    this.lastCountdownValue = value;
    this.ui.countdownValue.textContent = String(value);
    this.ui.countdown.classList.add("is-visible");
    this.ui.countdownValue.classList.remove("pop");
    // Restart the CSS animation for every tick.
    void this.ui.countdownValue.offsetWidth;
    this.ui.countdownValue.classList.add("pop");
  }

  hideCountdown() {
    this.ui.countdown.classList.remove("is-visible");
    this.ui.countdownValue.classList.remove("pop");
    this.lastCountdownValue = null;
  }

  updateBall(dt) {
    const ball = this.world.ball.group;
    const previousX = ball.position.x;
    const previousZ = ball.position.z;
    let x = previousX + this.ballVelocity.x * dt;
    let z = previousZ + this.ballVelocity.y * dt;

    if (z > CONFIG.ballZLimit) {
      z = CONFIG.ballZLimit - (z - CONFIG.ballZLimit);
      this.ballVelocity.y = -Math.abs(this.ballVelocity.y);
      this.world.wallEffect(CONFIG.ballZLimit, this.ballVelocity.x > 0 ? CONFIG.colors.cyan : CONFIG.colors.magenta);
      this.world.addShake(0.055);
      this.sound.wall();
    } else if (z < -CONFIG.ballZLimit) {
      z = -CONFIG.ballZLimit + (-CONFIG.ballZLimit - z);
      this.ballVelocity.y = Math.abs(this.ballVelocity.y);
      this.world.wallEffect(-CONFIG.ballZLimit, this.ballVelocity.x > 0 ? CONFIG.colors.cyan : CONFIG.colors.magenta);
      this.world.addShake(0.055);
      this.sound.wall();
    }

    if (this.ballVelocity.x < 0) {
      const contact = CONTACTS.left;
      if (previousX >= contact && x <= contact) {
        const denominator = x - previousX;
        if (Math.abs(denominator) > 0.00001) {
          const travel = (contact - previousX) / denominator;
          const zAtContact = previousZ + (z - previousZ) * travel;
          if (Math.abs(zAtContact - this.playerZ) <= CONFIG.paddleHalfDepth + CONFIG.ballRadius * 0.92) {
            x = contact + 0.006;
            z = zAtContact;
            this.bounceFromPaddle("left", z);
          }
        }
      }
    } else if (this.ballVelocity.x > 0) {
      const contact = CONTACTS.right;
      if (previousX <= contact && x >= contact) {
        const denominator = x - previousX;
        if (Math.abs(denominator) > 0.00001) {
          const travel = (contact - previousX) / denominator;
          const zAtContact = previousZ + (z - previousZ) * travel;
          if (Math.abs(zAtContact - this.cpuZ) <= CONFIG.paddleHalfDepth + CONFIG.ballRadius * 0.92) {
            x = contact - 0.006;
            z = zAtContact;
            this.bounceFromPaddle("right", z);
          }
        }
      }
    }

    ball.position.set(x, 0, z);
    this.world.updateTrail(x, z);

    if (x > CONFIG.goalX) {
      this.scorePoint("player", "right");
      return;
    }

    if (x < -CONFIG.goalX) {
      this.scorePoint("cpu", "left");
    }
  }

  bounceFromPaddle(side, z) {
    this.rally += 1;
    const speed = Math.min(CONFIG.maxSpeed, this.currentSpeed + CONFIG.speedStep);
    this.currentSpeed = speed;
    this.world.addShake(0.07);

    const paddleZ = side === "left" ? this.playerZ : this.cpuZ;
    const paddleVelocity = side === "left" ? this.playerVelocity : this.cpuVelocity;
    const reach = CONFIG.paddleHalfDepth + CONFIG.ballRadius;
    const offset = clamp((z - paddleZ) / reach, -1, 1);
    const spin = clamp(paddleVelocity * 0.012, -0.2, 0.2);
    const angle = clamp(offset * 0.58 + spin, -0.72, 0.72);

    const direction = side === "left" ? 1 : -1;
    this.ballVelocity.set(Math.cos(angle) * direction, Math.sin(angle));
    this.ballVelocity.y += clamp(paddleVelocity * 0.055, -1.1, 1.1);
    this.ballVelocity.normalize().multiplyScalar(speed);

    if (side === "left") {
      // A human return can disguise its angle with spin. The CPU reads each
      // incoming shot with a little imperfect information — sharp returns are
      // harder to read and more likely to pull it out of position.
      const sharpness = Math.min(1, Math.abs(this.ballVelocity.y) / 9);
      const mistakeChance = 0.07 + sharpness * 0.19;
      this.ai.readOffset = Math.random() < mistakeChance
        ? (Math.random() < 0.5 ? -1 : 1) * (1.55 + Math.random() * 1.15)
        : (Math.random() - 0.5) * 0.6;
    } else {
      this.ai.readOffset = 0;
    }

    const x = side === "left" ? CONTACTS.left : CONTACTS.right;
    const color = side === "left" ? CONFIG.colors.cyan : CONFIG.colors.magenta;
    this.world.hitEffect(x, z, color, Math.min(1.4, 0.8 + this.rally * 0.03));
    this.sound.paddle(Math.min(1.3, 0.8 + this.currentSpeed / 22));

    if (this.rally > 0 && this.rally % 6 === 0) {
      this.showToast(`RALLY ${String(this.rally).padStart(2, "0")}`, "neutral", 900);
    }
  }

  scorePoint(scorer, goalSide) {
    if (this.phase !== "playing") return;

    if (scorer === "player") {
      this.playerScore += 1;
    } else {
      this.cpuScore += 1;
    }

    const isPlayerPoint = scorer === "player";
    this.ballVelocity.set(0, 0);
    this.world.scoreEffect(goalSide);
    this.world.setTrailVisible(false);
    this.sound.score(isPlayerPoint);
    this.updateScoreboard(isPlayerPoint ? "player" : "cpu");
    this.showToast(isPlayerPoint ? "POINT / YOU" : "POINT / CPU", isPlayerPoint ? "cyan" : "magenta", 1600);
    this.hideCountdown();

    this.phase = "point";
    this.pointTimer = CONFIG.pointPause;
    this.pointWinner = scorer;
    this.updateHint("point");
    this.syncPauseButton();
    document.body.dataset.state = "point";

    if (this.playerScore >= CONFIG.winScore || this.cpuScore >= CONFIG.winScore) {
      this.pointTimer += 0.45;
    }
  }

  updatePoint(dt) {
    this.pointTimer -= dt;
    if (this.pointTimer > 0) return;

    const playerWon = this.playerScore >= CONFIG.winScore;
    const cpuWon = this.cpuScore >= CONFIG.winScore;

    if (playerWon || cpuWon) {
      this.endMatch(playerWon);
      return;
    }

    this.serveDirection = this.pointWinner === "player" ? 1 : -1;
    this.beginServe(2.15);
  }

  endMatch(playerWon) {
    this.phase = "gameover";
    this.world.setBallVisible(false);
    this.world.setTrailVisible(false);
    this.hideCountdown();
    this.ui.finalPlayer.textContent = String(this.playerScore);
    this.ui.finalCpu.textContent = String(this.cpuScore);
    this.ui.endPanel.classList.toggle("is-defeat", !playerWon);
    this.ui.endTitle.textContent = playerWon ? "YOU WIN" : "CPU WINS";
    this.ui.endSubtitle.textContent = playerWon
      ? "The grid belongs to you."
      : "The machine holds the grid. Run it back?";
    this.showPanel("end");
    this.updateHint("gameover");
    this.syncPauseButton();
    document.body.dataset.state = "gameover";
    this.world.addShake(0.45);
    this.hideToast();

    if (playerWon) {
      this.sound.win();
    } else {
      this.sound.lose();
    }

    window.setTimeout(() => {
      if (this.phase === "gameover" && !this.ui.rematchButton.disabled) {
        this.ui.rematchButton.focus({ preventScroll: true });
      }
    }, 550);
  }

  showPanel(name) {
    this.ui.startPanel.classList.toggle("is-visible", name === "start");
    this.ui.pausePanel.classList.toggle("is-visible", name === "pause");
    this.ui.endPanel.classList.toggle("is-visible", name === "end");
  }

  hidePanel(name) {
    if (name === "all" || name === "start") this.ui.startPanel.classList.remove("is-visible");
    if (name === "all" || name === "pause") this.ui.pausePanel.classList.remove("is-visible");
    if (name === "all" || name === "end") this.ui.endPanel.classList.remove("is-visible");
  }

  updateHint(phase) {
    const desktopHints = {
      menu: "MOVE MOUSE OR PRESS <kbd>W</kbd><kbd>S</kbd> TO READY UP",
      serving: "GET READY — <kbd>SPACE</kbd> TO SERVE",
      playing: "MOUSE / <kbd>W</kbd><kbd>S</kbd> TO TRACK  ·  <kbd>P</kbd> TO PAUSE",
      paused: "<kbd>P</kbd> OR <kbd>ESC</kbd> TO RESUME",
      point: "POINT",
      gameover: "<kbd>ENTER</kbd> TO REMATCH",
    };

    const touchHints = {
      menu: "DRAG TO MOVE YOUR PADDLE  ·  TAP PLAY TO START",
      serving: "GET READY",
      playing: "DRAG TO TRACK THE BALL  ·  PAUSE BUTTON TO HOLD",
      paused: "TAP RESUME TO CONTINUE",
      point: "POINT",
      gameover: "TAP REMATCH TO RUN IT BACK",
    };

    const hints = this.isTouch ? touchHints : desktopHints;
    this.ui.hintText.innerHTML = hints[phase] ?? hints.menu;
  }

  updateScoreboard(bumpSide) {
    this.ui.playerScore.textContent = String(this.playerScore);
    this.ui.cpuScore.textContent = String(this.cpuScore);

    if (!bumpSide) return;
    const target = bumpSide === "player" ? this.ui.playerScore : this.ui.cpuScore;
    target.classList.remove("bump");
    void target.offsetWidth;
    target.classList.add("bump");
  }

  updateSoundButton(enabled = this.sound.enabled) {
    this.ui.soundButton.classList.toggle("is-muted", !enabled);
    this.ui.soundButton.setAttribute("aria-pressed", String(!enabled));
    this.ui.soundButton.setAttribute("aria-label", enabled ? "Mute sound" : "Unmute sound");
  }

  showToast(text, tone = "neutral", duration = 1200) {
    window.clearTimeout(this.toastTimeout);
    this.ui.toast.textContent = text;
    this.ui.toast.className = "toast is-visible";
    if (tone === "cyan") this.ui.toast.classList.add("is-cyan");
    if (tone === "magenta") this.ui.toast.classList.add("is-magenta");

    this.toastTimeout = window.setTimeout(() => {
      this.ui.toast.classList.remove("is-visible");
    }, duration);
  }

  hideToast() {
    window.clearTimeout(this.toastTimeout);
    this.ui.toast.classList.remove("is-visible");
  }

  clearFocus() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }
}
