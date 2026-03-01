import { useGameStore } from '@/stores/gameStore';
import { useSoundClick } from '@/hooks/useSoundClick';
import { Settings } from 'lucide-react';

interface MainMenuProps {
  onStart: () => void;
  onShop: () => void;
  onSettings: () => void;
}

const MainMenu = ({ onStart, onShop, onSettings }: MainMenuProps) => {
  const { highScore, totalCoins } = useGameStore();
  const handleStart = useSoundClick(onStart);
  const handleShop = useSoundClick(onShop);
  const handleSettings = useSoundClick(onSettings);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
      {/* Settings button */}
      <button
        onClick={handleSettings}
        className="absolute top-4 right-4 p-3 rounded-xl glass-panel text-muted-foreground
          hover:text-foreground hover:scale-110 active:scale-95 transition-all duration-150"
      >
        <Settings size={22} />
      </button>

      {/* Lava glow at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-lava/20 to-transparent" />

      <div className="flex flex-col items-center gap-8 animate-fade-in">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-display font-black text-primary text-glow-primary tracking-tight">
            VOLCANO
          </h1>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground -mt-2 tracking-widest">
            ESCAPE
          </h2>
          <p className="text-muted-foreground font-body mt-2 text-sm tracking-wider">
            Springe. Sammle. Überlebe.
          </p>
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="glass-panel px-5 py-3 text-center">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Highscore</p>
            <p className="text-2xl font-display font-bold text-primary text-glow-primary">{highScore}</p>
          </div>
          <div className="glass-panel px-5 py-3 text-center">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Münzen</p>
            <p className="text-2xl font-display font-bold text-accent coin-glow">{totalCoins}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-64">
          <button
            onClick={handleStart}
            className="w-full py-4 rounded-xl font-display font-bold text-lg text-primary-foreground
              bg-gradient-to-r from-primary to-lava-glow
              hover:scale-105 active:scale-95 transition-transform duration-150
              lava-glow"
          >
            SPIELEN
          </button>
          <button
            onClick={handleShop}
            className="w-full py-3 rounded-xl font-display font-semibold text-sm
              glass-panel text-foreground hover:bg-muted/50
              hover:scale-105 active:scale-95 transition-transform duration-150"
          >
            🛒 UPGRADES SHOP
          </button>
        </div>

        {/* Controls hint */}
        <p className="text-xs text-muted-foreground/60 font-body text-center max-w-xs">
          Tippe links/rechts zum Steuern • Pfeiltasten am Desktop
        </p>
      </div>
    </div>
  );
};

export default MainMenu;
