export const GRAVITY = 1800;
export const JUMP_FORCE = 680;
export const BOOST_FORCE = 950;
export const MOVE_SPEED = 400;
export const PLAYER_WIDTH = 32;
export const PLAYER_HEIGHT = 40;

export const PLATFORM_WIDTH = 70;
export const PLATFORM_HEIGHT = 14;
export const PLATFORM_GAP_MIN = 60;
export const PLATFORM_GAP_MAX = 120;

// Gap scaling per level (multiplier on gap range) — capped to stay within base jump reach
export function getGapScale(levelId: number): number {
  if (levelId <= 15) return 1.0;
  if (levelId <= 30) return 1.0 + (levelId - 15) * 0.008; // up to 1.12
  if (levelId <= 50) return 1.12 + (levelId - 30) * 0.006; // up to 1.24
  return 1.24;
}
export const PLATFORMS_BUFFER = 800;

export const LAVA_INITIAL_SPEED = 30;
export const LAVA_ACCELERATION = 0.15; // legacy, unused by adaptive system

export const COIN_RADIUS = 10;
export const COIN_SPAWN_CHANCE = 0.35;
export const COIN_MAGNET_RANGE = 280;

export const CAMERA_SMOOTH = 0.08;
export const SCORE_SCALE = 10; // pixels per point


export const BREAKABLE_CHANCE_BASE = 0.15;
export const MOVING_CHANCE_BASE = 0.1;
export const BOOST_CHANCE_BASE = 0.08;

// Fairness assists (hidden)
export const COYOTE_TIME = 0.08; // 80ms
export const JUMP_BUFFER_TIME = 0.1; // 100ms
export const PLATFORM_HITBOX_PADDING = 6; // px extra on each side

// Difficulty scaling per 1000 score (legacy, now overridden by phases)
export const DIFFICULTY_BREAKABLE_SCALE = 0.02;
export const DIFFICULTY_MOVING_SCALE = 0.015;
export const DIFFICULTY_LAVA_ACCEL_SCALE = 0.02;

// Adaptive lava system
export const LAVA_TARGET_DISTANCE_RATIO = 0.30; // 30% of screen height
export const LAVA_PRESSURE_FACTOR = 2.5; // how aggressively lava chases
export const LAVA_MIN_SPEED = 20; // minimum lava speed
export const LAVA_ADAPTIVE_MAX_SPEED = 400; // max adaptive speed
export const LAVA_MERCY_SLOW = 0.6; // speed multiplier when player is close to death
export const LAVA_MERCY_THRESHOLD = 0.15; // 15% screen height = critical

// Lava surge
export const LAVA_SURGE_INTERVAL = 20; // seconds between surges
export const LAVA_SURGE_DURATION = 2; // seconds
export const LAVA_SURGE_MULTIPLIER = 1.4; // +40% speed during surge

// Risk/reward
export const REWARD_PLATFORM_COIN_MULT = 5;
export const REWARD_PLATFORM_CHANCE = 0.04;
export const NO_SAFE_ZONE_INTERVAL = 45; // seconds between no-safe-zone events
export const NO_SAFE_ZONE_DURATION = 5; // seconds

// Screen shake
export const SCREEN_SHAKE_MAX = 8; // max px offset

// Difficulty phases (time-based, used within levels)
import type { DifficultyPhase, LevelDefinition } from './types';

export const DIFFICULTY_PHASES: DifficultyPhase[] = [
  { minTime: 0,   normalChance: 0.90, breakableChance: 0.02, movingChance: 0.00, boostChance: 0.08, rewardChance: 0.00, platformWidthMod: 1.15, lavaSpeedMod: 1.0 },
  { minTime: 30,  normalChance: 0.62, breakableChance: 0.08, movingChance: 0.20, boostChance: 0.08, rewardChance: 0.02, platformWidthMod: 1.0,  lavaSpeedMod: 1.1 },
  { minTime: 60,  normalChance: 0.42, breakableChance: 0.30, movingChance: 0.15, boostChance: 0.08, rewardChance: 0.05, platformWidthMod: 0.85, lavaSpeedMod: 1.2 },
  { minTime: 90,  normalChance: 0.30, breakableChance: 0.15, movingChance: 0.40, boostChance: 0.08, rewardChance: 0.07, platformWidthMod: 0.85, lavaSpeedMod: 1.3 },
  { minTime: 120, normalChance: 0.20, breakableChance: 0.25, movingChance: 0.35, boostChance: 0.10, rewardChance: 0.10, platformWidthMod: 0.80, lavaSpeedMod: 1.5 },
];

// Risk/reward coin scaling by level tier
export const REWARD_COINS_BY_TIER: Record<string, number> = {
  intro: 3,   // levels 1-5
  mid: 4,     // levels 6-15
  hard: 5,    // levels 16-30
  elite: 6,   // levels 31+
};

export function getRewardCoinCount(levelId: number): number {
  if (levelId <= 5) return REWARD_COINS_BY_TIER.intro;
  if (levelId <= 15) return REWARD_COINS_BY_TIER.mid;
  if (levelId <= 30) return REWARD_COINS_BY_TIER.hard;
  return REWARD_COINS_BY_TIER.elite;
}

// Helper: lerp between values
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

// Mini-peak: every 5th level is slightly harder
function miniPeak(id: number, base: number, extra: number): number {
  return id % 5 === 0 ? base + extra : base;
}

// Level definitions (50 levels)
export const LEVELS: LevelDefinition[] = (() => {
  const levels: LevelDefinition[] = [];

  for (let id = 1; id <= 50; id++) {
    const t = (id - 1) / 49; // 0..1 across all levels
    const peak = id % 5 === 0;

    let name: string;
    let targetHeight: number;
    let normalChance: number;
    let breakableChance: number;
    let movingChance: number;
    let boostChance: number;
    let rewardChance: number;
    let platformWidthMod: number;
    let lavaSpeedMod: number;
    let lavaEndAccel: number;
    let lavaControlChance: number;
    let dangerChance: number;
    let invincibleChance: number;
    let vanishingChance: number;

    if (id <= 5) {
      // INTRO tier — gentle introduction
      const lt = (id - 1) / 4;
      name = ['First Steps', 'Getting Started', 'The Ascent', 'Light Breeze', 'Summit View'][id - 1];
      targetHeight = Math.floor(lerp(300, 450, lt));
      normalChance = lerp(0.89, 0.74, lt);
      breakableChance = lerp(0.01, 0.05, lt);
      movingChance = lerp(0.02, 0.10, lt);
      boostChance = lerp(0.08, 0.08, lt);
      rewardChance = lerp(0.00, 0.01, lt);
      platformWidthMod = lerp(1.25, 1.10, lt);
      lavaSpeedMod = lerp(0.70, 0.85, lt);
      lavaEndAccel = lerp(1.1, 1.2, lt);
      lavaControlChance = lerp(0.00, 0.03, lt);
      dangerChance = 0;
      invincibleChance = 0;
      vanishingChance = 0;
    } else if (id <= 15) {
      // MID tier — introduce hazards, keep levels short
      const lt = (id - 6) / 9;
      const midNames = ['Shaky Paths', 'Brittle Ground', 'Fire Dance', 'Narrow Ridges', 'Lava Stream',
        'Ash Rain', 'Ember Trail', 'Rockfall', 'Heat Wave', 'Magma Core'];
      name = midNames[id - 6];
      targetHeight = Math.floor(lerp(450, 550, lt));
      normalChance = lerp(0.64, 0.41, lt);
      breakableChance = lerp(0.08, 0.18, lt);
      movingChance = lerp(0.14, 0.24, lt);
      boostChance = 0.08;
      rewardChance = lerp(0.02, 0.05, lt);
      platformWidthMod = lerp(1.05, 0.88, lt);
      lavaSpeedMod = lerp(0.90, 1.25, lt);
      lavaEndAccel = lerp(1.2, 1.45, lt);
      lavaControlChance = lerp(0.03, 0.05, lt);
      dangerChance = lerp(0.00, 0.06, lt);
      invincibleChance = lerp(0.00, 0.02, lt);
      vanishingChance = lerp(0.02, 0.06, lt);
    } else if (id <= 30) {
      // HARD tier — mechanical complexity ramps up
      const lt = (id - 16) / 14;
      const hardNames = ['Death Crater', 'Volcano Peak', 'Obsidian Bridge', 'Flame Gate', 'Crater Edge',
        'Shadow Fire', 'Lava Fountain', 'Ember Rain', 'Smelter', 'Trial by Fire',
        'Magma Stream', 'Volcano Heart', 'Inferno', 'Firestorm', 'Hell\'s Maw'];
      name = hardNames[id - 16];
      targetHeight = Math.floor(lerp(550, 650, lt));
      normalChance = lerp(0.30, 0.12, lt);
      breakableChance = lerp(0.20, 0.28, lt);
      movingChance = lerp(0.26, 0.34, lt);
      boostChance = lerp(0.08, 0.06, lt);
      rewardChance = lerp(0.05, 0.07, lt);
      platformWidthMod = lerp(0.82, 0.65, lt);
      lavaSpeedMod = lerp(1.30, 2.00, lt);
      lavaEndAccel = lerp(1.50, 2.00, lt);
      lavaControlChance = lerp(0.04, 0.06, lt);
      dangerChance = lerp(0.08, 0.16, lt);
      invincibleChance = lerp(0.02, 0.03, lt);
      vanishingChance = lerp(0.08, 0.16, lt);
    } else if (id === 50) {
      // FINAL LEVEL — combination of all mechanics, true final challenge
      name = 'Eruption';
      targetHeight = 700;
      normalChance = 0.00;
      breakableChance = 0.24;
      movingChance = 0.30;
      boostChance = 0.06;
      rewardChance = 0.10;
      platformWidthMod = 0.55;
      lavaSpeedMod = 3.20;
      lavaEndAccel = 3.50;
      lavaControlChance = 0.08;
      dangerChance = 0.18;
      invincibleChance = 0.04;
      vanishingChance = 0.18;
    } else {
      // ELITE tier (31-49) — punishing mechanics, relentless pressure
      const lt = (id - 31) / 18;
      const eliteNames = ['Ash Crown', 'Ember Peak', 'Lava Falls', 'Fire Core', 'Crucible',
        'Obsidian Storm', 'Magma Flood', 'Crater Lake', 'Volcano Fist', 'Flame Grave',
        'Fire Breath', 'Ember Wall', 'Lava Wrath', 'Hell Ride', 'Magma Heart',
        'Ash Ghost', 'Volcano Fury', 'Fire Soul', 'Ember Crown'];
      name = eliteNames[id - 31];
      targetHeight = Math.floor(lerp(650, 700, lt));
      normalChance = lerp(0.05, 0.00, lt);
      breakableChance = lerp(0.24, 0.28, lt);
      movingChance = lerp(0.34, 0.36, lt);
      boostChance = lerp(0.06, 0.04, lt);
      rewardChance = lerp(0.10, 0.12, lt);
      platformWidthMod = lerp(0.65, 0.55, lt);
      lavaSpeedMod = lerp(2.00, 3.00, lt);
      lavaEndAccel = lerp(2.00, 3.20, lt);
      lavaControlChance = lerp(0.06, 0.08, lt);
      dangerChance = lerp(0.14, 0.18, lt);
      invincibleChance = lerp(0.03, 0.04, lt);
      vanishingChance = lerp(0.14, 0.18, lt);
    }

    // Mini-peak every 5th level — harder mechanics, NOT longer
    if (peak) {
      lavaSpeedMod *= 1.10;
      platformWidthMod *= 0.93;
      breakableChance = Math.min(0.35, breakableChance + 0.04);
      movingChance = Math.min(0.40, movingChance + 0.03);
    }

    levels.push({
      id, name, targetHeight,
      normalChance, breakableChance, movingChance, boostChance, rewardChance,
      platformWidthMod, lavaSpeedMod, lavaEndAccel,
      lavaControlChance, dangerChance, invincibleChance, vanishingChance,
    });
  }

  return levels;
})();

export const PERMANENT_UPGRADES = [
  {
    id: 'jumpHeight',
    name: 'Jump Power',
    description: '+5% jump height',
    icon: '🦘',
    maxLevel: 10,
    baseCost: 50,
    costMultiplier: 1.5,
    effectPerLevel: 0.05,
    effectUnit: '%',
  },
  {
    id: 'coinSpawn',
    name: 'Coin Rain',
    description: '+3% coin spawn rate',
    icon: '🪙',
    maxLevel: 10,
    baseCost: 40,
    costMultiplier: 1.4,
    effectPerLevel: 0.03,
    effectUnit: '%',
  },
  {
    id: 'lavaResist',
    name: 'Heat Resistance',
    description: 'Lava starts 3% slower',
    icon: '🛡️',
    maxLevel: 10,
    baseCost: 60,
    costMultiplier: 1.6,
    effectPerLevel: 0.03,
    effectUnit: '%',
  },
  {
    id: 'startShield',
    name: 'Start Shield',
    description: 'Start with a shield (1 run, blocks lava once)',
    icon: '💎',
    maxLevel: 1,
    baseCost: 200,
    costMultiplier: 1,
    effectPerLevel: 1,
    effectUnit: '',
    consumable: true,
  },
];

