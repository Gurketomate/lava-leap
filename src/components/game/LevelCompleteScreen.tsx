import { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useAdStore } from '@/stores/adStore';
import { useSoundClick } from '@/hooks/useSoundClick';

interface LevelCompleteScreenProps {
  onNextLevel: () => void;
  onMenu: () => void;
}

const StarDisplay = ({ stars }: { stars: number }) => (
  <div className="flex gap-2 items-center justify-center">
    {[1, 2, 3].map((i) => (
      <span
        key={i}
        className={`text-4xl transition-all duration-500 ${
          i <= stars ? 'scale-110 animate-float' : 'opacity-20 grayscale'
        }`}
        style={{ animationDelay: `${i * 0.15}s` }}
      >
        ⭐
      </span>
    ))}
  </div>
);

const STAR_LABELS = [
  '',
  'Well done!',
  'Great run!',
  'Perfect Run! 🔥',
];

const LevelCompleteScreen = ({ onNextLevel, onMenu }: LevelCompleteScreenProps) => {
  const { score, coins, currentLevel, lastRunStars, runCoinPercent } = useGameStore();
  const { canShowMilestoneInterstitial, showInterstitial } = useAdStore();
  const [adShown, setAdShown] = useState(false);

  const handleNextLevel = useSoundClick(onNextLevel);
  const handleMenu = useSoundClick(onMenu);

  const coinPct = Math.round(runCoinPercent * 100);

  useEffect(() => {
    if (!adShown && canShowMilestoneInterstitial(currentLevel)) {
      setAdShown(true);
      showInterstitial().then(() => {
        console.log('[AdManager] Milestone interstitial after level', currentLevel);
      });
    }
  }, [currentLevel, adShown, canShowMilestoneInterstitial, showInterstitial]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-accent/20 to-transparent" />

      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="text-center">
          <p className="text-xs text-accent font-display uppercase tracking-[0.3em] animate-float">
            COMPLETE
          </p>
          <h2 className="text-4xl md:text-5xl font-display font-black text-foreground mt-2">
            LEVEL {currentLevel}
          </h2>
          <p className="text-lg text-accent font-display font-bold mt-1 text-glow-accent">
            CLEARED!
          </p>
        </div>

        <StarDisplay stars={lastRunStars} />
        <p className="text-sm text-muted-foreground font-body text-center">
          {STAR_LABELS[lastRunStars] || ''}
        </p>

        <div className="flex gap-4">
          <div className="glass-panel px-6 py-4 text-center min-w-[100px]">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Height</p>
            <p className="text-3xl font-display font-bold text-foreground">{score}</p>
          </div>
          <div className="glass-panel px-6 py-4 text-center min-w-[100px]">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Coins</p>
            <p className="text-3xl font-display font-bold text-accent coin-glow">+{coins}</p>
          </div>
          <div className="glass-panel px-6 py-4 text-center min-w-[100px]">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Collected</p>
            <p className={`text-3xl font-display font-bold ${coinPct >= 85 ? 'text-accent coin-glow' : coinPct >= 60 ? 'text-foreground' : 'text-muted-foreground'}`}>
              {coinPct}%
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleNextLevel}
            className="px-8 py-3 rounded-xl font-display font-bold text-primary-foreground
              bg-gradient-to-r from-accent to-primary
              hover:scale-105 active:scale-95 transition-transform duration-150 lava-glow"
          >
            NEXT LEVEL
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

export default LevelCompleteScreen;
