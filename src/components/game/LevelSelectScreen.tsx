import { useGameStore } from '@/stores/gameStore';
import { LEVELS } from '@/game/constants';
import { useSoundClick } from '@/hooks/useSoundClick';
import EmberBackground from '@/components/game/EmberBackground';

interface LevelSelectScreenProps {
  onSelectLevel: (levelId: number) => void;
  onBack: () => void;
}

const LevelSelectScreen = ({ onSelectLevel, onBack }: LevelSelectScreenProps) => {
  const { maxUnlockedLevel, getStarsForLevel } = useGameStore();
  const handleBack = useSoundClick(onBack);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
      <EmberBackground />
      <div className="flex flex-col items-center gap-6 animate-fade-in max-w-lg w-full px-4 relative z-10">
        <div className="text-center relative">
          <div className="absolute inset-0 -inset-x-12 -inset-y-8 rounded-full blur-3xl bg-lava/15 animate-pulse-lava" />
          <h2 className="text-3xl font-display font-bold text-primary text-glow-primary relative">SELECT LEVEL</h2>
          <p className="text-sm text-muted-foreground font-body mt-1 relative">
            {maxUnlockedLevel} of {LEVELS.length} unlocked
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
          BACK
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
