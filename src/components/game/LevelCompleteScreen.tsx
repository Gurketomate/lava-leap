import { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useAdStore } from '@/stores/adStore';
import { useSoundClick } from '@/hooks/useSoundClick';
import EmberBackground from '@/components/game/EmberBackground';

interface LevelCompleteScreenProps {
  onNextLevel: () => void;
  onMenu: () => void;
}

interface StarCondition {
  label: string;
  met: boolean;
}

const STAR_LABELS = [
  '',
  'Well done!',
  'Great run!',
  'Perfect Run! 🔥',
];

const LevelCompleteScreen = ({ onNextLevel, onMenu }: LevelCompleteScreenProps) => {
  const { score, coins, currentLevel, lastRunStars, runCoinPercent, runDeaths, runTotalCoinsSpawned } = useGameStore();
  const { canShowMilestoneInterstitial, showInterstitial } = useAdStore();
  const [adShown, setAdShown] = useState(false);
  const [animPhase, setAnimPhase] = useState(0); // 0=coins, 1=star1, 2=star2, 3=star3, 4=done

  const handleNextLevel = useSoundClick(onNextLevel);
  const handleMenu = useSoundClick(onMenu);

  const coinPct = Math.round(runCoinPercent * 100);
  const coinsCollected = coins;
  const coinsTotal = runTotalCoinsSpawned > 0 ? runTotalCoinsSpawned : (coinPct > 0 ? Math.round(coins / (runCoinPercent || 1)) : coins);

  // Star conditions
  const conditions: StarCondition[] = [
    { label: 'Complete the level', met: true },
    { label: 'Collect ≥60% coins', met: runCoinPercent >= 0.60 },
    { label: '≥85% coins + 0 deaths', met: runCoinPercent >= 0.85 && runDeaths === 0 },
  ];

  useEffect(() => {
    if (!adShown && canShowMilestoneInterstitial(currentLevel)) {
      setAdShown(true);
      showInterstitial().then(() => {
        console.log('[AdManager] Milestone interstitial after level', currentLevel);
      });
    }
  }, [currentLevel, adShown, canShowMilestoneInterstitial, showInterstitial]);

  // Staggered animation phases
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setAnimPhase(1), 400));   // star 1
    timers.push(setTimeout(() => setAnimPhase(2), 900));   // star 2
    timers.push(setTimeout(() => setAnimPhase(3), 1400));  // star 3
    timers.push(setTimeout(() => setAnimPhase(4), 1800));  // done
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-accent/20 to-transparent" />

      <div className="flex flex-col items-center gap-5 animate-fade-in max-w-sm w-full px-4">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs text-accent font-display uppercase tracking-[0.3em]">
            COMPLETE
          </p>
          <h2 className="text-4xl md:text-5xl font-display font-black text-foreground mt-1">
            LEVEL {currentLevel}
          </h2>
        </div>

        {/* Coin counter */}
        <div className="glass-panel px-6 py-3 text-center">
          <p className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1">Coins Collected</p>
          <p className="text-3xl font-display font-bold text-accent coin-glow">
            {coinsCollected} <span className="text-lg text-muted-foreground">/ {coinsTotal}</span>
          </p>
          <p className={`text-sm font-display font-bold mt-1 ${
            coinPct >= 85 ? 'text-accent' : coinPct >= 60 ? 'text-foreground' : 'text-muted-foreground'
          }`}>
            {coinPct}%
          </p>
        </div>

        {/* Stars with conditions */}
        <div className="flex flex-col gap-3 w-full">
          {conditions.map((cond, i) => {
            const starIndex = i + 1;
            const revealed = animPhase >= starIndex;
            const earned = cond.met && lastRunStars >= starIndex;

            return (
              <div
                key={starIndex}
                className={`flex items-center gap-3 transition-all duration-500 ${
                  revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
              >
                {/* Star icon with animation */}
                <div className="relative flex-shrink-0">
                  <span
                    className={`text-3xl block transition-all duration-500 ${
                      revealed && earned
                        ? 'scale-125'
                        : 'scale-100 grayscale opacity-30'
                    }`}
                    style={{
                      filter: revealed && earned ? 'drop-shadow(0 0 8px hsl(var(--accent)))' : undefined,
                    }}
                  >
                    ⭐
                  </span>
                  {/* Coin-to-star burst effect */}
                  {revealed && earned && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {[...Array(4)].map((_, j) => (
                        <span
                          key={j}
                          className="absolute text-xs animate-ping"
                          style={{
                            animationDuration: '0.6s',
                            animationIterationCount: '1',
                            animationFillMode: 'forwards',
                            transform: `rotate(${j * 90}deg) translateY(-12px)`,
                            opacity: 0,
                          }}
                        >
                          🪙
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Condition text */}
                <div className="flex-1">
                  <p className={`text-sm font-display font-semibold transition-colors duration-300 ${
                    revealed && earned ? 'text-accent' : revealed ? 'text-muted-foreground' : 'text-transparent'
                  }`}>
                    {cond.label}
                  </p>
                  {revealed && !earned && (
                    <p className="text-xs text-muted-foreground/60 font-body">Not achieved</p>
                  )}
                </div>

                {/* Check mark */}
                <div className={`text-lg transition-all duration-300 ${
                  revealed ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                }`}>
                  {earned ? '✅' : '❌'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Star label */}
        <p className={`text-sm font-display font-bold text-center transition-all duration-500 ${
          animPhase >= 4 ? 'opacity-100 translate-y-0 text-accent' : 'opacity-0 translate-y-2'
        }`}>
          {STAR_LABELS[lastRunStars] || ''}
        </p>

        {/* Stats row */}
        <div className={`flex gap-4 transition-all duration-500 ${
          animPhase >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          <div className="glass-panel px-5 py-3 text-center min-w-[90px]">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Height</p>
            <p className="text-2xl font-display font-bold text-foreground">{score}</p>
          </div>
          <div className="glass-panel px-5 py-3 text-center min-w-[90px]">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Deaths</p>
            <p className={`text-2xl font-display font-bold ${runDeaths === 0 ? 'text-accent' : 'text-foreground'}`}>{runDeaths}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className={`flex gap-3 transition-all duration-500 ${
          animPhase >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
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
            MENU
          </button>
        </div>
      </div>
    </div>
  );
};

export default LevelCompleteScreen;
