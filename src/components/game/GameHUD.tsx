import { useGameStore } from '@/stores/gameStore';
import { LEVELS } from '@/game/constants';

const GameHUD = () => {
  const { score, coins, lavaProximity, activePowerUps, screenShake, currentLevel } = useGameStore();
  const levelDef = LEVELS.find(l => l.id === currentLevel);
  const progress = levelDef ? Math.min(1, score / levelDef.targetHeight) : 0;

  return (
    <div className="absolute inset-0 pointer-events-none z-10" style={{
      transform: screenShake > 0 ? `translate(${(Math.random() - 0.5) * screenShake * 6}px, ${(Math.random() - 0.5) * screenShake * 6}px)` : undefined,
    }}>
      {/* Score + Level */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <div className="glass-panel px-6 py-2 text-center">
          <p className="text-xs text-muted-foreground font-body uppercase tracking-widest">
            Level {currentLevel} — {levelDef?.name}
          </p>
          <p className="text-2xl font-display font-bold text-foreground">{score}<span className="text-sm text-muted-foreground">/{levelDef?.targetHeight}</span></p>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress * 100}%`,
                background: 'linear-gradient(90deg, hsl(var(--accent)), hsl(var(--primary)))',
              }}
            />
          </div>
        </div>
      </div>

      {/* Coins */}
      <div className="absolute top-4 right-4">
        <div className="glass-panel px-4 py-2 flex items-center gap-2">
          <span className="text-lg">🪙</span>
          <span className="text-lg font-display font-bold text-accent coin-glow">{coins}</span>
        </div>
      </div>

      {/* Active Power-ups */}
      {activePowerUps.length > 0 && (
        <div className="absolute top-4 left-4 flex flex-col gap-1">
          {activePowerUps.map((pu) => (
            <div key={pu.type} className="glass-panel px-3 py-1 flex items-center gap-2 text-sm">
              <span>{pu.icon}</span>
              <span className="font-body text-foreground">{pu.stacks > 1 ? `x${pu.stacks}` : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Phase indicator */}
      {phase > 1 && (
        <div className="absolute bottom-6 right-4">
          <div className="glass-panel px-3 py-1 text-xs font-body text-muted-foreground">
            Phase {phase}
          </div>
        </div>
      )}

      {/* Heat Bar (Lava proximity) */}
      <div className="absolute bottom-0 left-0 w-full h-2">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${lavaProximity * 100}%`,
            background: `linear-gradient(90deg, hsl(45, 100%, 50%), hsl(20, 100%, 50%), hsl(0, 100%, 40%))`,
            boxShadow: lavaProximity > 0.5 ? `0 0 ${lavaProximity * 20}px rgba(255, 60, 0, ${lavaProximity})` : 'none',
          }}
        />
      </div>

      {/* Side heat glow */}
      {lavaProximity > 0.3 && (
        <div
          className="absolute inset-0 pointer-events-none animate-pulse-lava"
          style={{
            boxShadow: `inset 0 -${lavaProximity * 100}px ${lavaProximity * 150}px -50px rgba(255, 60, 0, ${lavaProximity * 0.3})`,
          }}
        />
      )}
    </div>
  );
};

export default GameHUD;
