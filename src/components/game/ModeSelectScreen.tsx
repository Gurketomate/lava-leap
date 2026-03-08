import { useGameStore } from '@/stores/gameStore';
import { useSoundClick } from '@/hooks/useSoundClick';
import { ArrowLeft, Mountain, Infinity } from 'lucide-react';

interface ModeSelectScreenProps {
  onLevelMode: () => void;
  onEndlessMode: () => void;
  onBack: () => void;
}

const ModeSelectScreen = ({ onLevelMode, onEndlessMode, onBack }: ModeSelectScreenProps) => {
  const { endlessHighScore } = useGameStore();
  const handleLevel = useSoundClick(onLevelMode);
  const handleEndless = useSoundClick(onEndlessMode);
  const handleBack = useSoundClick(onBack);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-lava/20 to-transparent" />

      <button
        onClick={handleBack}
        className="absolute top-4 left-4 p-3 rounded-xl glass-panel text-muted-foreground
          hover:text-foreground hover:scale-110 active:scale-95 transition-all duration-150"
      >
        <ArrowLeft size={22} />
      </button>

      <div className="flex flex-col items-center gap-8 animate-fade-in">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-display font-black text-primary text-glow-primary tracking-tight">
            SELECT MODE
          </h1>
          <p className="text-muted-foreground font-body mt-2 text-sm tracking-wider">
            Choose your challenge
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 w-full max-w-md px-4">
          {/* Level Mode */}
          <button
            onClick={handleLevel}
            className="flex-1 py-6 px-6 rounded-xl glass-panel text-foreground
              hover:scale-105 active:scale-95 transition-all duration-150
              border border-primary/20 hover:border-primary/50
              flex flex-col items-center gap-3"
          >
            <Mountain size={36} className="text-primary" />
            <span className="font-display font-bold text-lg">Level Mode</span>
            <span className="text-xs text-muted-foreground font-body text-center">
              50 levels with stars & progression
            </span>
          </button>

          {/* Endless Mode */}
          <button
            onClick={handleEndless}
            className="flex-1 py-6 px-6 rounded-xl glass-panel text-foreground
              hover:scale-105 active:scale-95 transition-all duration-150
              border border-accent/20 hover:border-accent/50
              flex flex-col items-center gap-3"
          >
            <Infinity size={36} className="text-accent" />
            <span className="font-display font-bold text-lg">Endless Mode</span>
            <span className="text-xs text-muted-foreground font-body text-center">
              Climb as high as you can
            </span>
            {endlessHighScore > 0 && (
              <div className="glass-panel px-3 py-1 mt-1">
                <span className="text-xs text-muted-foreground font-body">Best: </span>
                <span className="text-sm font-display font-bold text-accent coin-glow">{endlessHighScore}</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModeSelectScreen;
