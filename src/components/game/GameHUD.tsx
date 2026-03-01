import { useGameStore } from '@/stores/gameStore';

const GameHUD = () => {
  const { score, coins, lavaProximity, activePowerUps, phase, screenShake } = useGameStore();

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Score */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <div className="glass-panel px-6 py-2 text-center">
          <p className="text-xs text-muted-foreground font-body uppercase tracking-widest">Höhe</p>
          <p className="text-2xl font-display font-bold text-foreground">{score}</p>
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
