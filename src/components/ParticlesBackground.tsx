"use client";

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export default function ParticlesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = Array.from({ length: 60 }, (_, i) => {
      const angle = (i / 60) * Math.PI * 2;
      const radius = Math.random() * 80 + 300;
      const centerY = canvas.height * 0.55;
      return {
        x: canvas.width / 2 + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
      };
    });

    function animate() {
      if (!ctx || !canvas) return;
      
      ctx.fillStyle = 'rgba(19, 21, 26, 1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle, i) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        const margin = 50;
        const headerHeight = 80;
        
        if (particle.x < margin) {
          particle.x = margin;
          particle.vx *= -1;
        }
        if (particle.x > canvas.width - margin) {
          particle.x = canvas.width - margin;
          particle.vx *= -1;
        }
        if (particle.y < headerHeight) {
          particle.y = headerHeight;
          particle.vy *= -1;
        }
        if (particle.y > canvas.height - margin) {
          particle.y = canvas.height - margin;
          particle.vy *= -1;
        }

        particles.slice(i + 1).forEach(other => {
          const dx = other.x - particle.x;
          const dy = other.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * (1 - distance / 150)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        });
      });

      requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ background: '#13151a' }}
      />
    </div>
  );
} 