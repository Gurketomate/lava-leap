import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useAdStore } from '@/stores/adStore';
import { LEVELS } from '@/game/constants';
import { useSoundClick } from '@/hooks/useSoundClick';

interface GameOverScreenProps {
  onRestart: () => void;
  onMenu: () => void;
  onRevive: () => void;
}

const GameOverScreen = ({ onRestart, onMenu, onRevive }: GameOverScreenProps) => {
  const { score, highScore, coins, currentLevel } = useGameStore();
  const { canShowRewardedAd, showRewardedAd, getCloseCallMessage } = useAdStore();
  const isNewHigh = score >= highScore && score > 0;
  const [showingAd, setShowingAd] = useState(false);

  const levelDef = LEVELS.find(l => l.id === currentLevel);
  const closeCallMsg = levelDef ? getCloseCallMessage(score, levelDef.targetHeight) : null;
  const canRevive = canShowRewardedAd();

  const handleRevive = async () => {
    setShowingAd(true);
    const success = await showRewardedAd();
    setShowingAd(false);
    if (success) {
      onRevive();
    }
  };

  const handleRestart = useSoundClick(onRestart);
  const handleMenu = useSoundClick(onMenu);
  const handleReviveClick = useSoundClick(handleRevive);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-destructive/20 to-transparent pointer-events-none" />

      <div className="flex flex-col items-center gap-5 animate-fade-in">
        <div className="text-center">
          <h2 className="text-4xl md:text-5xl font-display font-black text-destructive">
            LEVEL {currentLevel} — GAME OVER
          </h2>
          {isNewHigh && (
            <p className="text-accent font-display font-bold text-lg mt-1 animate-float text-glow-accent">
              ⭐ NEW HIGH SCORE! ⭐
            </p>
          )}
        </div>

        {closeCallMsg && (
          <div className="glass-panel px-6 py-3 text-center border border-accent/30">
            <p className="text-sm font-display font-bold text-accent text-glow-accent">
              {closeCallMsg}
            </p>
          </div>
        )}

        <div className="flex gap-4">
          <div className="glass-panel px-6 py-4 text-center min-w-[100px]">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Score</p>
            <p className="text-3xl font-display font-bold text-foreground">{score}</p>
          </div>
          <div className="glass-panel px-6 py-4 text-center min-w-[100px]">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Best</p>
            <p className="text-3xl font-display font-bold text-primary text-glow-primary">{Math.max(highScore, score)}</p>
          </div>
          <div className="glass-panel px-6 py-4 text-center min-w-[100px]">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Coins</p>
            <p className="text-3xl font-display font-bold text-accent coin-glow">+{coins}</p>
          </div>
        </div>

        {canRevive && (
          <button
            onClick={handleReviveClick}
            disabled={showingAd}
            className="px-8 py-3 rounded-xl font-display font-bold text-foreground
              glass-panel border border-accent/50
              hover:scale-105 active:scale-95 transition-transform duration-150
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {showingAd ? '⏳ Loading…' : '🛡️ CONTINUE (Ad)'}
          </button>
        )}

        <div className="glass-panel px-8 py-3 text-center opacity-30">
          <p className="text-xs text-muted-foreground font-body">📺 Ad Space (SDK ready)</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleRestart}
            className="px-8 py-3 rounded-xl font-display font-bold text-primary-foreground
              bg-gradient-to-r from-primary to-lava-glow
              hover:scale-105 active:scale-95 transition-transform duration-150 lava-glow"
          >
            🔁 RETRY
          </button>
          <button
            onClick={handleMenu}
            className="px-8 py-3 rounded-xl font-display font-semibold
              glass-panel text-foreground
              hover:scale-105 active:scale-95 transition-transform duration-150"
          >
            MENÜ
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverScreen;
