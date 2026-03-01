import { create } from 'zustand';
import type { GameScreen, PowerUp } from '@/game/types';
import { PERMANENT_UPGRADES } from '@/game/constants';

interface UpgradeLevels {
  [key: string]: number;
}

interface GameStore {
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
  upgradeLevels: UpgradeLevels;
  upgradeChoices: PowerUp[];

  setScreen: (screen: GameScreen) => void;
  setScore: (score: number) => void;
  setCoins: (coins: number) => void;
  setLavaProximity: (p: number) => void;
  setPhase: (phase: number) => void;
  setScreenShake: (shake: number) => void;
  addCoin: () => void;
  addPowerUp: (p: PowerUp) => void;
  setUpgradeChoices: (choices: PowerUp[]) => void;
  setNextUpgradeAt: (n: number) => void;
  gameOver: () => void;
  resetRun: () => void;
  purchasePermanentUpgrade: (id: string) => boolean;
  getUpgradeLevel: (id: string) => number;
  getUpgradeCost: (id: string) => number;
  loadPersisted: () => void;
}

const loadFromStorage = () => {
  try {
    const data = JSON.parse(localStorage.getItem('volcanoEscape') || '{}');
    return {
      highScore: data.highScore || 0,
      totalCoins: data.totalCoins || 0,
      upgradeLevels: data.upgradeLevels || {},
    };
  } catch {
    return { highScore: 0, totalCoins: 0, upgradeLevels: {} };
  }
};

const saveToStorage = (highScore: number, totalCoins: number, upgradeLevels: UpgradeLevels) => {
  localStorage.setItem('volcanoEscape', JSON.stringify({ highScore, totalCoins, upgradeLevels }));
};

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'menu',
  score: 0,
  highScore: 0,
  coins: 0,
  totalCoins: 0,
  activePowerUps: [],
  nextUpgradeAt: 500,
  lavaProximity: 0,
  upgradeLevels: {},
  phase: 1,
  screenShake: 0,
  upgradeChoices: [],

  setScreen: (screen) => set({ screen }),
  setScore: (score) => set({ score }),
  setCoins: (coins) => set({ coins }),
  setLavaProximity: (lavaProximity) => set({ lavaProximity }),
  addCoin: () => set((s) => ({ coins: s.coins + 1 })),
  addPowerUp: (p) => set((s) => {
    const existing = s.activePowerUps.find((e) => e.type === p.type);
    if (existing) {
      return {
        activePowerUps: s.activePowerUps.map((e) =>
          e.type === p.type ? { ...e, stacks: e.stacks + 1 } : e
        ),
      };
    }
    return { activePowerUps: [...s.activePowerUps, { ...p, stacks: 1 }] };
  }),
  setUpgradeChoices: (upgradeChoices) => set({ upgradeChoices }),
  setNextUpgradeAt: (nextUpgradeAt) => set({ nextUpgradeAt }),

  gameOver: () => {
    const s = get();
    const newHigh = Math.max(s.highScore, s.score);
    const newTotal = s.totalCoins + s.coins;
    saveToStorage(newHigh, newTotal, s.upgradeLevels);
    set({ screen: 'gameOver', highScore: newHigh, totalCoins: newTotal });
  },

  resetRun: () => set({
    screen: 'playing',
    score: 0,
    coins: 0,
    activePowerUps: [],
    nextUpgradeAt: 500,
    lavaProximity: 0,
    upgradeChoices: [],
  }),

  purchasePermanentUpgrade: (id) => {
    const s = get();
    const def = PERMANENT_UPGRADES.find((u) => u.id === id);
    if (!def) return false;
    const level = s.upgradeLevels[id] || 0;
    if (level >= def.maxLevel) return false;
    const cost = Math.floor(def.baseCost * Math.pow(def.costMultiplier, level));
    if (s.totalCoins < cost) return false;
    const newLevels = { ...s.upgradeLevels, [id]: level + 1 };
    const newTotal = s.totalCoins - cost;
    saveToStorage(s.highScore, newTotal, newLevels);
    set({ totalCoins: newTotal, upgradeLevels: newLevels });
    return true;
  },

  getUpgradeLevel: (id) => get().upgradeLevels[id] || 0,
  getUpgradeCost: (id) => {
    const def = PERMANENT_UPGRADES.find((u) => u.id === id);
    if (!def) return 0;
    const level = get().upgradeLevels[id] || 0;
    return Math.floor(def.baseCost * Math.pow(def.costMultiplier, level));
  },

  loadPersisted: () => {
    const data = loadFromStorage();
    set(data);
  },
}));
