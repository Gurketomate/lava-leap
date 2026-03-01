import type { Player, Platform, Coin, Particle, PowerUp, DifficultyPhase } from './types';
import {
  GRAVITY, JUMP_FORCE, BOOST_FORCE, MOVE_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT,
  PLATFORM_WIDTH, PLATFORM_HEIGHT, PLATFORM_GAP_MIN, PLATFORM_GAP_MAX, PLATFORMS_BUFFER,
  LAVA_INITIAL_SPEED, LAVA_ACCELERATION, LAVA_MAX_SPEED,
  COIN_RADIUS, COIN_SPAWN_CHANCE, COIN_MAGNET_RANGE,
  CAMERA_SMOOTH, SCORE_SCALE, UPGRADE_INTERVAL,
  POWER_UP_DEFINITIONS,
  COYOTE_TIME, JUMP_BUFFER_TIME, PLATFORM_HITBOX_PADDING,
  DIFFICULTY_PHASES,
  LAVA_MAX_CAMERA_DIST, LAVA_PRESSURE_ACCEL, LAVA_MERCY_SLOW,
  REWARD_PLATFORM_COIN_MULT, NO_SAFE_ZONE_INTERVAL, NO_SAFE_ZONE_DURATION,
  SCREEN_SHAKE_MAX,
} from './constants';
import { computeReachability, isPlatformReachable, type ReachabilityLimits } from './reachability';
import { runStart, runEnd, deathCause } from './analytics';

type Callback = (data: any) => void;

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width = 0;
  height = 0;

  player: Player = this.createPlayer();
  platforms: Platform[] = [];
  coins: Coin[] = [];
  particles: Particle[] = [];
  cameraY = 0;
  lavaY = 0;
  lavaSpeed = LAVA_INITIAL_SPEED;
  score = 0;
  coinCount = 0;
  maxHeight = 0;
  startY = 0;
  highestPlatformY = 0;
  inputDir = 0;
  running = false;
  paused = false;
  lastTime = 0;
  animId = 0;
  backgroundLayers: { offset: number; speed: number; shapes: { x: number; y: number; r: number }[] }[] = [];

  // Power-up state
  hasDoubleJump = false;
  lavaSlowStacks = 0;
  hasCoinMagnet = false;
  hasShield = false;
  platformStabilizerStacks = 0;

  // Permanent upgrade bonuses
  jumpBonus = 0;
  coinSpawnBonus = 0;
  lavaResistBonus = 0;
  startWithShield = false;

  // Fairness assists (hidden)
  coyoteTimer = 0;
  jumpBufferTimer = 0;
  wasOnGround = false;
  jumpRequested = false;

  // Reachability
  reachability: ReachabilityLimits = computeReachability(0);

  // Analytics
  runStartTime = 0;

  // Phase-based difficulty
  currentPhase: DifficultyPhase = DIFFICULTY_PHASES[0];
  phaseIndex = 0;
  elapsedTime = 0;

  // No-safe-zone
  noSafeZoneTimer = NO_SAFE_ZONE_INTERVAL;
  inNoSafeZone = false;
  noSafeZoneDuration = 0;

  // Screen shake
  screenShake = 0;

  // Double jump visual timer
  doubleJumpFlashTimer = 0;

  // Callbacks
  onScoreUpdate: Callback = () => {};
  onCoinCollect: Callback = () => {};
  onGameOver: Callback = () => {};
  onUpgradeReady: Callback = () => {};
  onLavaProximity: Callback = () => {};
  onPhaseChange: Callback = () => {};
  onScreenShake: Callback = () => {};

  nextUpgradeAt = UPGRADE_INTERVAL;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.generateBackgroundLayers();
  }

  createPlayer(): Player {
    return {
      x: 0, y: 0, vx: 0, vy: 0,
      width: PLAYER_WIDTH, height: PLAYER_HEIGHT,
      hasDoubleJump: false, doubleJumpUsed: false, hasShield: false,
      jumpsRemaining: 0,
    };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  generateBackgroundLayers() {
    this.backgroundLayers = [0.1, 0.3, 0.5].map((speed) => ({
      offset: 0, speed,
      shapes: Array.from({ length: 20 }, () => ({
        x: Math.random() * 2000, y: Math.random() * 4000, r: 10 + Math.random() * 40,
      })),
    }));
  }

  setPermanentBonuses(jumpBonus: number, coinSpawnBonus: number, lavaResistBonus: number, startWithShield: boolean) {
    this.jumpBonus = jumpBonus;
    this.coinSpawnBonus = coinSpawnBonus;
    this.lavaResistBonus = lavaResistBonus;
    this.startWithShield = startWithShield;
    this.reachability = computeReachability(jumpBonus);
  }

  /** Get current difficulty phase based on elapsed time */
  updatePhase() {
    let newIndex = 0;
    for (let i = DIFFICULTY_PHASES.length - 1; i >= 0; i--) {
      if (this.elapsedTime >= DIFFICULTY_PHASES[i].minTime) {
        newIndex = i;
        break;
      }
    }
    if (newIndex !== this.phaseIndex) {
      this.phaseIndex = newIndex;
      this.currentPhase = DIFFICULTY_PHASES[newIndex];
      this.onPhaseChange(newIndex + 1);
    }
  }

  /** Pick platform type based on current phase probabilities */
  pickPlatformType(): Platform['type'] {
    const phase = this.currentPhase;
    const stabilizerReduction = this.platformStabilizerStacks * 0.05;

    // In no-safe-zone, only hard platforms
    if (this.inNoSafeZone) {
      const r = Math.random();
      if (r < 0.35) return 'moving';
      if (r < 0.65) return 'breakable';
      if (r < 0.75) return 'reward';
      return 'boost';
    }

    const breakable = Math.max(0, phase.breakableChance - stabilizerReduction);
    const r = Math.random();
    let cumulative = 0;

    cumulative += phase.boostChance;
    if (r < cumulative) return 'boost';

    cumulative += phase.rewardChance;
    if (r < cumulative) return 'reward';

    cumulative += phase.movingChance;
    if (r < cumulative) return 'moving';

    cumulative += breakable;
    if (r < cumulative) return 'breakable';

    return 'normal';
  }

  init() {
    this.player = this.createPlayer();
    this.player.x = this.width / 2 - PLAYER_WIDTH / 2;
    this.player.y = this.height - 120;
    this.startY = this.player.y;
    this.maxHeight = 0;
    this.cameraY = 0;
    this.lavaY = this.height + 100;
    this.lavaSpeed = LAVA_INITIAL_SPEED * (1 - this.lavaResistBonus);
    this.score = 0;
    this.coinCount = 0;
    this.platforms = [];
    this.coins = [];
    this.particles = [];
    this.nextUpgradeAt = UPGRADE_INTERVAL;
    this.hasDoubleJump = false;
    this.lavaSlowStacks = 0;
    this.hasCoinMagnet = false;
    this.hasShield = this.startWithShield;
    this.platformStabilizerStacks = 0;
    this.inputDir = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.wasOnGround = false;
    this.jumpRequested = false;
    this.reachability = computeReachability(this.jumpBonus);
    this.elapsedTime = 0;
    this.phaseIndex = 0;
    this.currentPhase = DIFFICULTY_PHASES[0];
    this.noSafeZoneTimer = NO_SAFE_ZONE_INTERVAL;
    this.inNoSafeZone = false;
    this.noSafeZoneDuration = 0;
    this.screenShake = 0;
    this.doubleJumpFlashTimer = 0;

    const startPlatform: Platform = {
      x: this.width / 2 - PLATFORM_WIDTH / 2,
      y: this.height - 80,
      width: PLATFORM_WIDTH * 1.5,
      height: PLATFORM_HEIGHT,
      type: 'normal',
      broken: false,
    };
    this.platforms.push(startPlatform);
    this.highestPlatformY = startPlatform.y;

    this.generatePlatformsUpTo(this.cameraY - PLATFORMS_BUFFER);
  }

  start() {
    this.init();
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    this.runStartTime = performance.now();
    runStart();
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.animId);
  }

  pause() { this.paused = true; }

  resume() {
    this.paused = false;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  setInput(dir: number) { this.inputDir = dir; }

  applyPowerUp(powerUp: PowerUp) {
    switch (powerUp.type) {
      case 'doubleJump': this.hasDoubleJump = true; break;
      case 'lavaSlow': this.lavaSlowStacks++; break;
      case 'coinMagnet': this.hasCoinMagnet = true; break;
      case 'shield': this.hasShield = true; break;
      case 'platformStabilizer': this.platformStabilizerStacks++; break;
    }
  }

  getRandomUpgradeChoices(): PowerUp[] {
    const shuffled = [...POWER_UP_DEFINITIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 2).map((d) => ({ ...d, stacks: 1 }));
  }

  generatePlatformsUpTo(targetY: number) {
    const lastPlatform = this.platforms.length > 0 ? this.platforms[this.platforms.length - 1] : null;

    while (this.highestPlatformY > targetY) {
      const gap = PLATFORM_GAP_MIN + Math.random() * (PLATFORM_GAP_MAX - PLATFORM_GAP_MIN);
      const newY = this.highestPlatformY - gap;
      let newX = Math.random() * (this.width - PLATFORM_WIDTH);

      const type = this.pickPlatformType();

      // Phase-based width scaling
      const baseWidth = PLATFORM_WIDTH + (type === 'normal' ? Math.random() * 20 : 0);
      const platWidth = baseWidth * this.currentPhase.platformWidthMod;

      // Reachability validation
      const sourcePlat = lastPlatform || this.platforms[this.platforms.length - 1];
      if (sourcePlat) {
        let attempts = 0;
        while (
          attempts < 20 &&
          !isPlatformReachable(sourcePlat.x, sourcePlat.width, sourcePlat.y, newX, platWidth, newY, this.reachability)
        ) {
          newX = Math.random() * (this.width - platWidth);
          attempts++;
        }
        if (attempts >= 20) {
          newX = Math.max(0, Math.min(
            this.width - platWidth,
            sourcePlat.x + sourcePlat.width / 2 - platWidth / 2 + (Math.random() - 0.5) * 60
          ));
        }

        // No moving platform after large gap
        const vertDist = sourcePlat.y - newY;
        if (type === 'moving' && vertDist > this.reachability.safeVerticalDist * 0.6) {
          // downgrade to normal — already assigned, just override
        }
      }

      const platform: Platform = {
        x: newX, y: newY,
        width: platWidth,
        height: PLATFORM_HEIGHT,
        type, broken: false,
      };

      if (type === 'moving') {
        platform.moveSpeed = 60 + Math.random() * 80;
        platform.moveRange = 50 + Math.random() * 80;
        platform.moveDir = Math.random() > 0.5 ? 1 : -1;
        platform.originX = newX;
      }

      this.platforms.push(platform);

      // Coin spawning — reward platforms always have coins, otherwise chance-based
      const coinChance = type === 'reward'
        ? 1.0
        : COIN_SPAWN_CHANCE + this.coinSpawnBonus;
      if (Math.random() < coinChance) {
        const coinCount = type === 'reward' ? REWARD_PLATFORM_COIN_MULT : 1;
        for (let c = 0; c < coinCount; c++) {
          this.coins.push({
            x: newX + platWidth / 2 + (c - Math.floor(coinCount / 2)) * 18,
            y: newY - 25 - c * 4,
            radius: COIN_RADIUS,
            collected: false,
            angle: 0,
          });
        }
      }

      this.highestPlatformY = newY;
    }
  }

  update(dt: number) {
    if (dt > 0.05) dt = 0.05;

    this.elapsedTime += dt;
    this.updatePhase();

    // No-safe-zone timer
    if (!this.inNoSafeZone) {
      this.noSafeZoneTimer -= dt;
      if (this.noSafeZoneTimer <= 0) {
        this.inNoSafeZone = true;
        this.noSafeZoneDuration = NO_SAFE_ZONE_DURATION;
      }
    } else {
      this.noSafeZoneDuration -= dt;
      if (this.noSafeZoneDuration <= 0) {
        this.inNoSafeZone = false;
        this.noSafeZoneTimer = NO_SAFE_ZONE_INTERVAL;
      }
    }

    // Double jump flash decay
    if (this.doubleJumpFlashTimer > 0) this.doubleJumpFlashTimer -= dt;

    const p = this.player;

    // Gravity
    p.vy += GRAVITY * dt;

    // Horizontal input
    p.vx = this.inputDir * MOVE_SPEED;

    // Update position
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Screen wrap
    if (p.x + p.width < 0) p.x = this.width;
    if (p.x > this.width) p.x = -p.width;

    // Fairness: coyote timer
    if (this.wasOnGround && p.vy > 0) this.coyoteTimer += dt;
    if (this.coyoteTimer > COYOTE_TIME) { this.wasOnGround = false; this.coyoteTimer = 0; }

    // Fairness: jump buffer
    if (this.jumpRequested) {
      this.jumpBufferTimer += dt;
      if (this.jumpBufferTimer > JUMP_BUFFER_TIME) { this.jumpRequested = false; this.jumpBufferTimer = 0; }
    }

    // Platform collision (only falling)
    let landedThisFrame = false;
    if (p.vy > 0) {
      for (const plat of this.platforms) {
        if (plat.broken) continue;
        const platLeft = plat.x - PLATFORM_HITBOX_PADDING;
        const platRight = plat.x + plat.width + PLATFORM_HITBOX_PADDING;

        if (
          p.x + p.width > platLeft &&
          p.x < platRight &&
          p.y + p.height >= plat.y &&
          p.y + p.height <= plat.y + plat.height + p.vy * dt + 5
        ) {
          const jumpForce = JUMP_FORCE * (1 + this.jumpBonus);

          if (plat.type === 'boost') {
            p.vy = -BOOST_FORCE * (1 + this.jumpBonus);
            this.spawnParticles(p.x + p.width / 2, p.y + p.height, '#ff6600', 8);
          } else if (plat.type === 'breakable' || plat.type === 'reward') {
            p.vy = -jumpForce;
            plat.broken = true;
            this.spawnParticles(plat.x + plat.width / 2, plat.y, plat.type === 'reward' ? '#ffd700' : '#888888', 8);
          } else {
            p.vy = -jumpForce;
          }

          p.y = plat.y - p.height;
          p.doubleJumpUsed = false;
          landedThisFrame = true;
          this.wasOnGround = true;
          this.coyoteTimer = 0;

          if (this.jumpRequested) { this.jumpRequested = false; this.jumpBufferTimer = 0; }
          break;
        }
      }
    }

    // Moving platforms
    for (const plat of this.platforms) {
      if (plat.type === 'moving' && !plat.broken && plat.originX !== undefined) {
        plat.x += (plat.moveDir || 1) * (plat.moveSpeed || 60) * dt;
        if (plat.x > plat.originX + (plat.moveRange || 80) || plat.x < plat.originX - (plat.moveRange || 80)) {
          plat.moveDir = -(plat.moveDir || 1);
        }
      }
    }

    // Camera follow
    const targetCameraY = p.y - this.height * 0.35;
    if (targetCameraY < this.cameraY) {
      this.cameraY += (targetCameraY - this.cameraY) * CAMERA_SMOOTH * 60 * dt;
    }

    // === LAVA SYSTEM (dynamic pressure) ===
    const lavaMultiplier = Math.pow(0.7, this.lavaSlowStacks);
    const phaseSpeedMod = this.currentPhase.lavaSpeedMod;
    // Phase 5: exponential acceleration
    const expoAccel = this.phaseIndex >= 4 ? 1 + (this.elapsedTime - 120) * 0.005 : 1;

    this.lavaSpeed = Math.min(LAVA_MAX_SPEED * phaseSpeedMod,
      this.lavaSpeed + LAVA_ACCELERATION * phaseSpeedMod * expoAccel * dt
    ) * lavaMultiplier;

    // Pressure zone: if player is far ahead, lava accelerates; if near death, slight mercy
    const distToLava = this.lavaY - (p.y + p.height);
    if (distToLava > LAVA_MAX_CAMERA_DIST) {
      // Player far ahead → pressure acceleration
      this.lavaY -= (this.lavaSpeed + LAVA_PRESSURE_ACCEL * (distToLava / LAVA_MAX_CAMERA_DIST)) * dt;
    } else if (distToLava < 80) {
      // Near death → slight mercy slowdown
      this.lavaY -= this.lavaSpeed * LAVA_MERCY_SLOW * dt;
    } else {
      this.lavaY -= this.lavaSpeed * dt;
    }

    // Clamp: lava never goes below camera bottom + max dist
    const maxLavaY = this.cameraY + this.height + LAVA_MAX_CAMERA_DIST;
    if (this.lavaY > maxLavaY) this.lavaY = maxLavaY;

    // Lava proximity & screen shake
    const proximity = 1 - Math.min(1, Math.max(0, distToLava / 400));
    this.onLavaProximity(proximity);

    // Screen shake based on proximity
    this.screenShake = proximity > 0.6 ? (proximity - 0.6) * 2.5 : 0;
    this.onScreenShake(this.screenShake);

    // Score
    const heightReached = Math.max(0, this.startY - p.y);
    this.score = Math.floor(heightReached / SCORE_SCALE);
    this.onScoreUpdate(this.score);

    // Upgrade check
    if (this.score >= this.nextUpgradeAt) {
      this.nextUpgradeAt += UPGRADE_INTERVAL;
      this.pause();
      this.onUpgradeReady(this.getRandomUpgradeChoices());
      return;
    }

    // Coin collection
    for (const coin of this.coins) {
      if (coin.collected) continue;
      const dx = (p.x + p.width / 2) - coin.x;
      const dy = (p.y + p.height / 2) - coin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (this.hasCoinMagnet && dist < COIN_MAGNET_RANGE) {
        const speed = 300 * dt;
        coin.x += (dx / dist) * speed;
        coin.y += (dy / dist) * speed;
      }

      if (dist < coin.radius + 20) {
        coin.collected = true;
        this.coinCount++;
        this.onCoinCollect(this.coinCount);
        this.spawnParticles(coin.x, coin.y, '#ffd700', 5);
      }
      coin.angle += dt * 3;
    }

    // Particles
    this.particles = this.particles.filter((part) => {
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.vy += 200 * dt;
      part.life -= dt;
      return part.life > 0;
    });

    // Generate more platforms
    this.generatePlatformsUpTo(this.cameraY - PLATFORMS_BUFFER);

    // Cleanup
    this.platforms = this.platforms.filter((pl) => pl.y < this.lavaY + 100);
    this.coins = this.coins.filter((c) => !c.collected && c.y < this.lavaY + 100);

    // Game over checks
    if (p.y + p.height > this.lavaY) {
      if (this.hasShield) {
        this.hasShield = false;
        p.vy = -JUMP_FORCE;
        this.spawnParticles(p.x + p.width / 2, p.y + p.height, '#00aaff', 12);
      } else {
        this.running = false;
        deathCause('lava');
        runEnd(this.score, (performance.now() - this.runStartTime) / 1000);
        this.onGameOver({ score: this.score, coins: this.coinCount });
        return;
      }
    }
    if (p.y > this.cameraY + this.height + 100) {
      if (this.hasShield) {
        this.hasShield = false;
        p.vy = -JUMP_FORCE;
      } else {
        this.running = false;
        deathCause('fall');
        runEnd(this.score, (performance.now() - this.runStartTime) / 1000);
        this.onGameOver({ score: this.score, coins: this.coinCount });
        return;
      }
    }
  }

  spawnParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 200,
        vy: -Math.random() * 200,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.fillStyle = '#08080f';
    ctx.fillRect(0, 0, w, h);

    ctx.save();

    // Screen shake
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * SCREEN_SHAKE_MAX * this.screenShake;
      const shakeY = (Math.random() - 0.5) * SCREEN_SHAKE_MAX * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    ctx.save();
    ctx.translate(0, -this.cameraY);

    this.renderBackground(ctx);

    for (const plat of this.platforms) {
      if (plat.broken) continue;
      if (plat.y < this.cameraY - 50 || plat.y > this.cameraY + h + 50) continue;
      this.renderPlatform(ctx, plat);
    }

    for (const coin of this.coins) {
      if (coin.collected) continue;
      if (coin.y < this.cameraY - 50 || coin.y > this.cameraY + h + 50) continue;
      this.renderCoin(ctx, coin);
    }

    this.renderPlayer(ctx);

    for (const part of this.particles) {
      const alpha = part.life / part.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    this.renderLava(ctx);
    ctx.restore();

    // Shield indicator
    if (this.hasShield) {
      ctx.strokeStyle = 'rgba(0, 170, 255, 0.5)';
      ctx.lineWidth = 3;
      const px = this.player.x + this.player.width / 2;
      const py = this.player.y + this.player.height / 2 - this.cameraY;
      ctx.beginPath();
      ctx.arc(px, py, 28, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Lava edge glow overlay (rendered in screen space)
    const distToLava = this.lavaY - (this.player.y + this.player.height);
    const prox = 1 - Math.min(1, Math.max(0, distToLava / 400));
    if (prox > 0.2) {
      const intensity = (prox - 0.2) * 1.25;
      // Bottom glow
      const grad = ctx.createLinearGradient(0, h, 0, h - h * intensity * 0.5);
      grad.addColorStop(0, `rgba(255, 40, 0, ${intensity * 0.35})`);
      grad.addColorStop(1, 'rgba(255, 40, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Side vignette
      const sideGrad = ctx.createLinearGradient(0, 0, w * 0.15, 0);
      sideGrad.addColorStop(0, `rgba(255, 30, 0, ${intensity * 0.2})`);
      sideGrad.addColorStop(1, 'rgba(255, 30, 0, 0)');
      ctx.fillStyle = sideGrad;
      ctx.fillRect(0, 0, w * 0.15, h);

      const sideGrad2 = ctx.createLinearGradient(w, 0, w * 0.85, 0);
      sideGrad2.addColorStop(0, `rgba(255, 30, 0, ${intensity * 0.2})`);
      sideGrad2.addColorStop(1, 'rgba(255, 30, 0, 0)');
      ctx.fillStyle = sideGrad2;
      ctx.fillRect(w * 0.85, 0, w * 0.15, h);

      // Heat distortion lines
      if (intensity > 0.4) {
        ctx.globalAlpha = (intensity - 0.4) * 0.3;
        const time = performance.now() / 1000;
        for (let i = 0; i < 3; i++) {
          const lineY = h - 30 - i * 40 + Math.sin(time * 2 + i) * 10;
          ctx.strokeStyle = `rgba(255, 100, 0, 0.3)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let x = 0; x <= w; x += 8) {
            const wy = lineY + Math.sin(x * 0.03 + time * 4 + i * 2) * 4;
            if (x === 0) ctx.moveTo(x, wy); else ctx.lineTo(x, wy);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    // No-safe-zone warning flash
    if (this.inNoSafeZone) {
      const flash = Math.sin(performance.now() / 150) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255, 0, 0, ${flash * 0.08})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Phase indicator
    if (this.phaseIndex > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Phase ${this.phaseIndex + 1}`, w - 10, h - 20);
    }

    ctx.restore(); // screen shake restore
  }

  renderBackground(ctx: CanvasRenderingContext2D) {
    for (const layer of this.backgroundLayers) {
      ctx.fillStyle = `rgba(30, 25, 40, 0.3)`;
      const offsetY = this.cameraY * layer.speed;
      for (const shape of layer.shapes) {
        const sy = shape.y + offsetY;
        if (sy > this.cameraY - 100 && sy < this.cameraY + this.height + 100) {
          ctx.beginPath();
          ctx.arc(shape.x % this.width, sy, shape.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  renderPlatform(ctx: CanvasRenderingContext2D, plat: Platform) {
    const colors: Record<string, string> = {
      normal: '#4a5568',
      breakable: '#a0522d',
      moving: '#4682b4',
      boost: '#ff6600',
      reward: '#ff2255',
    };

    const glowColors: Record<string, string> = {
      normal: 'rgba(74, 85, 104, 0.3)',
      breakable: 'rgba(160, 82, 45, 0.3)',
      moving: 'rgba(70, 130, 180, 0.4)',
      boost: 'rgba(255, 102, 0, 0.5)',
      reward: 'rgba(255, 34, 85, 0.6)',
    };

    ctx.shadowColor = glowColors[plat.type] || glowColors.normal;
    ctx.shadowBlur = plat.type === 'boost' || plat.type === 'reward' ? 15 : 8;

    const grad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.height);
    grad.addColorStop(0, colors[plat.type] || colors.normal);
    grad.addColorStop(1, '#2d3748');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.roundRect(plat.x, plat.y, plat.width, plat.height, 4);
    ctx.fill();

    ctx.shadowBlur = 0;

    if (plat.type === 'breakable') {
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plat.x + plat.width * 0.3, plat.y);
      ctx.lineTo(plat.x + plat.width * 0.5, plat.y + plat.height);
      ctx.moveTo(plat.x + plat.width * 0.7, plat.y);
      ctx.lineTo(plat.x + plat.width * 0.6, plat.y + plat.height);
      ctx.stroke();
    }

    if (plat.type === 'boost') {
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▲', plat.x + plat.width / 2, plat.y + 11);
    }

    if (plat.type === 'reward') {
      // Pulsing glow for reward platforms
      const pulse = Math.sin(performance.now() / 200) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(255, 215, 0, ${pulse * 0.4})`;
      ctx.fillText('💰', plat.x + plat.width / 2, plat.y + 11);
    }
  }

  renderCoin(ctx: CanvasRenderingContext2D, coin: Coin) {
    ctx.save();
    ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
    ctx.shadowBlur = 12;

    const scaleX = Math.cos(coin.angle);
    ctx.translate(coin.x, coin.y);
    ctx.scale(scaleX, 1);

    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, coin.radius);
    grad.addColorStop(0, '#fff4a3');
    grad.addColorStop(0.5, '#ffd700');
    grad.addColorStop(1, '#b8860b');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    ctx.save();
    ctx.translate(p.x + p.width / 2, p.y + p.height / 2);

    // Double jump flash: color shift
    if (this.doubleJumpFlashTimer > 0) {
      const flashIntensity = this.doubleJumpFlashTimer / 0.3;
      const r = Math.round(231 + (0 - 231) * flashIntensity);
      const g = Math.round(76 + (204 - 76) * flashIntensity);
      const b = Math.round(60 + (255 - 60) * flashIntensity);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    } else {
      ctx.fillStyle = '#e74c3c';
    }

    ctx.beginPath();
    ctx.roundRect(-p.width / 2, -p.height / 2, p.width, p.height, 6);
    ctx.fill();

    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.roundRect(-10, -p.height / 2 + 4, 20, 12, 4);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-4, -p.height / 2 + 10, 3, 0, Math.PI * 2);
    ctx.arc(4, -p.height / 2 + 10, 3, 0, Math.PI * 2);
    ctx.fill();

    if (p.vy < -100) {
      const flameH = Math.min(20, Math.abs(p.vy) / 40);
      const grad = ctx.createLinearGradient(0, p.height / 2, 0, p.height / 2 + flameH);
      grad.addColorStop(0, '#ff6600');
      grad.addColorStop(0.5, '#ff3300');
      grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-6, p.height / 2);
      ctx.lineTo(6, p.height / 2);
      ctx.lineTo(0, p.height / 2 + flameH);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  renderLava(ctx: CanvasRenderingContext2D) {
    const lavaTop = this.lavaY;
    const lavaBottom = this.cameraY + this.height + 200;

    if (lavaTop > this.cameraY + this.height + 50) return;

    const glowGrad = ctx.createLinearGradient(0, lavaTop - 80, 0, lavaTop);
    glowGrad.addColorStop(0, 'rgba(255, 60, 0, 0)');
    glowGrad.addColorStop(1, 'rgba(255, 60, 0, 0.3)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, lavaTop - 80, this.width, 80);

    const lavaGrad = ctx.createLinearGradient(0, lavaTop, 0, lavaBottom);
    lavaGrad.addColorStop(0, '#ff4500');
    lavaGrad.addColorStop(0.3, '#ff2200');
    lavaGrad.addColorStop(1, '#8b0000');
    ctx.fillStyle = lavaGrad;

    ctx.beginPath();
    ctx.moveTo(0, lavaBottom);
    const time = performance.now() / 1000;
    for (let x = 0; x <= this.width; x += 5) {
      const wave = Math.sin(x * 0.02 + time * 3) * 6 + Math.sin(x * 0.05 + time * 2) * 3;
      ctx.lineTo(x, lavaTop + wave);
    }
    ctx.lineTo(this.width, lavaBottom);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    for (let x = 0; x <= this.width; x += 5) {
      const wave = Math.sin(x * 0.02 + time * 3) * 6 + Math.sin(x * 0.05 + time * 2) * 3;
      if (x === 0) ctx.moveTo(x, lavaTop + wave); else ctx.lineTo(x, lavaTop + wave);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  doDoubleJump() {
    if (this.hasDoubleJump && !this.player.doubleJumpUsed && this.player.vy > 0) {
      this.player.vy = -JUMP_FORCE * 0.8 * (1 + this.jumpBonus);
      this.player.doubleJumpUsed = true;
      this.doubleJumpFlashTimer = 0.3;
      // Explosion particles
      this.spawnParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height, '#00ccff', 12);
      this.spawnParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height, '#ffffff', 6);
    }
  }

  loop = (time: number) => {
    if (!this.running) return;
    if (this.paused) return;

    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    this.update(dt);
    if (this.running) {
      this.render();
      this.animId = requestAnimationFrame(this.loop);
    }
  };

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.animId);
  }
}
