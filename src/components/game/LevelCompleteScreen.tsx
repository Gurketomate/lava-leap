import { useGameStore } from '@/stores/gameStore';

interface LevelCompleteScreenProps {
  onNextLevel: () => void;
  onMenu: () => void;
}

const LevelCompleteScreen = ({ onNextLevel, onMenu }: LevelCompleteScreenProps) => {
  const { score, coins, currentLevel } = useGameStore();

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-accent/20 to-transparent" />

      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="text-center">
          <p className="text-xs text-accent font-display uppercase tracking-[0.3em] animate-float">
            ⭐ GESCHAFFT ⭐
          </p>
          <h2 className="text-4xl md:text-5xl font-display font-black text-foreground mt-2">
            LEVEL {currentLevel}
          </h2>
          <p className="text-lg text-accent font-display font-bold mt-1 text-glow-accent">
            ABGESCHLOSSEN!
          </p>
        </div>

        <div className="flex gap-4">
          <div className="glass-panel px-6 py-4 text-center min-w-[100px]">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Höhe</p>
            <p className="text-3xl font-display font-bold text-foreground">{score}</p>
          </div>
          <div className="glass-panel px-6 py-4 text-center min-w-[100px]">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Münzen</p>
            <p className="text-3xl font-display font-bold text-accent coin-glow">+{coins}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onNextLevel}
            className="px-8 py-3 rounded-xl font-display font-bold text-primary-foreground
              bg-gradient-to-r from-accent to-primary
              hover:scale-105 active:scale-95 transition-transform duration-150 lava-glow"
          >
            NÄCHSTES LEVEL
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

export default LevelCompleteScreen;
