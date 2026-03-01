import type { Player, Platform, Coin, Particle, PowerUp } from './types';
import {
  GRAVITY, JUMP_FORCE, BOOST_FORCE, MOVE_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT,
  PLATFORM_WIDTH, PLATFORM_HEIGHT, PLATFORM_GAP_MIN, PLATFORM_GAP_MAX, PLATFORMS_BUFFER,
  LAVA_INITIAL_SPEED, LAVA_ACCELERATION, LAVA_MAX_SPEED,
  COIN_RADIUS, COIN_SPAWN_CHANCE, COIN_MAGNET_RANGE,
  CAMERA_SMOOTH, SCORE_SCALE, UPGRADE_INTERVAL,
  BREAKABLE_CHANCE_BASE, MOVING_CHANCE_BASE, BOOST_CHANCE_BASE,
  POWER_UP_DEFINITIONS,
  COYOTE_TIME, JUMP_BUFFER_TIME, PLATFORM_HITBOX_PADDING,
  DIFFICULTY_BREAKABLE_SCALE, DIFFICULTY_MOVING_SCALE, DIFFICULTY_LAVA_ACCEL_SCALE,
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

  // Callbacks
  onScoreUpdate: Callback = () => {};
  onCoinCollect: Callback = () => {};
  onGameOver: Callback = () => {};
  onUpgradeReady: Callback = () => {};
  onLavaProximity: Callback = () => {};

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

  /** Get difficulty multiplier based on current score (scales per 1000 pts) */
  getDifficultyFactor(): number {
    return this.score / 1000;
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

    // Generate initial platforms
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

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  setInput(dir: number) {
    this.inputDir = dir;
  }

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
    const difficulty = this.getDifficultyFactor();
    const lastPlatform = this.platforms.length > 0
      ? this.platforms[this.platforms.length - 1]
      : null;

    while (this.highestPlatformY > targetY) {
      const gap = PLATFORM_GAP_MIN + Math.random() * (PLATFORM_GAP_MAX - PLATFORM_GAP_MIN);
      const newY = this.highestPlatformY - gap;
      let newX = Math.random() * (this.width - PLATFORM_WIDTH);

      // Determine type with difficulty scaling
      let type: Platform['type'] = 'normal';
      const breakChance = Math.max(0,
        BREAKABLE_CHANCE_BASE + difficulty * DIFFICULTY_BREAKABLE_SCALE - this.platformStabilizerStacks * 0.05
      );
      const moveChance = MOVING_CHANCE_BASE + difficulty * DIFFICULTY_MOVING_SCALE;
      const r = Math.random();
      if (r < BOOST_CHANCE_BASE) type = 'boost';
      else if (r < BOOST_CHANCE_BASE + moveChance) type = 'moving';
      else if (r < BOOST_CHANCE_BASE + moveChance + breakChance) type = 'breakable';

      const platWidth = PLATFORM_WIDTH + (type === 'normal' ? Math.random() * 20 : 0);

      // Reachability validation: ensure platform is reachable from previous
      const sourcePlat = lastPlatform || this.platforms[this.platforms.length - 1];
      if (sourcePlat) {
        let attempts = 0;
        while (
          attempts < 20 &&
          !isPlatformReachable(
            sourcePlat.x, sourcePlat.width, sourcePlat.y,
            newX, platWidth, newY,
            this.reachability,
          )
        ) {
          newX = Math.random() * (this.width - platWidth);
          attempts++;
        }

        // If still unreachable after retries, place directly above source
        if (attempts >= 20) {
          newX = Math.max(0, Math.min(
            this.width - platWidth,
            sourcePlat.x + sourcePlat.width / 2 - platWidth / 2 + (Math.random() - 0.5) * 60
          ));
        }

        // Rule: no moving platform directly after a large gap
        const vertDist = sourcePlat.y - newY;
        if (type === 'moving' && vertDist > this.reachability.safeVerticalDist * 0.6) {
          type = 'normal';
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

      // Maybe spawn coin
      const coinChance = COIN_SPAWN_CHANCE + this.coinSpawnBonus;
      if (Math.random() < coinChance) {
        this.coins.push({
          x: newX + platWidth / 2,
          y: newY - 25,
          radius: COIN_RADIUS,
          collected: false,
          angle: 0,
        });
      }

      this.highestPlatformY = newY;
    }
  }

  update(dt: number) {
    if (dt > 0.05) dt = 0.05; // cap

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

    // Fairness: update coyote timer
    if (this.wasOnGround && p.vy > 0) {
      this.coyoteTimer += dt;
    }
    if (this.coyoteTimer > COYOTE_TIME) {
      this.wasOnGround = false;
      this.coyoteTimer = 0;
    }

    // Fairness: jump buffer timer
    if (this.jumpRequested) {
      this.jumpBufferTimer += dt;
      if (this.jumpBufferTimer > JUMP_BUFFER_TIME) {
        this.jumpRequested = false;
        this.jumpBufferTimer = 0;
      }
    }

    // Platform collision (only when falling)
    let landedThisFrame = false;
    if (p.vy > 0) {
      for (const plat of this.platforms) {
        if (plat.broken) continue;

        // Enlarged hitbox for fairness
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
          } else if (plat.type === 'breakable') {
            p.vy = -jumpForce;
            plat.broken = true;
            this.spawnParticles(plat.x + plat.width / 2, plat.y, '#888888', 6);
          } else {
            p.vy = -jumpForce;
          }

          p.y = plat.y - p.height;
          p.doubleJumpUsed = false;
          landedThisFrame = true;
          this.wasOnGround = true;
          this.coyoteTimer = 0;

          // Consume jump buffer
          if (this.jumpRequested) {
            this.jumpRequested = false;
            this.jumpBufferTimer = 0;
          }
          break;
        }
      }
    }

    if (!landedThisFrame && p.vy <= 0) {
      // Player is ascending, not on ground
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

    // Lava (with difficulty-scaled acceleration)
    const difficulty = this.getDifficultyFactor();
    const lavaMultiplier = Math.pow(0.7, this.lavaSlowStacks);
    const scaledAccel = LAVA_ACCELERATION * (1 + difficulty * DIFFICULTY_LAVA_ACCEL_SCALE);
    this.lavaSpeed = Math.min(LAVA_MAX_SPEED, this.lavaSpeed + scaledAccel * dt) * lavaMultiplier;
    this.lavaY -= this.lavaSpeed * dt;
    if (this.lavaY > this.cameraY + this.height + 200) {
      this.lavaY = this.cameraY + this.height + 200;
    }

    // Lava proximity (for heat bar)
    const distToLava = this.lavaY - (p.y + p.height);
    const proximity = 1 - Math.min(1, Math.max(0, distToLava / 400));
    this.onLavaProximity(proximity);

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

      // Magnet
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

    // Cleanup off-screen below lava
    this.platforms = this.platforms.filter((pl) => pl.y < this.lavaY + 100);
    this.coins = this.coins.filter((c) => !c.collected && c.y < this.lavaY + 100);

    // Game over: fell into lava or below screen
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
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 170, 255, 0.5)';
      ctx.lineWidth = 3;
      const px = this.player.x + this.player.width / 2;
      const py = this.player.y + this.player.height / 2 - this.cameraY;
      ctx.beginPath();
      ctx.arc(px, py, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
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
    const colors = {
      normal: '#4a5568',
      breakable: '#a0522d',
      moving: '#4682b4',
      boost: '#ff6600',
    };

    const glowColors = {
      normal: 'rgba(74, 85, 104, 0.3)',
      breakable: 'rgba(160, 82, 45, 0.3)',
      moving: 'rgba(70, 130, 180, 0.4)',
      boost: 'rgba(255, 102, 0, 0.5)',
    };

    ctx.shadowColor = glowColors[plat.type];
    ctx.shadowBlur = plat.type === 'boost' ? 15 : 8;

    const grad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.height);
    grad.addColorStop(0, colors[plat.type]);
    grad.addColorStop(1, '#2d3748');
    ctx.fillStyle = grad;

    const r = 4;
    ctx.beginPath();
    ctx.roundRect(plat.x, plat.y, plat.width, plat.height, r);
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

    ctx.fillStyle = '#e74c3c';
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
      if (x === 0) ctx.moveTo(x, lavaTop + wave);
      else ctx.lineTo(x, lavaTop + wave);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  doDoubleJump() {
    if (this.hasDoubleJump && !this.player.doubleJumpUsed && this.player.vy > 0) {
      this.player.vy = -JUMP_FORCE * 0.8 * (1 + this.jumpBonus);
      this.player.doubleJumpUsed = true;
      this.spawnParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height, '#00ccff', 6);
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
