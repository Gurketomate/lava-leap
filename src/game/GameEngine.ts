import type { Player, Platform, Coin, Particle, PowerUp, LevelDefinition, ItemPickup, ActiveEffect, ItemType } from './types';
import {
  GRAVITY, JUMP_FORCE, BOOST_FORCE, MOVE_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT,
  PLATFORM_WIDTH, PLATFORM_HEIGHT, PLATFORM_GAP_MIN, PLATFORM_GAP_MAX, PLATFORMS_BUFFER, getGapScale,
  LAVA_INITIAL_SPEED,
  COIN_RADIUS, COIN_SPAWN_CHANCE, COIN_MAGNET_RANGE,
  CAMERA_SMOOTH, SCORE_SCALE,
  COYOTE_TIME, JUMP_BUFFER_TIME, PLATFORM_HITBOX_PADDING,
  LAVA_TARGET_DISTANCE_RATIO, LAVA_PRESSURE_FACTOR,
  LAVA_MIN_SPEED, LAVA_ADAPTIVE_MAX_SPEED, LAVA_MERCY_SLOW, LAVA_MERCY_THRESHOLD,
  LAVA_SURGE_INTERVAL, LAVA_SURGE_DURATION, LAVA_SURGE_MULTIPLIER,
  NO_SAFE_ZONE_INTERVAL, NO_SAFE_ZONE_DURATION,
  SCREEN_SHAKE_MAX, getRewardCoinCount,
} from './constants';
import { computeReachability, isPlatformReachable, type ReachabilityLimits } from './reachability';
import { runStart, runEnd, deathCause } from './analytics';
import { playJump, playCoin, playDeath, playPowerUp, playLevelComplete, startMusic, stopMusic, startLavaSound, stopLavaSound, updateLavaProximity } from './SoundManager';

type Callback = (data: any) => void;

// Item definitions
const ITEM_DEFINITIONS: { type: ItemType; icon: string; color: string }[] = [
  { type: 'coinMagnet', icon: '🧲', color: '#9b59b6' },
  { type: 'lavaBrake', icon: '❄️', color: '#3498db' },
  { type: 'shield', icon: '🛡️', color: '#f1c40f' },
  { type: 'doubleJump', icon: '🪶', color: '#ecf0f1' },
];

// Item spawn probabilities (weighted)
const ITEM_WEIGHTS: Record<ItemType, number> = {
  coinMagnet: 0.375,  // 3% of 8% ≈ 37.5% of item pool
  lavaBrake: 0.25,    // 2% of 8% ≈ 25%
  shield: 0.25,       // 2% of 8% ≈ 25%
  doubleJump: 0.125,  // 1% of 8% ≈ 12.5%
};

function getItemSpawnChance(levelId: number): number {
  if (levelId <= 5) return 0.05;
  if (levelId <= 15) return 0.07;
  return 0.08;
}

const ITEM_MIN_PLATFORM_GAP = 6;

function pickWeightedItem(): ItemType {
  const r = Math.random();
  let cumulative = 0;
  for (const [type, weight] of Object.entries(ITEM_WEIGHTS)) {
    cumulative += weight;
    if (r <= cumulative) return type as ItemType;
  }
  return 'coinMagnet';
}

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width = 0;
  height = 0;

  player: Player = this.createPlayer();
  platforms: Platform[] = [];
  coins: Coin[] = [];
  particles: Particle[] = [];
  items: ItemPickup[] = [];
  platformsSinceLastItem = 0;
  activeEffects: ActiveEffect[] = [];
  cameraY = 0;
  lavaY = 0;
  lavaSpeed = LAVA_INITIAL_SPEED;
  score = 0;
  coinCount = 0;
  totalCoinsSpawned = 0;
  runDeaths = 0;
  maxHeight = 0;
  startY = 0;
  highestPlatformY = 0;
  inputDir = 0;
  running = false;
  paused = false;
  lastTime = 0;
  animId = 0;
  backgroundLayers: { offset: number; speed: number; shapes: { x: number; y: number; r: number }[] }[] = [];

  // Platform effect timers
  invincibleTimer = 0;
  isInvincible = false;

  // Lava speed multiplier system
  lavaSpeedMults: { mult: number; remaining: number; duration: number }[] = [];

  lastPlatformType: string = 'normal';

  // Level system
  currentLevelDef: LevelDefinition | null = null;
  levelComplete = false;
  levelCompleteTimer = 0;

  // Power-up state (from items)
  hasDoubleJump = false;
  hasCoinMagnet = false;
  hasShield = false;
  lavaSlowStacks = 0;
  platformStabilizerStacks = 0;

  // Permanent upgrade bonuses
  jumpBonus = 0;
  coinSpawnBonus = 0;
  lavaResistBonus = 0;
  startWithShield = false;

  // Fairness assists
  coyoteTimer = 0;
  jumpBufferTimer = 0;
  wasOnGround = false;
  jumpRequested = false;

  // Reachability — always computed with base jump (no upgrades) to guarantee levels are beatable without upgrades
  reachability: ReachabilityLimits = computeReachability(0);

  // Analytics
  runStartTime = 0;

  // Phase tracking
  elapsedTime = 0;

  // No-safe-zone
  noSafeZoneTimer = NO_SAFE_ZONE_INTERVAL;
  inNoSafeZone = false;
  noSafeZoneDuration = 0;

  // Lava surge
  lavaSurgeTimer = LAVA_SURGE_INTERVAL;
  inLavaSurge = false;
  lavaSurgeDuration = 0;

  // Screen shake
  screenShake = 0;

  // Double jump visual timer
  doubleJumpFlashTimer = 0;

  // Last stable platform the player landed on (for revive) — direct reference
  lastLandedPlatformRef: Platform | null = null;

  // Revive grace state
  reviveGraceTimer = 0;
  reviveInputLockTimer = 0;
  reviveLavaPauseTimer = 0;

  // Shield rebound grace state
  shieldGraceTimer = 0;
  shieldInputLockTimer = 0;
  shieldLavaPauseTimer = 0;

  // Callbacks
  onScoreUpdate: Callback = () => {};
  onCoinCollect: Callback = () => {};
  onGameOver: Callback = () => {};
  onLavaProximity: Callback = () => {};
  onPhaseChange: Callback = () => {};
  onScreenShake: Callback = () => {};
  onLevelComplete: Callback = () => {};
  onActiveEffectsUpdate: Callback = () => {};

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
    // Always use base reachability for platform generation — upgrades make it easier, never required
    this.reachability = computeReachability(0);
  }

  setLevel(levelDef: LevelDefinition) {
    this.currentLevelDef = levelDef;
  }

  pickPlatformType(): Platform['type'] {
    const level = this.currentLevelDef;
    if (!level) return 'normal';

    const stabilizerReduction = this.platformStabilizerStacks * 0.05;

    if (this.inNoSafeZone) {
      const r = Math.random();
      if (r < 0.25) return 'moving';
      if (r < 0.45) return 'breakable';
      if (r < 0.55) return 'vanishing';
      if (r < 0.65) return 'reward';
      if (r < 0.75) return 'lavaControl';
      return 'boost';
    }

    const breakable = Math.max(0, level.breakableChance - stabilizerReduction);
    const r = Math.random();
    let cumulative = 0;

    cumulative += level.boostChance;
    if (r < cumulative) return 'boost';
    cumulative += level.rewardChance;
    if (r < cumulative) return 'reward';
    cumulative += level.lavaControlChance;
    if (r < cumulative) return 'lavaControl';
    cumulative += level.dangerChance;
    if (r < cumulative) {
      if (this.lastPlatformType === 'danger') return 'normal';
      return 'danger';
    }
    cumulative += level.invincibleChance;
    if (r < cumulative) return 'invincible';
    cumulative += level.vanishingChance;
    if (r < cumulative) return 'vanishing';
    cumulative += level.movingChance;
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
    this.totalCoinsSpawned = 0;
    this.runDeaths = 0;
    this.platforms = [];
    this.coins = [];
    this.particles = [];
    this.items = [];
    this.platformsSinceLastItem = 0;
    this.activeEffects = [];
    this.lavaSpeedMults = [];
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
    this.reachability = computeReachability(0);
    this.elapsedTime = 0;
    this.noSafeZoneTimer = NO_SAFE_ZONE_INTERVAL;
    this.inNoSafeZone = false;
    this.noSafeZoneDuration = 0;
    this.lavaSurgeTimer = LAVA_SURGE_INTERVAL;
    this.inLavaSurge = false;
    this.lavaSurgeDuration = 0;
    this.screenShake = 0;
    this.doubleJumpFlashTimer = 0;
    this.invincibleTimer = 0;
    this.isInvincible = false;
    this.lastPlatformType = 'normal';
    this.levelComplete = false;
    this.levelCompleteTimer = 0;

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
    startMusic();
    startLavaSound();
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.animId);
    stopMusic();
    stopLavaSound();
  }

  pause() { this.paused = true; }

  resume() {
    this.paused = false;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  setInput(dir: number) {
    if (this.reviveInputLockTimer > 0) return;
    this.inputDir = dir;
  }

  revive() {
    const p = this.player;

    // 1. Respawn on last safe platform (validate it still exists in active platforms)
    let spawnPlat: Platform | null = null;

    if (this.lastLandedPlatformRef && this.platforms.includes(this.lastLandedPlatformRef) && !this.lastLandedPlatformRef.broken) {
      spawnPlat = this.lastLandedPlatformRef;
    }

    if (!spawnPlat) {
      // Fallback: find the highest non-broken normal platform near the player
      const candidates = this.platforms
        .filter(pl => !pl.broken && pl.visible !== false && pl.type !== 'danger' && pl.type !== 'vanishing')
        .sort((a, b) => a.y - b.y); // lowest y = highest on screen
      
      // Pick a platform near the player's last position
      spawnPlat = candidates.find(pl => pl.y < p.y + 100 && pl.y > this.cameraY - 50) || null;
    }

    if (!spawnPlat) {
      // Ultimate fallback: create a platform
      const safeW = 110;
      const safeY = p.y + 20;
      const safeX = Math.max(0, Math.min(this.width - safeW, p.x));
      spawnPlat = {
        x: safeX, y: safeY, width: safeW, height: PLATFORM_HEIGHT,
        type: 'normal', broken: false,
      };
      this.platforms.push(spawnPlat);
    }

    // Use current platform position (handles moving platforms)
    const spawnPlatX = spawnPlat.x;
    const spawnPlatY = spawnPlat.y;
    const spawnPlatW = spawnPlat.width;

    p.x = spawnPlatX + spawnPlatW / 2 - p.width / 2;
    p.y = spawnPlatY - p.height;

    // 2. Reset physics
    p.vx = 0;
    p.vy = 0;
    p.doubleJumpUsed = false;
    this.inputDir = 0;
    this.wasOnGround = true;
    this.coyoteTimer = 0;
    this.jumpRequested = false;
    this.jumpBufferTimer = 0;

    // 3. Push lava down for recovery room (60% of screen below player)
    this.lavaY = Math.max(this.lavaY, p.y + this.height * 0.6);

    // 4. Reachability check — validate the immediate next platform above
    const limits = computeReachability(0);
    const nextPlatformAbove = this.platforms
      .filter((plat) => !plat.broken && !(plat.type === 'vanishing' && plat.visible === false) && plat.y < spawnPlatY)
      .reduce<Platform | null>((closest, plat) => {
        if (!closest) return plat;
        return plat.y > closest.y ? plat : closest; // larger y while still above = nearest above
      }, null);

    const isNextReachable = !!nextPlatformAbove && isPlatformReachable(
      spawnPlatX,
      spawnPlatW,
      spawnPlatY,
      nextPlatformAbove.x,
      nextPlatformAbove.width,
      nextPlatformAbove.y,
      limits,
    );

    if (!isNextReachable) {
      // Spawn temporary rescue platform in guaranteed reachable jump arc
      const safetyW = 110;
      const safetyY = spawnPlatY - Math.max(70, limits.safeVerticalDist * 0.55);
      const safetyX = Math.max(
        0,
        Math.min(this.width - safetyW, spawnPlatX + spawnPlatW / 2 - safetyW / 2),
      );
      this.platforms.push({
        x: safetyX,
        y: safetyY,
        width: safetyW,
        height: PLATFORM_HEIGHT,
        type: 'normal',
        broken: false,
      });
    }

    // 5. Grace timers
    this.reviveGraceTimer = 1.5;  // 1.5 second invulnerability
    this.reviveInputLockTimer = 0.3;
    this.reviveLavaPauseTimer = 1.0;  // lava pause for recovery
    this.cameraY = p.y - this.height * 0.35;
    this.spawnParticles(p.x + p.width / 2, p.y + p.height, '#00ff88', 15);

    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    startMusic();
    startLavaSound();
    this.loop(this.lastTime);
  }

  /** Apply item pickup effect */
  applyItemEffect(type: ItemType) {
    playPowerUp();
    switch (type) {
      case 'coinMagnet':
        this.hasCoinMagnet = true;
        this.addActiveEffect('coinMagnet', 6);
        break;
      case 'lavaBrake':
        this.lavaSpeedMults.push({ mult: 0.4, remaining: 5, duration: 5 });
        this.addActiveEffect('lavaBrake', 5);
        break;
      case 'shield':
        this.hasShield = true;
        // Shield lasts until used, no timer
        break;
      case 'doubleJump':
        this.hasDoubleJump = true;
        this.player.doubleJumpUsed = false;
        // Lasts until next landing after use
        break;
    }
  }

  addActiveEffect(type: ItemType, duration: number) {
    // Remove existing same-type effect and replace
    this.activeEffects = this.activeEffects.filter(e => e.type !== type);
    this.activeEffects.push({ type, remaining: duration, duration });
    this.onActiveEffectsUpdate(this.activeEffects);
  }

  /** Legacy compatibility for permanent shop upgrades */
  applyPowerUp(powerUp: PowerUp) {
    playPowerUp();
    switch (powerUp.type) {
      case 'doubleJump': this.hasDoubleJump = true; break;
      case 'lavaSlow': this.lavaSlowStacks++; break;
      case 'coinMagnet': this.hasCoinMagnet = true; break;
      case 'shield': this.hasShield = true; break;
      case 'platformStabilizer': this.platformStabilizerStacks++; break;
    }
  }

  generatePlatformsUpTo(targetY: number) {
    const lastPlatform = this.platforms.length > 0 ? this.platforms[this.platforms.length - 1] : null;
    const widthMod = this.currentLevelDef?.platformWidthMod ?? 1;
    const levelId = this.currentLevelDef?.id ?? 1;

    while (this.highestPlatformY > targetY) {
      const gapScale = getGapScale(levelId);
      const scaledGapMax = PLATFORM_GAP_MIN + (PLATFORM_GAP_MAX - PLATFORM_GAP_MIN) * gapScale;
      const gap = PLATFORM_GAP_MIN + Math.random() * (scaledGapMax - PLATFORM_GAP_MIN);
      const newY = this.highestPlatformY - gap;
      let newX = Math.random() * (this.width - PLATFORM_WIDTH);

      let type = this.pickPlatformType();
      if (type === 'danger' && newY > this.lavaY - 200) {
        type = 'normal';
      }
      this.lastPlatformType = type;

      const baseWidth = PLATFORM_WIDTH + (type === 'normal' ? Math.random() * 20 : 0);
      const platWidth = baseWidth * widthMod;

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
      }

      const platform: Platform = {
        x: newX, y: newY,
        width: platWidth,
        height: PLATFORM_HEIGHT,
        type, broken: false,
      };

      if (type === 'moving') {
        const speedScale = levelId >= 35 ? 1.3 + (levelId - 35) * 0.04 : 1.0;
        platform.moveSpeed = (60 + Math.random() * 80) * speedScale;
        platform.moveRange = (50 + Math.random() * 80) * (levelId >= 30 ? 1.15 : 1.0);
        platform.moveDir = Math.random() > 0.5 ? 1 : -1;
        platform.originX = newX;
      }

      if (type === 'vanishing') {
        platform.vanishTimer = 0;
        // Shorter vanish windows in late game
        const vanishBase = levelId >= 35 ? 1.5 : 2.0;
        const vanishRange = levelId >= 35 ? 1.0 : 1.5;
        platform.vanishDuration = vanishBase + Math.random() * vanishRange;
        platform.visible = true;
      }

      // Reward platforms: narrower, mostly static for clarity
      if (type === 'reward') {
        platform.width = Math.max(30, platWidth * 0.55);
        // Only 15% of reward platforms move (rare challenge)
        if (Math.random() < 0.15) {
          platform.moveSpeed = 40 + Math.random() * 50;
          platform.moveRange = 40 + Math.random() * 50;
          platform.moveDir = Math.random() > 0.5 ? 1 : -1;
          platform.originX = newX;
        }
        platform.y -= 8 + Math.random() * 12;

        const safeWidth = (PLATFORM_WIDTH + 20) * widthMod;
        let safeX: number;
        if (newX > this.width / 2) {
          safeX = Math.max(0, newX - 90 - Math.random() * 60);
        } else {
          safeX = Math.min(this.width - safeWidth, newX + platWidth + 40 + Math.random() * 60);
        }
        const safeY = newY + (Math.random() * 10 - 3);
        this.platforms.push({
          x: safeX, y: safeY,
          width: safeWidth, height: PLATFORM_HEIGHT,
          type: 'normal', broken: false,
        });

        for (let sc = 0; sc < 2; sc++) {
          this.coins.push({
            x: safeX + safeWidth / 2 + (sc - 0.5) * 18,
            y: safeY - 25,
            radius: COIN_RADIUS,
            collected: false,
            angle: 0,
          });
        }
      }

      this.platforms.push(platform);

      // Coin spawning
      const rewardCoins = getRewardCoinCount(levelId);
      const coinChance = type === 'reward' ? 1.0 : COIN_SPAWN_CHANCE + this.coinSpawnBonus;
      if (Math.random() < coinChance) {
        const coinCount = type === 'reward' ? rewardCoins : 1;
        this.totalCoinsSpawned += coinCount;

        const actualWidth = platform.width;
        const platCenterX = platform.x + actualWidth / 2;
        const isMoving = !!(platform.moveSpeed);

        if (coinCount <= 1) {
          const coinY = platform.y - 25;
          const coin: Coin = {
            x: platCenterX,
            y: coinY,
            radius: COIN_RADIUS,
            collected: false,
            angle: 0,
            ...(isMoving ? { linkedPlatform: platform, offsetX: 0, offsetY: coinY - platform.y } : {}),
          };
          this.coins.push(coin);
        } else {
          const maxSpread = Math.min(actualWidth * 0.8, coinCount * 14);
          const spacing = maxSpread / Math.max(coinCount - 1, 1);
          const pattern = Math.random();

          if (pattern < 0.45) {
            // Arc pattern — centered on platform
            const halfCount = (coinCount - 1) / 2;
            for (let c = 0; c < coinCount; c++) {
              const t = (c - halfCount) / Math.max(halfCount, 1);
              const arcHeight = 14 * (1 - t * t);
              const offsetX = t * halfCount * spacing;
              const coinY = platform.y - 22 - arcHeight;
              this.coins.push({
                x: platCenterX + offsetX,
                y: coinY,
                radius: COIN_RADIUS,
                collected: false,
                angle: 0,
                ...(isMoving ? { linkedPlatform: platform, offsetX, offsetY: coinY - platform.y } : {}),
              });
            }
          } else {
            // Vertical column — centered on platform
            for (let c = 0; c < coinCount; c++) {
              const coinY = platform.y - 22 - c * 13;
              this.coins.push({
                x: platCenterX,
                y: coinY,
                radius: COIN_RADIUS,
                collected: false,
                angle: 0,
                ...(isMoving ? { linkedPlatform: platform, offsetX: 0, offsetY: coinY - platform.y } : {}),
              });
            }
          }
        }
      }

      // Item pickup spawning (rare, distance-gated, never on breakable)
      this.platformsSinceLastItem++;
      const platIndex = this.platforms.length - 1;
      const spawnChance = getItemSpawnChance(levelId);
      if (['normal', 'moving'].includes(type) && newY < this.lavaY - 300 && this.platformsSinceLastItem >= ITEM_MIN_PLATFORM_GAP) {
        if (Math.random() < spawnChance) {
          const itemType = pickWeightedItem();
          const itemDef = ITEM_DEFINITIONS.find(d => d.type === itemType)!;
          const itemY = newY - 20;
          this.items.push({
            x: newX + platWidth / 2,
            y: itemY,
            type: itemDef.type,
            collected: false,
            ...(platform.moveSpeed ? { linkedPlatform: platform, offsetX: 0, offsetY: itemY - platform.y } : {}),
          });
          this.platformsSinceLastItem = 0;
        }
      }

      this.highestPlatformY = newY;
    }
  }

  update(dt: number) {
    if (dt > 0.05) dt = 0.05;

    // Level complete animation
    if (this.levelComplete) {
      this.levelCompleteTimer += dt;
      const targetCameraY = this.player.y - this.height * 0.4;
      this.cameraY += (targetCameraY - this.cameraY) * 0.03;
      if (this.levelCompleteTimer > 1.5) {
        this.running = false;
        this.onLevelComplete({ score: this.score, coins: this.coinCount });
      }
      return;
    }

    this.elapsedTime += dt;

    // Update lava speed multiplier timers
    for (const m of this.lavaSpeedMults) {
      m.remaining -= dt;
    }
    this.lavaSpeedMults = this.lavaSpeedMults.filter(m => m.remaining > 0);

    // Update active effects timers
    let effectsChanged = false;
    for (const e of this.activeEffects) {
      e.remaining -= dt;
    }
    const beforeLen = this.activeEffects.length;
    this.activeEffects = this.activeEffects.filter(e => {
      if (e.remaining <= 0) {
        // Effect expired — clean up
        if (e.type === 'coinMagnet') this.hasCoinMagnet = false;
        return false;
      }
      return true;
    });
    if (this.activeEffects.length !== beforeLen) effectsChanged = true;
    if (effectsChanged) this.onActiveEffectsUpdate(this.activeEffects);

    // Grace timers
    if (this.reviveGraceTimer > 0) this.reviveGraceTimer -= dt;
    if (this.reviveInputLockTimer > 0) {
      this.reviveInputLockTimer -= dt;
      this.inputDir = 0;
    }
    if (this.reviveLavaPauseTimer > 0) this.reviveLavaPauseTimer -= dt;
    if (this.shieldGraceTimer > 0) this.shieldGraceTimer -= dt;
    if (this.shieldInputLockTimer > 0) {
      this.shieldInputLockTimer -= dt;
      this.jumpRequested = false;
      this.jumpBufferTimer = 0;
    }
    if (this.shieldLavaPauseTimer > 0) this.shieldLavaPauseTimer -= dt;

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

    if (this.doubleJumpFlashTimer > 0) this.doubleJumpFlashTimer -= dt;

    const p = this.player;

    // Gravity
    p.vy += GRAVITY * dt;
    p.vx = this.inputDir * MOVE_SPEED;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Screen wrap
    if (p.x + p.width < 0) p.x = this.width;
    if (p.x > this.width) p.x = -p.width;

    // Coyote time
    if (this.wasOnGround && p.vy > 0) this.coyoteTimer += dt;
    if (this.coyoteTimer > COYOTE_TIME) { this.wasOnGround = false; this.coyoteTimer = 0; }

    // Jump buffer
    if (this.jumpRequested) {
      this.jumpBufferTimer += dt;
      if (this.jumpBufferTimer > JUMP_BUFFER_TIME) { this.jumpRequested = false; this.jumpBufferTimer = 0; }
    }

    // Platform collision (only falling)
    if (p.vy > 0) {
      for (const plat of this.platforms) {
        if (plat.broken) continue;
        if (plat.type === 'vanishing' && plat.visible === false) continue;

        const platLeft = plat.x - PLATFORM_HITBOX_PADDING;
        const platRight = plat.x + plat.width + PLATFORM_HITBOX_PADDING;

        if (
          p.x + p.width > platLeft &&
          p.x < platRight &&
          p.y + p.height >= plat.y &&
          p.y + p.height <= plat.y + plat.height + p.vy * dt + 5
        ) {
          if (plat.type === 'boost') {
            this.performJump('boost', BOOST_FORCE / JUMP_FORCE);
            this.spawnParticles(p.x + p.width / 2, p.y + p.height, '#ff6600', 8);
            playJump(1.0);
          } else if (plat.type === 'breakable' || plat.type === 'reward') {
            this.performJump('normal', 1.0);
            plat.broken = true;
            this.spawnParticles(plat.x + plat.width / 2, plat.y, plat.type === 'reward' ? '#ffd700' : '#888888', 8);
            playJump(0.5);
          } else if (plat.type === 'lavaControl') {
            // Blue ice platform — slow lava by 40% for 4 seconds
            this.performJump('normal', 1.0);
            this.lavaSpeedMults.push({ mult: 0.6, remaining: 4, duration: 4 });
            this.spawnParticles(plat.x + plat.width / 2, plat.y, '#00ccff', 10);
            this.spawnParticles(plat.x + plat.width / 2, plat.y, '#88ddff', 6);
            this.screenShake = 0.15;
            plat.broken = true;
            playJump(0.7);
          } else if (plat.type === 'danger') {
            // Red danger platform — speed up lava by 40% for 4 seconds
            this.performJump('normal', 1.0);
            this.lavaSpeedMults.push({ mult: 1.4, remaining: 4, duration: 4 });
            this.spawnParticles(plat.x + plat.width / 2, plat.y, '#ff3333', 10);
            this.spawnParticles(plat.x + plat.width / 2, plat.y, '#ff6600', 6);
            this.screenShake = 0.3;
            plat.broken = true;
            playJump(0.6);
          } else if (plat.type === 'invincible') {
            this.performJump('normal', 1.0);
            this.isInvincible = true;
            this.invincibleTimer = 3.0;
            this.spawnParticles(plat.x + plat.width / 2, plat.y, '#ffdd00', 12);
            plat.broken = true;
            playPowerUp();
          } else if (plat.type === 'vanishing') {
            this.performJump('normal', 1.0);
            plat.vanishTimer = plat.vanishDuration || 2.5;
            playJump(0.3);
          } else {
            this.performJump('normal', 1.0);
            this.screenShake = 0.08; // subtle landing feedback
            playJump(0.4);
          }

          p.y = plat.y - p.height;

          // Track last landed platform for revive (only stable types)
          if (!plat.broken && plat.type !== 'breakable' && plat.type !== 'vanishing' && plat.type !== 'reward') {
            this.lastLandedPlatform = { x: plat.x, y: plat.y, width: plat.width };
          }

          break;
        }
      }
    }

    // Moving platforms
    for (const plat of this.platforms) {
      if (plat.type === 'moving' && !plat.broken && plat.originX !== undefined) {
        plat.x += (plat.moveDir || 1) * (plat.moveSpeed || 60) * dt;
        const range = plat.moveRange || 80;
        if (plat.x > plat.originX + range || plat.x < plat.originX - range) {
          plat.moveDir = -(plat.moveDir || 1);
          plat.x = Math.max(plat.originX - range, Math.min(plat.originX + range, plat.x));
        }
        plat.x = Math.max(0, Math.min(this.width - plat.width, plat.x));
      }

      if (plat.type === 'reward' && !plat.broken && plat.originX !== undefined && plat.moveSpeed) {
        plat.x += (plat.moveDir || 1) * (plat.moveSpeed || 60) * dt;
        const range = plat.moveRange || 70;
        if (plat.x > plat.originX + range || plat.x < plat.originX - range) {
          plat.moveDir = -(plat.moveDir || 1);
          plat.x = Math.max(plat.originX - range, Math.min(plat.originX + range, plat.x));
        }
        plat.x = Math.max(0, Math.min(this.width - plat.width, plat.x));
      }

      if ((plat.type === 'breakable') && plat.broken) {
        if (plat.breakTimer === undefined) plat.breakTimer = 4.0;
        plat.breakTimer -= dt;
        if (plat.breakTimer <= 0) {
          if (plat.y > this.cameraY - 50 && plat.y < this.lavaY - 50) {
            plat.broken = false;
            plat.breakTimer = undefined;
          }
        }
      }

      if (plat.type === 'vanishing' && !plat.broken && plat.vanishTimer !== undefined && plat.vanishTimer > 0) {
        plat.vanishTimer -= dt;
        if (plat.vanishTimer <= 0) {
          plat.visible = false;
          plat.broken = true;
          this.spawnParticles(plat.x + plat.width / 2, plat.y, 'rgba(200,200,255,0.8)', 6);
        }
      }
    }

    this.ensureReachablePlatform();

    // Invincibility timer
    if (this.isInvincible) {
      this.invincibleTimer -= dt;
      if (this.invincibleTimer <= 0) this.isInvincible = false;
    }

    // Item pickup collision
    for (const item of this.items) {
      if (item.collected) continue;
      const dx = (p.x + p.width / 2) - item.x;
      const dy = (p.y + p.height / 2) - item.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 25) {
        item.collected = true;
        this.applyItemEffect(item.type);
        const def = ITEM_DEFINITIONS.find(d => d.type === item.type);
        this.spawnParticles(item.x, item.y, def?.color || '#fff', 10);
      }
    }

    // Camera follow
    const targetCameraY = p.y - this.height * 0.35;
    if (targetCameraY < this.cameraY) {
      this.cameraY += (targetCameraY - this.cameraY) * CAMERA_SMOOTH * 60 * dt;
    }

    // === ADAPTIVE LAVA SYSTEM (speed-based) ===
    const lavaSlowMult = Math.pow(0.7, this.lavaSlowStacks);
    const levelSpeedMod = this.currentLevelDef?.lavaSpeedMod ?? 1;

    let endAccel = 1;
    if (this.currentLevelDef) {
      const progress = this.score / this.currentLevelDef.targetHeight;
      if (progress > 0.8) {
        const endProgress = (progress - 0.8) / 0.2;
        endAccel = 1 + (this.currentLevelDef.lavaEndAccel - 1) * endProgress;
      }
    }

    // Lava surge
    if (!this.inLavaSurge) {
      this.lavaSurgeTimer -= dt;
      if (this.lavaSurgeTimer <= 0) {
        this.inLavaSurge = true;
        this.lavaSurgeDuration = LAVA_SURGE_DURATION;
      }
    } else {
      this.lavaSurgeDuration -= dt;
      if (this.lavaSurgeDuration <= 0) {
        this.inLavaSurge = false;
        this.lavaSurgeTimer = LAVA_SURGE_INTERVAL;
      }
    }

    const targetDistance = this.height * LAVA_TARGET_DISTANCE_RATIO;
    const currentDistance = this.lavaY - (p.y + p.height);
    const mercyDist = this.height * LAVA_MERCY_THRESHOLD;

    const baseSpeed = LAVA_INITIAL_SPEED * levelSpeedMod * endAccel * (1 - this.lavaResistBonus);
    let adaptiveSpeed = baseSpeed + (currentDistance - targetDistance) * LAVA_PRESSURE_FACTOR;

    if (currentDistance < mercyDist) adaptiveSpeed *= LAVA_MERCY_SLOW;
    if (this.inLavaSurge) adaptiveSpeed *= LAVA_SURGE_MULTIPLIER;
    adaptiveSpeed *= lavaSlowMult;

    // Apply platform-based and item-based speed multipliers (smooth blend)
    let platformSpeedMult = 1;
    for (const m of this.lavaSpeedMults) {
      // Smooth transition: fade in/out over 0.5s
      const fadeIn = Math.min(1, (m.duration - m.remaining) / 0.5);
      const fadeOut = Math.min(1, m.remaining / 0.5);
      const blend = Math.min(fadeIn, fadeOut);
      platformSpeedMult *= 1 + (m.mult - 1) * blend;
    }
    adaptiveSpeed *= platformSpeedMult;

    adaptiveSpeed = Math.max(LAVA_MIN_SPEED * lavaSlowMult, Math.min(LAVA_ADAPTIVE_MAX_SPEED, adaptiveSpeed));

    this.lavaSpeed = adaptiveSpeed;
    if (this.reviveLavaPauseTimer <= 0 && this.shieldLavaPauseTimer <= 0) {
      this.lavaY -= adaptiveSpeed * dt;
    }

    // Lava proximity
    const proximity = 1 - Math.min(1, Math.max(0, currentDistance / (this.height * 0.5)));
    this.onLavaProximity(proximity);
    updateLavaProximity(proximity);

    // Screen shake
    this.screenShake = proximity > 0.6 ? (proximity - 0.6) * 2.5 : 0;
    this.onScreenShake(this.screenShake);

    // Score
    const heightReached = Math.max(0, this.startY - p.y);
    this.score = Math.floor(heightReached / SCORE_SCALE);
    this.onScoreUpdate(this.score);

    // Level complete
    if (this.currentLevelDef && this.score >= this.currentLevelDef.targetHeight && !this.levelComplete) {
      this.levelComplete = true;
      this.levelCompleteTimer = 0;
      this.lavaY = this.lavaY + 200;
      stopMusic();
      stopLavaSound();
      playLevelComplete();
      return;
    }

    // Update platform-linked coins & items (move with platform)
    for (const coin of this.coins) {
      if (coin.collected || !coin.linkedPlatform) continue;
      const plat = coin.linkedPlatform;
      if (plat.broken) continue;
      coin.x = plat.x + plat.width / 2 + (coin.offsetX ?? 0);
      coin.y = plat.y + (coin.offsetY ?? -25);
    }
    for (const item of this.items) {
      if (item.collected || !item.linkedPlatform) continue;
      const plat = item.linkedPlatform;
      if (plat.broken) continue;
      item.x = plat.x + plat.width / 2 + (item.offsetX ?? 0);
      item.y = plat.y + (item.offsetY ?? -20);
    }

    // Coin collection
    for (const coin of this.coins) {
      if (coin.collected) continue;
      const dx = (p.x + p.width / 2) - coin.x;
      const dy = (p.y + p.height / 2) - coin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (this.hasCoinMagnet && dist < COIN_MAGNET_RANGE) {
        // Detach from platform so magnet pull works freely
        coin.linkedPlatform = undefined;
        const t = 1 - (dist / COIN_MAGNET_RANGE);
        const pullStrength = 200 + 600 * t * t;
        const speed = pullStrength * dt;
        const nx = dx / dist;
        const ny = dy / dist;
        const perpX = -ny * 0.3 * (1 - t);
        const perpY = nx * 0.3 * (1 - t);
        coin.x += (nx + perpX) * speed;
        coin.y += (ny + perpY) * speed;
      }

      if (dist < coin.radius + 20) {
        coin.collected = true;
        this.coinCount++;
        this.onCoinCollect(this.coinCount);
        this.spawnParticles(coin.x, coin.y, '#ffd700', 5);
        playCoin();
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

    this.generatePlatformsUpTo(this.cameraY - PLATFORMS_BUFFER);

    // Cleanup
    this.platforms = this.platforms.filter((pl) => pl.y < this.lavaY + 100);
    this.coins = this.coins.filter((c) => !c.collected && c.y < this.lavaY + 100);
    this.items = this.items.filter((i) => !i.collected && i.y < this.lavaY + 100);

    // Game over checks
    if (p.y + p.height > this.lavaY) {
      if (this.reviveGraceTimer > 0) {
        p.vy = -JUMP_FORCE * 0.5;
        p.y = this.lavaY - p.height - 5;
      } else if (this.isInvincible) {
        p.vy = -JUMP_FORCE;
        p.y = this.lavaY - p.height - 5;
        this.spawnParticles(p.x + p.width / 2, p.y + p.height, '#ffdd00', 10);
      } else if (this.shieldGraceTimer > 0) {
        p.vy = -JUMP_FORCE * 0.5;
        p.y = this.lavaY - p.height - 5;
      } else if (this.hasShield || this.isInvincible) {
        this.activateShieldRebound();
      } else {
        this.running = false;
        deathCause('lava');
        runEnd(this.score, (performance.now() - this.runStartTime) / 1000);
        stopMusic();
        stopLavaSound();
        playDeath();
        this.onGameOver({ score: this.score, coins: this.coinCount });
        return;
      }
    }
    if (p.y > this.cameraY + this.height + 100) {
      if (this.shieldGraceTimer > 0) {
        p.vy = -JUMP_FORCE * 0.5;
        p.y = this.cameraY + this.height;
      } else if (this.hasShield || this.isInvincible) {
        this.activateShieldRebound();
      } else {
        this.running = false;
        deathCause('fall');
        runEnd(this.score, (performance.now() - this.runStartTime) / 1000);
        stopMusic();
        stopLavaSound();
        playDeath();
        this.onGameOver({ score: this.score, coins: this.coinCount });
        return;
      }
    }
  }

  activateShieldRebound() {
    const p = this.player;
    if (this.hasShield) {
      this.hasShield = false;
    } else if (this.isInvincible) {
      this.isInvincible = false;
      this.invincibleTimer = 0;
    }

    p.vx = 0;
    p.y = Math.min(p.y, this.lavaY - p.height - 5);
    this.performJump('shieldRebound', 1.4);

    this.shieldGraceTimer = 0.5;
    this.shieldInputLockTimer = 0.2;
    this.shieldLavaPauseTimer = 0.3;
    this.spawnParticles(p.x + p.width / 2, p.y + p.height, '#00aaff', 18);
    this.spawnParticles(p.x + p.width / 2, p.y + p.height, '#ffffff', 8);
    this.screenShake = 0.4;
    playPowerUp();
  }

  ensureReachablePlatform() {
    const p = this.player;
    const visibleTop = this.cameraY - 50;
    const visibleBottom = this.cameraY + this.height + 50;

    const activePlatforms = this.platforms.filter(
      pl => !pl.broken && (pl.visible !== false) &&
        pl.y >= visibleTop && pl.y <= visibleBottom
    );

    const hasReachable = activePlatforms.some(pl => {
      const vertDist = p.y - pl.y;
      if (vertDist < -50) return false;
      if (vertDist > this.reachability.safeVerticalDist) return false;
      return true;
    });

    if (!hasReachable && activePlatforms.length < 3) {
      const safeY = p.y - 60 - Math.random() * 40;
      const safeW = PLATFORM_WIDTH * 1.2;
      const safeX = Math.max(10, Math.min(this.width - safeW - 10, p.x - safeW / 2 + (Math.random() - 0.5) * 60));
      this.platforms.push({
        x: safeX, y: safeY, width: safeW, height: PLATFORM_HEIGHT,
        type: 'normal', broken: false,
      });
    }
  }

  spawnParticles(x: number, y: number, color: string, count: number) {
    // Cap total particles for performance
    const MAX_PARTICLES = 150;
    const spawnCount = Math.min(count, MAX_PARTICLES - this.particles.length);
    for (let i = 0; i < spawnCount; i++) {
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

    // Render item pickups
    for (const item of this.items) {
      if (item.collected) continue;
      if (item.y < this.cameraY - 50 || item.y > this.cameraY + h + 50) continue;
      this.renderItem(ctx, item);
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

    // Invincibility aura
    if (this.isInvincible) {
      const pulse = Math.sin(performance.now() / 100) * 0.3 + 0.7;
      ctx.strokeStyle = `rgba(255, 220, 0, ${pulse * 0.7})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffdd00';
      ctx.shadowBlur = 15;
      const px = this.player.x + this.player.width / 2;
      const py = this.player.y + this.player.height / 2 - this.cameraY;
      ctx.beginPath();
      ctx.arc(px, py, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Lava edge glow overlay — intensity based on lava speed
    const distToLava = this.lavaY - (this.player.y + this.player.height);
    const prox = 1 - Math.min(1, Math.max(0, distToLava / 400));
    
    // Lava speed glow modifier: faster = brighter, slower = darker
    const baseSpeedRef = LAVA_INITIAL_SPEED * (this.currentLevelDef?.lavaSpeedMod ?? 1);
    const speedRatio = Math.min(2, this.lavaSpeed / Math.max(1, baseSpeedRef));
    const glowIntensity = 0.5 + speedRatio * 0.5; // 0.5-1.5 range

    if (prox > 0.2) {
      const intensity = (prox - 0.2) * 1.25 * glowIntensity;
      const grad = ctx.createLinearGradient(0, h, 0, h - h * Math.min(1, intensity) * 0.5);
      grad.addColorStop(0, `rgba(255, 40, 0, ${Math.min(1, intensity * 0.35)})`);
      grad.addColorStop(1, 'rgba(255, 40, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const sideGrad = ctx.createLinearGradient(0, 0, w * 0.15, 0);
      sideGrad.addColorStop(0, `rgba(255, 30, 0, ${Math.min(1, intensity * 0.2)})`);
      sideGrad.addColorStop(1, 'rgba(255, 30, 0, 0)');
      ctx.fillStyle = sideGrad;
      ctx.fillRect(0, 0, w * 0.15, h);

      const sideGrad2 = ctx.createLinearGradient(w, 0, w * 0.85, 0);
      sideGrad2.addColorStop(0, `rgba(255, 30, 0, ${Math.min(1, intensity * 0.2)})`);
      sideGrad2.addColorStop(1, 'rgba(255, 30, 0, 0)');
      ctx.fillStyle = sideGrad2;
      ctx.fillRect(w * 0.85, 0, w * 0.15, h);

      if (intensity > 0.4) {
        ctx.globalAlpha = Math.min(1, (intensity - 0.4) * 0.3);
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

    // No-safe-zone warning
    if (this.inNoSafeZone) {
      const flash = Math.sin(performance.now() / 150) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255, 0, 0, ${flash * 0.08})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Level progress indicator
    if (this.currentLevelDef) {
      const progress = Math.min(1, this.score / this.currentLevelDef.targetHeight);
      const barW = 4;
      const barH = h * 0.6;
      const barX = w - 14;
      const barY = (h - barH) / 2;

      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(barX, barY, barW, barH);

      const fillH = barH * progress;
      const barGrad = ctx.createLinearGradient(barX, barY + barH - fillH, barX, barY + barH);
      barGrad.addColorStop(0, 'rgba(255, 200, 0, 0.8)');
      barGrad.addColorStop(1, 'rgba(255, 80, 0, 0.8)');
      ctx.fillStyle = barGrad;
      ctx.fillRect(barX, barY + barH - fillH, barW, fillH);

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(barX - 2, barY - 2, barW + 4, 2);
    }

    if (this.levelComplete) {
      const alpha = Math.min(1, this.levelCompleteTimer * 0.8);
      ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.15})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
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
    if (plat.type === 'vanishing' && plat.visible === false) return;

    const colors: Record<string, string> = {
      normal: '#4a5568',
      breakable: '#a0522d',
      moving: '#4682b4',
      boost: '#ff6600',
      reward: '#9b59b6',
      lavaControl: '#3498db',
      danger: '#cc2200',
      invincible: '#ffcc00',
      vanishing: '#8899aa',
    };

    const glowColors: Record<string, string> = {
      normal: 'rgba(74, 85, 104, 0.3)',
      breakable: 'rgba(160, 82, 45, 0.3)',
      moving: 'rgba(70, 130, 180, 0.4)',
      boost: 'rgba(255, 102, 0, 0.5)',
      reward: 'rgba(155, 89, 182, 0.6)',
      lavaControl: 'rgba(52, 152, 219, 0.5)',
      danger: 'rgba(204, 34, 0, 0.6)',
      invincible: 'rgba(255, 204, 0, 0.6)',
      vanishing: 'rgba(136, 153, 170, 0.4)',
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
      const pulse = Math.sin(performance.now() / 200) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(200, 150, 255, ${pulse})`;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💎', plat.x + plat.width / 2, plat.y + 11);
    }

    if (plat.type === 'lavaControl') {
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('❄', plat.x + plat.width / 2, plat.y + 11);
    }

    if (plat.type === 'danger') {
      const pulse = Math.sin(performance.now() / 150) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(255, 80, 30, ${pulse})`;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔥', plat.x + plat.width / 2, plat.y + 11);
    }

    if (plat.type === 'invincible') {
      const pulse = Math.sin(performance.now() / 180) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(255, 220, 0, ${pulse})`;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⭐', plat.x + plat.width / 2, plat.y + 11);
    }

    if (plat.type === 'vanishing') {
      const timer = plat.vanishTimer ?? 0;
      if (timer > 0 && timer < 1.0) {
        const flicker = Math.sin(performance.now() / 80) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + flicker * 0.7;
      }
      ctx.fillStyle = 'rgba(200,200,255,0.6)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('◌', plat.x + plat.width / 2, plat.y + 11);
      ctx.globalAlpha = 1;
    }
  }

  renderItem(ctx: CanvasRenderingContext2D, item: ItemPickup) {
    const def = ITEM_DEFINITIONS.find(d => d.type === item.type);
    if (!def) return;

    const time = performance.now() / 1000;
    const bobY = Math.sin(time * 3 + item.x) * 4;
    const pulse = Math.sin(time * 4) * 0.2 + 0.8;

    // Glow
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 12 * pulse;

    // Background circle
    ctx.fillStyle = def.color + '40';
    ctx.beginPath();
    ctx.arc(item.x, item.y + bobY, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = def.color + '80';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Icon
    ctx.shadowBlur = 0;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, item.x, item.y + bobY);
    ctx.textBaseline = 'alphabetic';
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

    // Glow intensity based on lava speed
    const baseSpeedRef = LAVA_INITIAL_SPEED * (this.currentLevelDef?.lavaSpeedMod ?? 1);
    const speedRatio = Math.min(2, this.lavaSpeed / Math.max(1, baseSpeedRef));
    const glowAlpha = 0.15 + speedRatio * 0.2; // 0.15 - 0.55

    const glowGrad = ctx.createLinearGradient(0, lavaTop - 80, 0, lavaTop);
    glowGrad.addColorStop(0, 'rgba(255, 60, 0, 0)');
    glowGrad.addColorStop(1, `rgba(255, 60, 0, ${glowAlpha})`);
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, lavaTop - 80, this.width, 80);

    // Lava body color shifts with speed
    const r1 = Math.min(255, Math.round(255 * (0.8 + speedRatio * 0.2)));
    const g1 = Math.max(0, Math.round(69 - speedRatio * 20));

    const lavaGrad = ctx.createLinearGradient(0, lavaTop, 0, lavaBottom);
    lavaGrad.addColorStop(0, `rgb(${r1}, ${g1}, 0)`);
    lavaGrad.addColorStop(0.3, '#ff2200');
    lavaGrad.addColorStop(1, '#8b0000');
    ctx.fillStyle = lavaGrad;

    ctx.beginPath();
    ctx.moveTo(0, lavaBottom);
    const time = performance.now() / 1000;
    const waveAmp = 4 + speedRatio * 4; // faster = bigger waves
    for (let x = 0; x <= this.width; x += 5) {
      const wave = Math.sin(x * 0.02 + time * 3) * waveAmp + Math.sin(x * 0.05 + time * 2) * (waveAmp * 0.5);
      ctx.lineTo(x, lavaTop + wave);
    }
    ctx.lineTo(this.width, lavaBottom);
    ctx.closePath();
    ctx.fill();

    const edgeGlow = 10 + speedRatio * 10;
    ctx.strokeStyle = `rgba(255, ${Math.round(100 + speedRatio * 70)}, 0, ${0.6 + speedRatio * 0.2})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = edgeGlow;
    ctx.beginPath();
    for (let x = 0; x <= this.width; x += 5) {
      const wave = Math.sin(x * 0.02 + time * 3) * waveAmp + Math.sin(x * 0.05 + time * 2) * (waveAmp * 0.5);
      if (x === 0) ctx.moveTo(x, lavaTop + wave); else ctx.lineTo(x, lavaTop + wave);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  performJump(type: 'normal' | 'double' | 'boost' | 'shieldRebound', forceMult = 1.0) {
    const p = this.player;
    const baseForce = JUMP_FORCE * (1 + this.jumpBonus);

    p.vy = 0;
    p.vy = -baseForce * forceMult;

    if (type !== 'double') {
      p.doubleJumpUsed = false;
      this.wasOnGround = true;
      this.coyoteTimer = 0;
    }

    if (this.jumpRequested) {
      this.jumpRequested = false;
      this.jumpBufferTimer = 0;
    }
  }

  doDoubleJump() {
    if (this.shieldGraceTimer > 0) return;
    if (this.shieldInputLockTimer > 0 || this.reviveInputLockTimer > 0) return;
    if (this.wasOnGround) return;

    if (this.hasDoubleJump && !this.player.doubleJumpUsed) {
      this.player.doubleJumpUsed = true;
      this.performJump('double', 1.25);
      this.doubleJumpFlashTimer = 0.3;
      this.spawnParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height, '#ffffff', 10);
      this.spawnParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height, '#ccddff', 6);
      playJump(0.8);
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
