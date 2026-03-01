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
export const PLATFORMS_BUFFER = 800;

export const LAVA_INITIAL_SPEED = 30;
export const LAVA_ACCELERATION = 0.15; // legacy, unused by adaptive system

export const COIN_RADIUS = 10;
export const COIN_SPAWN_CHANCE = 0.35;
export const COIN_MAGNET_RANGE = 150;

export const CAMERA_SMOOTH = 0.08;
export const SCORE_SCALE = 10; // pixels per point

export const UPGRADE_INTERVAL = 500;

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
  intro: 5,   // levels 1-5
  mid: 7,     // levels 6-15
  hard: 10,   // levels 16-30
  elite: 12,  // levels 31+
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

    if (id <= 5) {
      // INTRO tier
      const lt = (id - 1) / 4;
      name = ['Einstieg', 'Erste Schritte', 'Aufstieg', 'Leichter Wind', 'Gipfelblick'][id - 1];
      targetHeight = Math.floor(lerp(250, 500, lt));
      normalChance = lerp(0.88, 0.75, lt);
      breakableChance = lerp(0.01, 0.05, lt);
      movingChance = lerp(0.02, 0.10, lt);
      boostChance = lerp(0.09, 0.08, lt);
      rewardChance = lerp(0.00, 0.02, lt);
      platformWidthMod = lerp(1.25, 1.10, lt);
      lavaSpeedMod = lerp(0.70, 0.90, lt);
      lavaEndAccel = lerp(1.1, 1.25, lt);
    } else if (id <= 15) {
      // MID tier
      const lt = (id - 6) / 9;
      const midNames = ['Wankende Pfade', 'Brüchiger Grund', 'Feuertanz', 'Schmale Grate', 'Lavastrom',
        'Ascheregen', 'Glutpfad', 'Felssturz', 'Hitzewelle', 'Magmakern'];
      name = midNames[id - 6];
      targetHeight = Math.floor(lerp(550, 1200, lt));
      normalChance = lerp(0.70, 0.45, lt);
      breakableChance = lerp(0.06, 0.18, lt);
      movingChance = lerp(0.12, 0.25, lt);
      boostChance = 0.08;
      rewardChance = lerp(0.04, 0.08, lt);
      platformWidthMod = lerp(1.05, 0.88, lt);
      lavaSpeedMod = lerp(0.95, 1.30, lt);
      lavaEndAccel = lerp(1.25, 1.50, lt);
    } else if (id <= 30) {
      // HARD tier
      const lt = (id - 16) / 14;
      const hardNames = ['Todeskrater', 'Vulkangipfel', 'Obsidianbrücke', 'Flammentor', 'Kraterrand',
        'Schattenfeuer', 'Lavafontäne', 'Glutregen', 'Schmelzofen', 'Feuerprobe',
        'Magmastrom', 'Vulkanherz', 'Inferno', 'Feuersturm', 'Höllenschlund'];
      name = hardNames[id - 16];
      targetHeight = Math.floor(lerp(1300, 2500, lt));
      normalChance = lerp(0.40, 0.22, lt);
      breakableChance = lerp(0.20, 0.28, lt);
      movingChance = lerp(0.25, 0.32, lt);
      boostChance = lerp(0.08, 0.10, lt);
      rewardChance = lerp(0.07, 0.12, lt);
      platformWidthMod = lerp(0.85, 0.75, lt);
      lavaSpeedMod = lerp(1.30, 1.70, lt);
      lavaEndAccel = lerp(1.50, 1.80, lt);
    } else {
      // ELITE tier (31-50)
      const lt = (id - 31) / 19;
      const eliteNames = ['Aschekrone', 'Glutgipfel', 'Lavafall', 'Feuerkern', 'Schmelztiegel',
        'Obsidiansturm', 'Magmaflut', 'Kratersee', 'Vulkanfaust', 'Flammengrab',
        'Feuerodem', 'Glutwand', 'Lavazorn', 'Höllenritt', 'Magmaherz',
        'Aschegeist', 'Vulkanzorn', 'Feuerseele', 'Glutkrone', 'Eruption'];
      name = eliteNames[id - 31];
      targetHeight = Math.floor(lerp(2600, 5000, lt));
      normalChance = lerp(0.20, 0.10, lt);
      breakableChance = lerp(0.28, 0.32, lt);
      movingChance = lerp(0.32, 0.38, lt);
      boostChance = lerp(0.10, 0.08, lt);
      rewardChance = lerp(0.12, 0.14, lt);
      platformWidthMod = lerp(0.75, 0.65, lt);
      lavaSpeedMod = lerp(1.70, 2.20, lt);
      lavaEndAccel = lerp(1.80, 2.50, lt);
    }

    // Mini-peak every 5th level
    if (peak) {
      lavaSpeedMod *= 1.08;
      platformWidthMod *= 0.95;
      breakableChance = Math.min(0.35, breakableChance + 0.03);
      targetHeight = Math.floor(targetHeight * 1.15);
    }

    levels.push({
      id, name, targetHeight,
      normalChance, breakableChance, movingChance, boostChance, rewardChance,
      platformWidthMod, lavaSpeedMod, lavaEndAccel,
    });
  }

  return levels;
})();

export const PERMANENT_UPGRADES = [
  {
    id: 'jumpHeight',
    name: 'Sprungkraft',
    description: '+5% Sprunghöhe',
    icon: '🦘',
    maxLevel: 10,
    baseCost: 50,
    costMultiplier: 1.5,
    effectPerLevel: 0.05,
    effectUnit: '%',
  },
  {
    id: 'coinSpawn',
    name: 'Münzregen',
    description: '+3% Münz-Spawn',
    icon: '🪙',
    maxLevel: 10,
    baseCost: 40,
    costMultiplier: 1.4,
    effectPerLevel: 0.03,
    effectUnit: '%',
  },
  {
    id: 'lavaResist',
    name: 'Hitzeresistenz',
    description: 'Lava startet 3% langsamer',
    icon: '🛡️',
    maxLevel: 10,
    baseCost: 60,
    costMultiplier: 1.6,
    effectPerLevel: 0.03,
    effectUnit: '%',
  },
  {
    id: 'startShield',
    name: 'Startschild',
    description: 'Starte mit Schild',
    icon: '💎',
    maxLevel: 1,
    baseCost: 200,
    costMultiplier: 1,
    effectPerLevel: 1,
    effectUnit: '',
  },
];

export const POWER_UP_DEFINITIONS = [
  {
    type: 'doubleJump' as const,
    name: 'Doppelsprung',
    description: 'Springe ein zweites Mal in der Luft',
    icon: '⬆️',
  },
  {
    type: 'lavaSlow' as const,
    name: 'Lava-Bremse',
    description: 'Lava steigt 30% langsamer',
    icon: '🌊',
  },
  {
    type: 'coinMagnet' as const,
    name: 'Münzmagnet',
    description: 'Zieht Münzen automatisch an',
    icon: '🧲',
  },
  {
    type: 'shield' as const,
    name: 'Schutzschild',
    description: 'Überlebe 1x Lava-Kontakt',
    icon: '🛡️',
  },
  {
    type: 'platformStabilizer' as const,
    name: 'Stabilisator',
    description: 'Weniger brüchige Plattformen',
    icon: '🔧',
  },
];
