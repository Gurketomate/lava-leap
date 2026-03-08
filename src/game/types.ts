export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hasDoubleJump: boolean;
  doubleJumpUsed: boolean;
  hasShield: boolean;
  jumpsRemaining: number;
}

export type PlatformType = 'normal' | 'breakable' | 'moving' | 'boost' | 'reward' | 'lavaControl' | 'danger' | 'invincible' | 'vanishing';

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: PlatformType;
  broken: boolean;
  breakTimer?: number;
  moveDir?: number;
  moveSpeed?: number;
  moveRange?: number;
  originX?: number;
  vanishTimer?: number;
  vanishDuration?: number;
  visible?: boolean;
}

export interface Coin {
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  angle: number;
  linkedPlatform?: Platform; // direct reference for moving platforms
  offsetX?: number;
  offsetY?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export type PowerUpType = 'doubleJump' | 'lavaSlow' | 'coinMagnet' | 'shield' | 'platformStabilizer';

export interface PowerUp {
  type: PowerUpType;
  name: string;
  description: string;
  icon: string;
  stacks: number;
}

export type ItemType = 'coinMagnet' | 'lavaBrake' | 'shield' | 'doubleJump';

export interface ItemPickup {
  x: number;
  y: number;
  type: ItemType;
  collected: boolean;
  platformIndex: number; // link to platform
}

export interface ActiveEffect {
  type: ItemType;
  remaining: number; // seconds remaining
  duration: number;  // total duration
}

export interface PermanentUpgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  level: number;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  effectPerLevel: number;
  effectUnit: string;
}

export type GameScreen = 'menu' | 'playing' | 'paused' | 'gameOver' | 'shop' | 'levelComplete' | 'levelSelect';

export interface LevelDefinition {
  id: number;
  name: string;
  targetHeight: number; // score to reach
  normalChance: number;
  breakableChance: number;
  movingChance: number;
  boostChance: number;
  rewardChance: number;
  platformWidthMod: number;
  lavaSpeedMod: number;
  lavaEndAccel: number; // lava acceleration multiplier in last 20% of level
  lavaControlChance: number;
  dangerChance: number;
  invincibleChance: number;
  vanishingChance: number;
}

export interface GameState {
  screen: GameScreen;
  score: number;
  highScore: number;
  coins: number;
  totalCoins: number;
  activePowerUps: PowerUp[];
  nextUpgradeAt: number;
  lavaProximity: number;
  phase: number;
  screenShake: number;
  currentLevel: number;
  maxUnlockedLevel: number;
}

export interface DifficultyPhase {
  normalChance: number;
  breakableChance: number;
  movingChance: number;
  boostChance: number;
  rewardChance: number;
  platformWidthMod: number; // multiplier for platform width
  lavaSpeedMod: number; // multiplier for lava speed
  minTime: number; // seconds to enter this phase
}
