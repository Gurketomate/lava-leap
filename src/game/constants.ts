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
export const LAVA_ACCELERATION = 0.15;
export const LAVA_MAX_SPEED = 120;

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

// Difficulty scaling per 1000 score
export const DIFFICULTY_BREAKABLE_SCALE = 0.02; // +2% per 1000 score
export const DIFFICULTY_MOVING_SCALE = 0.015;
export const DIFFICULTY_LAVA_ACCEL_SCALE = 0.02;

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
