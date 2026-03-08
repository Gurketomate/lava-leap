import { useEffect, useRef } from 'react';

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

const EmberBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const embersRef = useRef<Ember[]>([]);
  const animRef = useRef<number>(0);

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

      if (Math.random() < 0.3) {
        embersRef.current.push(spawnEmber());
      }

      embersRef.current = embersRef.current.filter(e => {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vx += (Math.random() - 0.5) * 20 * dt;
        e.life -= dt;

        const alpha = Math.min(1, e.life / (e.maxLife * 0.3)) * e.opacity;
        if (alpha <= 0) return false;

        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.size * 3);
        grad.addColorStop(0, `rgba(255, 120, 20, ${alpha * 0.4})`);
        grad.addColorStop(1, 'rgba(255, 60, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(e.x - e.size * 3, e.y - e.size * 3, e.size * 6, e.size * 6);

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
      embersRef.current = [];
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-lava/30 via-lava/10 to-transparent z-0" />
    </>
  );
};

export default EmberBackground;
