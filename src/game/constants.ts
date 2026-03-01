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

// Level definitions
export const LEVELS: LevelDefinition[] = [
  { id: 1,  name: 'Einstieg',         targetHeight: 300,  normalChance: 0.85, breakableChance: 0.02, movingChance: 0.05, boostChance: 0.08, rewardChance: 0.00, platformWidthMod: 1.20, lavaSpeedMod: 0.8,  lavaEndAccel: 1.2 },
  { id: 2,  name: 'Erste Schritte',    targetHeight: 500,  normalChance: 0.75, breakableChance: 0.05, movingChance: 0.10, boostChance: 0.08, rewardChance: 0.02, platformWidthMod: 1.10, lavaSpeedMod: 0.9,  lavaEndAccel: 1.3 },
  { id: 3,  name: 'Aufstieg',          targetHeight: 700,  normalChance: 0.65, breakableChance: 0.08, movingChance: 0.15, boostChance: 0.08, rewardChance: 0.04, platformWidthMod: 1.05, lavaSpeedMod: 1.0,  lavaEndAccel: 1.3 },
  { id: 4,  name: 'Wankende Pfade',    targetHeight: 900,  normalChance: 0.55, breakableChance: 0.10, movingChance: 0.22, boostChance: 0.08, rewardChance: 0.05, platformWidthMod: 1.00, lavaSpeedMod: 1.1,  lavaEndAccel: 1.4 },
  { id: 5,  name: 'Brüchiger Grund',   targetHeight: 1100, normalChance: 0.45, breakableChance: 0.22, movingChance: 0.18, boostChance: 0.08, rewardChance: 0.07, platformWidthMod: 0.95, lavaSpeedMod: 1.15, lavaEndAccel: 1.4 },
  { id: 6,  name: 'Feuertanz',         targetHeight: 1300, normalChance: 0.40, breakableChance: 0.15, movingChance: 0.28, boostChance: 0.08, rewardChance: 0.09, platformWidthMod: 0.90, lavaSpeedMod: 1.25, lavaEndAccel: 1.5 },
  { id: 7,  name: 'Schmale Grate',     targetHeight: 1500, normalChance: 0.35, breakableChance: 0.25, movingChance: 0.22, boostChance: 0.08, rewardChance: 0.10, platformWidthMod: 0.85, lavaSpeedMod: 1.3,  lavaEndAccel: 1.5 },
  { id: 8,  name: 'Lavastrom',         targetHeight: 1800, normalChance: 0.30, breakableChance: 0.20, movingChance: 0.30, boostChance: 0.10, rewardChance: 0.10, platformWidthMod: 0.82, lavaSpeedMod: 1.4,  lavaEndAccel: 1.6 },
  { id: 9,  name: 'Todeskrater',       targetHeight: 2200, normalChance: 0.25, breakableChance: 0.25, movingChance: 0.28, boostChance: 0.10, rewardChance: 0.12, platformWidthMod: 0.80, lavaSpeedMod: 1.5,  lavaEndAccel: 1.7 },
  { id: 10, name: 'Vulkangipfel',      targetHeight: 2800, normalChance: 0.20, breakableChance: 0.28, movingChance: 0.30, boostChance: 0.10, rewardChance: 0.12, platformWidthMod: 0.78, lavaSpeedMod: 1.6,  lavaEndAccel: 2.0 },
];

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
