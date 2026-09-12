import { useEffect, useState } from 'react';

export interface PerformanceStats {
  fps: number;
  renderTimeMs: number;
  domNodeCount: number;
  isLagging: boolean;
}

export function useFpsMonitor() {
  const [fps, setFps] = useState<number>(60);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const loop = (currentTime: number) => {
      frameCount++;
      const elapsed = currentTime - lastTime;

      if (elapsed >= 500) {
        const currentFps = Math.round((frameCount * 1000) / elapsed);
        setFps(Math.min(60, currentFps));
        frameCount = 0;
        lastTime = currentTime;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return fps;
}
