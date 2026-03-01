import { useGameStore } from '@/stores/gameStore';

interface GameOverScreenProps {
  onRestart: () => void;
  onMenu: () => void;
}

const GameOverScreen = ({ onRestart, onMenu }: GameOverScreenProps) => {
  const { score, highScore, coins, currentLevel } = useGameStore();
  const isNewHigh = score >= highScore && score > 0;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-destructive/20 to-transparent" />

      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="text-center">
          <h2 className="text-4xl md:text-5xl font-display font-black text-destructive">
            LEVEL {currentLevel} — GAME OVER
          </h2>
          {isNewHigh && (
            <p className="text-accent font-display font-bold text-lg mt-1 animate-float text-glow-accent">
              ⭐ NEUER HIGHSCORE! ⭐
            </p>
          )}
        </div>

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
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Münzen</p>
            <p className="text-3xl font-display font-bold text-accent coin-glow">+{coins}</p>
          </div>
        </div>

        {/* Ad placeholder */}
        <div className="glass-panel px-8 py-4 text-center opacity-40">
          <p className="text-xs text-muted-foreground font-body">📺 Werbeplatz (SDK ready)</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onRestart}
            className="px-8 py-3 rounded-xl font-display font-bold text-primary-foreground
              bg-gradient-to-r from-primary to-lava-glow
              hover:scale-105 active:scale-95 transition-transform duration-150 lava-glow"
          >
            NOCHMAL
          </button>
          <button
            onClick={onMenu}
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
