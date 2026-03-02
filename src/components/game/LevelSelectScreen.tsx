import { useGameStore } from '@/stores/gameStore';
import { LEVELS } from '@/game/constants';
import { useSoundClick } from '@/hooks/useSoundClick';

interface LevelSelectScreenProps {
  onSelectLevel: (levelId: number) => void;
  onBack: () => void;
}

const LevelSelectScreen = ({ onSelectLevel, onBack }: LevelSelectScreenProps) => {
  const { maxUnlockedLevel, getStarsForLevel } = useGameStore();
  const handleBack = useSoundClick(onBack);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 animate-fade-in max-w-lg w-full px-4">
        <div className="text-center">
          <h2 className="text-3xl font-display font-bold text-foreground">LEVEL WÄHLEN</h2>
          <p className="text-sm text-muted-foreground font-body mt-1">
            {maxUnlockedLevel} von {LEVELS.length} freigeschaltet
          </p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 w-full max-h-[60vh] overflow-y-auto pr-1">
          {LEVELS.map((level) => {
            const unlocked = level.id <= maxUnlockedLevel;
            const stars = getStarsForLevel(level.id);
            return (
              <LevelButton key={level.id} level={level} unlocked={unlocked} stars={stars} onSelect={onSelectLevel} />
            );
          })}
        </div>

        <button
          onClick={handleBack}
          className="glass-panel px-8 py-3 rounded-xl font-display font-semibold text-foreground
            hover:scale-105 active:scale-95 transition-transform duration-150"
        >
          ZURÜCK
        </button>
      </div>
    </div>
  );
};

const LevelButton = ({ level, unlocked, stars, onSelect }: { level: any; unlocked: boolean; stars: number; onSelect: (id: number) => void }) => {
  const handleClick = useSoundClick(() => unlocked && onSelect(level.id));

  return (
    <button
      onClick={handleClick}
      disabled={!unlocked}
      className={`glass-panel p-3 text-left transition-all duration-150 ${
        unlocked
          ? 'hover:scale-105 active:scale-95 hover:border-primary/50 cursor-pointer'
          : 'opacity-40 cursor-not-allowed'
      }`}
    >
      <div className="flex flex-col items-center gap-1">
        <span className="text-xl font-display font-black text-primary text-glow-primary">
          {unlocked ? level.id : '🔒'}
        </span>
        <h3 className="font-display font-bold text-foreground text-xs truncate w-full text-center">
          {level.name}
        </h3>
        {unlocked && stars > 0 ? (
          <p className="text-[10px]">
            {'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground font-body">
            {level.targetHeight}m
          </p>
        )}
      </div>
    </button>
  );
};

export default LevelSelectScreen;
