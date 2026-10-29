import React, { useEffect } from 'react';

export const TiltEffect: React.FC = () => {
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let raf = 0;
    let lastX = 0;
    let lastY = 0;

    const handleMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = document.elementFromPoint(lastX, lastY) as HTMLElement | null;
        const card = el?.closest('.glass-panel, .spatial-card, .tilt-3d, div[class*="rounded-2xl"], div[class*="rounded-3xl"], section, article') as HTMLElement | null;

        // Reset previous
        document.querySelectorAll<HTMLElement>('.is-tilted').forEach((c) => {
          c.classList.remove('is-tilted');
          c.style.transform = '';
          c.style.transition = 'transform 0.4s ease';
        });

        if (card && card !== document.body && card !== document.documentElement) {
          const rect = card.getBoundingClientRect();
          if (rect.width < 120 || rect.height < 80) return;
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = (lastX - cx) / (rect.width / 2);
          const dy = (lastY - cy) / (rect.height / 2);
          const rx = (-dy * 5).toFixed(2);
          const ry = (dx * 5).toFixed(2);
          card.classList.add('is-tilted');
          card.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
          card.style.transition = 'transform 0.08s ease-out';
        }
      });
    };

    const handleLeave = () => {
      document.querySelectorAll<HTMLElement>('.is-tilted').forEach((c) => {
        c.classList.remove('is-tilted');
        c.style.transition = 'transform 0.4s ease';
        c.style.transform = '';
      });
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseleave', handleLeave);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseleave', handleLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
};

export default TiltEffect;