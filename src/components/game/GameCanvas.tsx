import { useEffect, useRef, useCallback } from 'react';
import { GameEngine } from '@/game/GameEngine';
import { useGameStore } from '@/stores/gameStore';
import { unlockAudio } from '@/game/SoundManager';

interface GameCanvasProps {
  onReady: (engine: GameEngine) => void;
}

const GameCanvas = ({ onReady }: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const store = useGameStore();

  const handleTouch = useCallback((e: React.TouchEvent | React.MouseEvent, isEnd = false) => {
    if (!engineRef.current || !engineRef.current.running) return;
    e.preventDefault();
    unlockAudio();

    if (isEnd) {
      engineRef.current.setInput(0);
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    let clientX: number;
    if ('touches' in e) {
      if (e.touches.length === 0) {
        engineRef.current.setInput(0);
        return;
      }
      clientX = e.touches[0].clientX;
      // Two-finger tap for double jump
      if (e.touches.length >= 2) {
        engineRef.current.doDoubleJump();
      }
    } else {
      clientX = e.clientX;
    }

    const relX = clientX - rect.left;
    const mid = rect.width / 2;
    engineRef.current.setInput(relX < mid ? -1 : 1);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas);
    engineRef.current = engine;
    onReady(engine);

    const handleResize = () => {
      engine.resize();
    };

    window.addEventListener('resize', handleResize);

    // Keyboard support for desktop
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') engine.setInput(-1);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') engine.setInput(1);
      if (e.key === ' ') { e.preventDefault(); engine.doDoubleJump(); }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D'].includes(e.key)) engine.setInput(0);
    };

    // Tab blur/focus pause
    const handleVisibilityChange = () => {
      if (document.hidden && engine.running) {
        engine.paused = true;
      } else if (!document.hidden && engine.running && engine.paused) {
        engine.paused = false;
        engine.lastTime = performance.now();
        requestAnimationFrame(engine.loop);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      engine.destroy();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onReady]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full touch-none"
      onTouchStart={(e) => handleTouch(e)}
      onTouchMove={(e) => handleTouch(e)}
      onTouchEnd={(e) => handleTouch(e, true)}
      onMouseDown={(e) => handleTouch(e)}
      onMouseUp={(e) => handleTouch(e, true)}
    />
  );
};

export default GameCanvas;
