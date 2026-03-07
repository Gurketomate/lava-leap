import { useGameStore } from '@/stores/gameStore';
import { LEVELS } from '@/game/constants';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ActiveEffect } from '@/game/types';

const ITEM_ICONS: Record<string, string> = {
  coinMagnet: '🧲',
  lavaBrake: '❄️',
  shield: '🛡️',
  doubleJump: '🪶',
};

const ITEM_COLORS: Record<string, string> = {
  coinMagnet: '#9b59b6',
  lavaBrake: '#3498db',
  shield: '#f1c40f',
  doubleJump: '#ecf0f1',
};

interface GameHUDProps {
  activeEffects?: ActiveEffect[];
}

const GameHUD = ({ activeEffects = [] }: GameHUDProps) => {
  const { score, coins, lavaProximity, screenShake, currentLevel } = useGameStore();
  const levelDef = LEVELS.find(l => l.id === currentLevel);
  const progress = levelDef ? Math.min(1, score / levelDef.targetHeight) : 0;
  const isMobile = useIsMobile();

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

      {/* Active Effects */}
      {activeEffects.length > 0 && (
        <div className="absolute top-4 left-4 flex flex-col gap-1">
          {activeEffects.map((effect) => {
            const pct = effect.remaining / effect.duration;
            return (
              <div key={effect.type} className="glass-panel px-3 py-1 flex items-center gap-2 text-sm">
                <span>{ITEM_ICONS[effect.type] || '?'}</span>
                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${pct * 100}%`,
                      background: ITEM_COLORS[effect.type] || '#fff',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Double Jump Hint — only when ability is active */}
      {activeEffects.some(e => e.type === 'doubleJump') && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fade-in">
          <div className="glass-panel px-4 py-1.5 text-xs text-muted-foreground font-body flex items-center gap-1.5">
            <span>🪶</span>
            {isMobile ? 'Tap for Double Jump' : 'SPACE for Double Jump'}
          </div>
        </div>
      )}

      {/* Heat Bar */}
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
