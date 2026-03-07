import { useCallback, useEffect, useRef, useState } from 'react';
import GameCanvas from '@/components/game/GameCanvas';
import GameHUD from '@/components/game/GameHUD';
import MainMenu from '@/components/game/MainMenu';
import GameOverScreen from '@/components/game/GameOverScreen';
import PermanentShop from '@/components/game/PermanentShop';
import LevelCompleteScreen from '@/components/game/LevelCompleteScreen';
import LevelSelectScreen from '@/components/game/LevelSelectScreen';
import SettingsMenu from '@/components/game/SettingsMenu';
import { useGameStore } from '@/stores/gameStore';
import { useAdStore } from '@/stores/adStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { GameEngine } from '@/game/GameEngine';
import { LEVELS } from '@/game/constants';
import { startMusic } from '@/game/SoundManager';
import type { ActiveEffect } from '@/game/types';

const Index = () => {
  const store = useGameStore();
  const engineRef = useRef<GameEngine | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);

  const adStore = useAdStore();

  useEffect(() => {
    store.loadPersisted();
    adStore.initSession();
    useSettingsStore.getState().loadSettings();
  }, []);

  const getPermanentBonuses = useCallback(() => {
    const s = useGameStore.getState();
    const jumpBonus = (s.upgradeLevels['jumpHeight'] || 0) * 0.05;
    const coinSpawnBonus = (s.upgradeLevels['coinSpawn'] || 0) * 0.03;
    const lavaResistBonus = (s.upgradeLevels['lavaResist'] || 0) * 0.03;
    const startWithShield = (s.upgradeLevels['startShield'] || 0) >= 1;
    return { jumpBonus, coinSpawnBonus, lavaResistBonus, startWithShield };
  }, []);

  const startLevel = useCallback((levelId: number) => {
    const engine = engineRef.current;
    if (!engine) return;

    const levelDef = LEVELS.find(l => l.id === levelId);
    if (!levelDef) return;

    const bonuses = getPermanentBonuses();
    engine.setPermanentBonuses(bonuses.jumpBonus, bonuses.coinSpawnBonus, bonuses.lavaResistBonus, bonuses.startWithShield);
    engine.setLevel(levelDef);

    engine.onScoreUpdate = (score: number) => {
      useGameStore.getState().setScore(score);
    };
    engine.onCoinCollect = (count: number) => {
      useGameStore.getState().setCoins(count);
    };
    engine.onLavaProximity = (p: number) => {
      useGameStore.getState().setLavaProximity(p);
    };
    engine.onPhaseChange = (phase: number) => {
      useGameStore.getState().setPhase(phase);
    };
    engine.onScreenShake = (shake: number) => {
      useGameStore.getState().setScreenShake(shake);
    };
    engine.onGameOver = () => {
      useGameStore.getState().gameOver();
    };
    engine.onLevelComplete = () => {
      useGameStore.getState().completeLevel();
    };
    engine.onActiveEffectsUpdate = (effects: ActiveEffect[]) => {
      setActiveEffects([...effects]);
    };

    store.setCurrentLevel(levelId);
    store.resetRun();
    setActiveEffects([]);
    engine.start();
  }, [store, getPermanentBonuses]);

  const handleRestart = useCallback(() => {
    adStore.recordDeath();
    adStore.resetRunAdState();
    startLevel(store.currentLevel);
  }, [startLevel, store.currentLevel, adStore]);

  const handleNextLevel = useCallback(() => {
    const nextId = store.currentLevel + 1;
    if (nextId <= LEVELS.length) {
      startLevel(nextId);
    } else {
      store.setScreen('menu');
    }
  }, [startLevel, store]);

  const handleMenu = useCallback(() => {
    store.setScreen('menu');
    engineRef.current?.stop();
  }, [store]);

  const handleRevive = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    store.markUsedAd();
    store.setScreen('playing');
    engine.revive();
  }, [store]);

  const handleEngineReady = useCallback((engine: GameEngine) => {
    engineRef.current = engine;
  }, []);

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <GameCanvas onReady={handleEngineReady} />

      {store.screen === 'playing' && <GameHUD activeEffects={activeEffects} />}
      {store.screen === 'menu' && (
        <MainMenu
          onStart={() => store.setScreen('levelSelect')}
          onShop={() => store.setScreen('shop')}
          onSettings={() => setShowSettings(true)}
        />
      )}
      {store.screen === 'levelSelect' && (
        <LevelSelectScreen
          onSelectLevel={startLevel}
          onBack={() => store.setScreen('menu')}
        />
      )}
      {store.screen === 'gameOver' && <GameOverScreen onRestart={handleRestart} onMenu={handleMenu} onRevive={handleRevive} />}
      {store.screen === 'shop' && <PermanentShop onBack={() => store.setScreen('menu')} />}
      {store.screen === 'levelComplete' && <LevelCompleteScreen onNextLevel={handleNextLevel} onMenu={handleMenu} />}
      {showSettings && <SettingsMenu onClose={() => setShowSettings(false)} />}
    </div>
  );
};

export default Index;
