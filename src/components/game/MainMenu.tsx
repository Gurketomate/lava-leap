import { useGameStore } from '@/stores/gameStore';
import { useSoundClick } from '@/hooks/useSoundClick';
import EmberBackground from '@/components/game/EmberBackground';
import { Settings, Maximize, Minimize } from 'lucide-react';
import { useState, useCallback } from 'react';

interface MainMenuProps {
  onStart: () => void;
  onShop: () => void;
  onSettings: () => void;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
}

const MainMenu = ({ onStart, onShop, onSettings }: MainMenuProps) => {
  const { highScore, totalCoins } = useGameStore();
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const handleStart = useSoundClick(onStart);
  const handleShop = useSoundClick(onShop);
  const handleSettings = useSoundClick(onSettings);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const embersRef = useRef<Ember[]>([]);
  const animRef = useRef<number>(0);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    } else {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    }
  }, []);

  // Ember particle system
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const spawnEmber = (): Ember => ({
      x: Math.random() * canvas.width,
      y: canvas.height + 10,
      vx: (Math.random() - 0.5) * 30,
      vy: -(30 + Math.random() * 60),
      size: 1.5 + Math.random() * 3,
      opacity: 0.4 + Math.random() * 0.6,
      life: 3 + Math.random() * 4,
      maxLife: 7,
    });

    // Seed initial embers
    for (let i = 0; i < 25; i++) {
      const e = spawnEmber();
      e.y = Math.random() * canvas.height;
      embersRef.current.push(e);
    }

    let lastTime = performance.now();
    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Spawn new embers
      if (Math.random() < 0.3) {
        embersRef.current.push(spawnEmber());
      }

      // Update & render embers
      embersRef.current = embersRef.current.filter(e => {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vx += (Math.random() - 0.5) * 20 * dt;
        e.life -= dt;

        const alpha = Math.min(1, e.life / (e.maxLife * 0.3)) * e.opacity;
        if (alpha <= 0) return false;

        // Glow
        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.size * 3);
        grad.addColorStop(0, `rgba(255, 120, 20, ${alpha * 0.4})`);
        grad.addColorStop(1, 'rgba(255, 60, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(e.x - e.size * 3, e.y - e.size * 3, e.size * 6, e.size * 6);

        // Core
        ctx.fillStyle = `rgba(255, ${150 + Math.random() * 80}, 30, ${alpha})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();

        return true;
      });

      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
      {/* Ember particle canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Top buttons */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <button
          onClick={toggleFullscreen}
          className="p-3 rounded-xl glass-panel text-muted-foreground
            hover:text-foreground hover:scale-110 active:scale-95 transition-all duration-150"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
        </button>
        <button
          onClick={handleSettings}
          className="p-3 rounded-xl glass-panel text-muted-foreground
            hover:text-foreground hover:scale-110 active:scale-95 transition-all duration-150"
        >
          <Settings size={22} />
        </button>
      </div>

      {/* Lava glow at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-lava/30 via-lava/10 to-transparent z-0" />

      <div className="flex flex-col items-center gap-8 animate-fade-in relative z-10">
        {/* Title with glow */}
        <div className="text-center relative">
          {/* Glow backdrop behind title */}
          <div className="absolute inset-0 -inset-x-12 -inset-y-8 rounded-full blur-3xl bg-lava/15 animate-pulse-lava" />
          
          <h1 className="text-5xl md:text-7xl font-display font-black text-primary text-glow-primary tracking-tight relative">
            🔥 LAVA LEAP
          </h1>
          <p className="text-muted-foreground font-body mt-3 text-sm tracking-widest relative">
            Jump. Collect. Survive.
          </p>
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="glass-panel px-5 py-3 text-center">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">High Score</p>
            <p className="text-2xl font-display font-bold text-primary text-glow-primary">{highScore}</p>
          </div>
          <div className="glass-panel px-5 py-3 text-center">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Coins</p>
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
            PLAY
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
        <div className="text-xs text-muted-foreground/60 font-body text-center max-w-xs space-y-1">
          <p>⬅️ ➡️ Arrow Keys or A / D to move</p>
          <p>🪶 SPACE for Double Jump (when active)</p>
          <p className="text-muted-foreground/40">📱 Tap left/right on mobile • Two-finger tap for double jump</p>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
