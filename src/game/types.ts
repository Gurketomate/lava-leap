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

export type PlatformType = 'normal' | 'breakable' | 'moving' | 'reward' | 'lavaControl' | 'danger' | 'invincible';

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
  linkedPlatform?: Platform; // direct reference for moving platforms
  offsetX?: number;
  offsetY?: number;
  phaseOffset: number; // stable value for bob animation
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

export type GameScreen = 'menu' | 'playing' | 'paused' | 'gameOver' | 'shop' | 'levelComplete' | 'levelSelect' | 'modeSelect';

export interface LevelDefinition {
  id: number;
  name: string;
  targetHeight: number;
  normalChance: number;
  breakableChance: number;
  movingChance: number;
  rewardChance: number;
  platformWidthMod: number;
  lavaSpeedMod: number;
  lavaEndAccel: number;
  lavaControlChance: number;
  dangerChance: number;
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
  rewardChance: number;
  platformWidthMod: number;
  lavaSpeedMod: number;
  minTime: number;
}
