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

export type PlatformType = 'normal' | 'breakable' | 'moving' | 'boost';

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: PlatformType;
  broken: boolean;
  moveDir?: number;
  moveSpeed?: number;
  moveRange?: number;
  originX?: number;
}

export interface Coin {
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  angle: number;
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

export type GameScreen = 'menu' | 'playing' | 'paused' | 'upgrade' | 'gameOver' | 'shop';

export interface GameState {
  screen: GameScreen;
  score: number;
  highScore: number;
  coins: number;
  totalCoins: number;
  activePowerUps: PowerUp[];
  nextUpgradeAt: number;
  lavaProximity: number; // 0-1 for heat bar
}
