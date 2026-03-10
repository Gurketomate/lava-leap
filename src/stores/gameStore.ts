import { create } from 'zustand';
import type { GameScreen } from '@/game/types';
import { PERMANENT_UPGRADES, LEVELS } from '@/game/constants';

interface UpgradeLevels {
  [key: string]: number;
}

interface LevelStars {
  [levelId: number]: number;
}

export type GameMode = 'level' | 'endless';

interface GameStore {
  screen: GameScreen;
  score: number;
  highScore: number;
  coins: number;
  totalCoins: number;
  lavaProximity: number;
  phase: number;
  screenShake: number;
  upgradeLevels: UpgradeLevels;
  currentLevel: number;
  maxUnlockedLevel: number;
  gameMode: GameMode;
  endlessHighScore: number;

  // Star tracking per run
  runDeaths: number;
  runCoinsCollected: number;
  lastRunStars: number;
  levelStars: LevelStars;

  setScreen: (screen: GameScreen) => void;
  setScore: (score: number) => void;
  setCoins: (coins: number) => void;
  setLavaProximity: (p: number) => void;
  setPhase: (phase: number) => void;
  setScreenShake: (shake: number) => void;
  setCurrentLevel: (level: number) => void;
  setGameMode: (mode: GameMode) => void;
  setRunStats: (deaths: number, coinsCollected: number) => void;
  completeLevel: () => void;
  gameOver: () => void;
  resetRun: () => void;
  purchasePermanentUpgrade: (id: string) => boolean;
  getUpgradeLevel: (id: string) => number;
  getUpgradeCost: (id: string) => number;
  getStarsForLevel: (levelId: number) => number;
  loadPersisted: () => void;
}

const SAVE_VERSION = 1;

const getDefaultSaveState = () => ({
  highScore: 0,
  totalCoins: 0,
  upgradeLevels: {},
  maxUnlockedLevel: 1,
  levelStars: {},
  endlessHighScore: 0,
});

const loadFromStorage = () => {
  try {
    const data = JSON.parse(localStorage.getItem('volcanoEscape') || '{}');

    // Reset legacy/debug saves from pre-release builds
    if (data.saveVersion !== SAVE_VERSION) {
      return getDefaultSaveState();
    }

    return {
      highScore: Math.max(0, Number(data.highScore) || 0),
      totalCoins: Math.max(0, Number(data.totalCoins) || 0),
      upgradeLevels: typeof data.upgradeLevels === 'object' && data.upgradeLevels ? data.upgradeLevels : {},
      maxUnlockedLevel: Math.min(LEVELS.length, Math.max(1, Number(data.maxUnlockedLevel) || 1)),
      levelStars: typeof data.levelStars === 'object' && data.levelStars ? data.levelStars : {},
      endlessHighScore: Math.max(0, Number(data.endlessHighScore) || 0),
    };
  } catch {
    return getDefaultSaveState();
  }
};

const saveToStorage = (highScore: number, totalCoins: number, upgradeLevels: UpgradeLevels, maxUnlockedLevel: number, levelStars: LevelStars, endlessHighScore: number) => {
  localStorage.setItem('volcanoEscape', JSON.stringify({
    saveVersion: SAVE_VERSION,
    highScore,
    totalCoins,
    upgradeLevels,
    maxUnlockedLevel,
    levelStars,
    endlessHighScore,
  }));
};

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'menu',
  score: 0,
  highScore: 0,
  coins: 0,
  totalCoins: 0,
  lavaProximity: 0,
  upgradeLevels: {},
  phase: 1,
  screenShake: 0,
  currentLevel: 1,
  maxUnlockedLevel: 1,
  gameMode: 'level',
  endlessHighScore: 0,
  runDeaths: 0,
  runCoinsCollected: 0,
  lastRunStars: 0,
  levelStars: {},

  setScreen: (screen) => set({ screen }),
  setScore: (score) => set({ score }),
  setCoins: (coins) => set({ coins }),
  setLavaProximity: (lavaProximity) => set({ lavaProximity }),
  setPhase: (phase) => set({ phase }),
  setScreenShake: (screenShake) => set({ screenShake }),
  setCurrentLevel: (currentLevel) => set({ currentLevel }),
  setGameMode: (gameMode) => set({ gameMode }),

  setRunStats: (deaths, coinPercent, totalSpawned) => set({ runDeaths: deaths, runCoinPercent: coinPercent, runTotalCoinsSpawned: totalSpawned }),

  completeLevel: () => {
    const s = get();
    const newUnlocked = Math.min(LEVELS.length, Math.max(s.maxUnlockedLevel, s.currentLevel + 1));
    const newHigh = Math.max(s.highScore, s.score);
    const newTotal = s.totalCoins + s.coins;
    const newLevels = { ...s.upgradeLevels };
    if (newLevels['startShield'] > 0) newLevels['startShield'] = 0;

    let stars = 1;
    if (s.runCoinPercent >= 0.85 && s.runDeaths === 0) stars = 3;
    else if (s.runCoinPercent >= 0.60) stars = 2;

    const newLevelStars = { ...s.levelStars };
    const prev = newLevelStars[s.currentLevel] || 0;
    newLevelStars[s.currentLevel] = Math.max(prev, stars);

    saveToStorage(newHigh, newTotal, newLevels, newUnlocked, newLevelStars, s.endlessHighScore);
    set({
      screen: 'levelComplete',
      highScore: newHigh,
      totalCoins: newTotal,
      maxUnlockedLevel: newUnlocked,
      upgradeLevels: newLevels,
      lastRunStars: stars,
      levelStars: newLevelStars,
    });
  },

  gameOver: () => {
    const s = get();
    const newHigh = Math.max(s.highScore, s.score);
    const newTotal = s.totalCoins + s.coins;
    const newLevels = { ...s.upgradeLevels };
    if (newLevels['startShield'] > 0) newLevels['startShield'] = 0;
    const newEndlessHigh = s.gameMode === 'endless' ? Math.max(s.endlessHighScore, s.score) : s.endlessHighScore;
    saveToStorage(newHigh, newTotal, newLevels, s.maxUnlockedLevel, s.levelStars, newEndlessHigh);
    set({ screen: 'gameOver', highScore: newHigh, totalCoins: newTotal, upgradeLevels: newLevels, endlessHighScore: newEndlessHigh });
  },

  resetRun: () => set({
    screen: 'playing',
    score: 0,
    coins: 0,
    lavaProximity: 0,
    phase: 1,
    screenShake: 0,
    runDeaths: 0,
    runCoinPercent: 0,
    runTotalCoinsSpawned: 0,
    lastRunStars: 0,
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
    saveToStorage(s.highScore, newTotal, newLevels, s.maxUnlockedLevel, s.levelStars, s.endlessHighScore);
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

  getStarsForLevel: (levelId) => get().levelStars[levelId] || 0,

  loadPersisted: () => {
    const data = loadFromStorage();
    set(data);
  },
}));
