import { useCallback, useEffect, useRef, useState } from 'react';
import GameCanvas from '@/components/game/GameCanvas';
import GameHUD from '@/components/game/GameHUD';
import MainMenu from '@/components/game/MainMenu';
import GameOverScreen from '@/components/game/GameOverScreen';
import UpgradeMenu from '@/components/game/UpgradeMenu';
import PermanentShop from '@/components/game/PermanentShop';
import { useGameStore } from '@/stores/gameStore';
import { GameEngine } from '@/game/GameEngine';
import { upgradeChosen } from '@/game/analytics';
import type { PowerUp } from '@/game/types';

const Index = () => {
  const store = useGameStore();
  const engineRef = useRef<GameEngine | null>(null);
  const [upgradeChoices, setUpgradeChoices] = useState<PowerUp[]>([]);

  useEffect(() => {
    store.loadPersisted();
  }, []);

  const getPermanentBonuses = useCallback(() => {
    const s = useGameStore.getState();
    const jumpBonus = (s.upgradeLevels['jumpHeight'] || 0) * 0.05;
    const coinSpawnBonus = (s.upgradeLevels['coinSpawn'] || 0) * 0.03;
    const lavaResistBonus = (s.upgradeLevels['lavaResist'] || 0) * 0.03;
    const startWithShield = (s.upgradeLevels['startShield'] || 0) >= 1;
    return { jumpBonus, coinSpawnBonus, lavaResistBonus, startWithShield };
  }, []);

  const startGame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const bonuses = getPermanentBonuses();
    engine.setPermanentBonuses(bonuses.jumpBonus, bonuses.coinSpawnBonus, bonuses.lavaResistBonus, bonuses.startWithShield);

    engine.onScoreUpdate = (score: number) => {
      useGameStore.getState().setScore(score);
    };
    engine.onCoinCollect = (count: number) => {
      useGameStore.getState().setCoins(count);
    };
    engine.onLavaProximity = (p: number) => {
      useGameStore.getState().setLavaProximity(p);
    };
    engine.onGameOver = () => {
      useGameStore.getState().gameOver();
    };
    engine.onUpgradeReady = (choices: PowerUp[]) => {
      setUpgradeChoices(choices);
      useGameStore.getState().setScreen('upgrade');
    };

    store.resetRun();
    engine.start();
  }, [store, getPermanentBonuses]);

  const handleUpgradeSelect = useCallback((powerUp: PowerUp) => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.applyPowerUp(powerUp);
    store.addPowerUp(powerUp);
    store.setNextUpgradeAt(engine.nextUpgradeAt);
    upgradeChosen(powerUp.type);
    setUpgradeChoices([]);
    store.setScreen('playing');
    engine.resume();
  }, [store]);

  const handleRestart = useCallback(() => {
    startGame();
  }, [startGame]);

  const handleMenu = useCallback(() => {
    store.setScreen('menu');
    engineRef.current?.stop();
  }, [store]);

  const handleEngineReady = useCallback((engine: GameEngine) => {
    engineRef.current = engine;
  }, []);

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <GameCanvas onReady={handleEngineReady} />

      {store.screen === 'playing' && <GameHUD />}
      {store.screen === 'menu' && <MainMenu onStart={startGame} onShop={() => store.setScreen('shop')} />}
      {store.screen === 'gameOver' && <GameOverScreen onRestart={handleRestart} onMenu={handleMenu} />}
      {store.screen === 'upgrade' && <UpgradeMenu choices={upgradeChoices} onSelect={handleUpgradeSelect} />}
      {store.screen === 'shop' && <PermanentShop onBack={() => store.setScreen('menu')} />}
    </div>
  );
};

export default Index;
