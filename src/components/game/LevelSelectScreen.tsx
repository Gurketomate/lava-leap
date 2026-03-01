import { useGameStore } from '@/stores/gameStore';
import { LEVELS } from '@/game/constants';

interface LevelSelectScreenProps {
  onSelectLevel: (levelId: number) => void;
  onBack: () => void;
}

const LevelSelectScreen = ({ onSelectLevel, onBack }: LevelSelectScreenProps) => {
  const { maxUnlockedLevel } = useGameStore();

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 animate-fade-in max-w-lg w-full px-4">
        <div className="text-center">
          <h2 className="text-3xl font-display font-bold text-foreground">LEVEL WÄHLEN</h2>
          <p className="text-sm text-muted-foreground font-body mt-1">
            {maxUnlockedLevel} von {LEVELS.length} freigeschaltet
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full max-h-[60vh] overflow-y-auto pr-1">
          {LEVELS.map((level) => {
            const unlocked = level.id <= maxUnlockedLevel;
            return (
              <button
                key={level.id}
                onClick={() => unlocked && onSelectLevel(level.id)}
                disabled={!unlocked}
                className={`glass-panel p-4 text-left transition-all duration-150 ${
                  unlocked
                    ? 'hover:scale-105 active:scale-95 hover:border-primary/50 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-display font-black text-primary text-glow-primary">
                    {unlocked ? level.id : '🔒'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-foreground text-sm truncate">
                      {level.name}
                    </h3>
                    <p className="text-xs text-muted-foreground font-body">
                      Ziel: {level.targetHeight}m
                    </p>
                  </div>
                </div>
                {unlocked && (
                  <div className="mt-2 flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full ${
                          i < Math.ceil(level.id / 2) ? 'bg-primary/60' : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={onBack}
          className="glass-panel px-8 py-3 rounded-xl font-display font-semibold text-foreground
            hover:scale-105 active:scale-95 transition-transform duration-150"
        >
          ZURÜCK
        </button>
      </div>
    </div>
  );
};

export default LevelSelectScreen;
