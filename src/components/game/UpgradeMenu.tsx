import type { PowerUp } from '@/game/types';
import { useSoundClick } from '@/hooks/useSoundClick';

interface UpgradeMenuProps {
  choices: PowerUp[];
  onSelect: (powerUp: PowerUp) => void;
}

const UpgradeMenu = ({ choices, onSelect }: UpgradeMenuProps) => {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="text-center">
          <p className="text-xs text-accent font-display uppercase tracking-[0.3em]">Level Up</p>
          <h2 className="text-3xl font-display font-bold text-foreground mt-1">
            WÄHLE EIN UPGRADE
          </h2>
        </div>

        <div className="flex gap-4">
          {choices.map((choice) => (
            <UpgradeChoice key={choice.type} choice={choice} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
};

const UpgradeChoice = ({ choice, onSelect }: { choice: PowerUp; onSelect: (p: PowerUp) => void }) => {
  const handleClick = useSoundClick(() => onSelect(choice));

  return (
    <button
      onClick={handleClick}
      className="glass-panel p-6 w-52 flex flex-col items-center gap-3 text-center
        hover:scale-105 active:scale-95 transition-all duration-200
        hover:border-primary/50 cursor-pointer group"
    >
      <span className="text-4xl group-hover:animate-float">{choice.icon}</span>
      <h3 className="font-display font-bold text-foreground text-lg">{choice.name}</h3>
      <p className="text-sm text-muted-foreground font-body">{choice.description}</p>
    </button>
  );
};

export default UpgradeMenu;
