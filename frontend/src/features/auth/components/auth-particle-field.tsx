'use client';

import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVx: number;
  baseVy: number;
  size: number;
  alpha: number;
};

const PARTICLE_COUNT = 96;
const INTERACTION_RADIUS = 240;

export function AuthParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = {
      x: -1000,
      y: -1000,
      active: false,
    };
    let animationFrame = 0;
    let particles: Particle[] = [];

    const createParticle = (width: number, height: number): Particle => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      baseVx: (Math.random() - 0.5) * 0.18,
      baseVy: (Math.random() - 0.5) * 0.18,
      size: 0.7 + Math.random() * 2.2,
      alpha: 0.16 + Math.random() * 0.38,
    });

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const { clientWidth, clientHeight } = canvas;
      canvas.width = Math.floor(clientWidth * ratio);
      canvas.height = Math.floor(clientHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles = Array.from({ length: PARTICLE_COUNT }, () => createParticle(clientWidth, clientHeight));
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    };

    const handlePointerLeave = () => {
      pointer.active = false;
    };

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      context.clearRect(0, 0, width, height);

      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < -20) particle.x = width + 20;
        if (particle.x > width + 20) particle.x = -20;
        if (particle.y < -20) particle.y = height + 20;
        if (particle.y > height + 20) particle.y = -20;

        if (pointer.active && !mediaQuery.matches) {
          const dx = pointer.x - particle.x;
          const dy = pointer.y - particle.y;
          const distance = Math.hypot(dx, dy);

          if (distance < INTERACTION_RADIUS) {
            const force = (INTERACTION_RADIUS - distance) / INTERACTION_RADIUS;
            const angle = Math.atan2(dy, dx);
            const tangentX = -Math.sin(angle);
            const tangentY = Math.cos(angle);
            const influence = force * 0.024;
            particle.vx += (dx / Math.max(distance, 1)) * influence * 0.4 + tangentX * influence;
            particle.vy += (dy / Math.max(distance, 1)) * influence * 0.4 + tangentY * influence;
          }
        }

        particle.vx += (particle.baseVx - particle.vx) * 0.012;
        particle.vy += (particle.baseVy - particle.vy) * 0.012;
        particle.vx *= 0.996;
        particle.vy *= 0.996;
        particle.vx = Math.max(Math.min(particle.vx, 0.95), -0.95);
        particle.vy = Math.max(Math.min(particle.vy, 0.95), -0.95);

        context.beginPath();
        context.fillStyle = `rgba(255,255,255,${particle.alpha})`;
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }

      context.lineWidth = 1;

      for (let index = 0; index < particles.length; index += 1) {
        for (let inner = index + 1; inner < particles.length; inner += 1) {
          const first = particles[index];
          const second = particles[inner];
          const distance = Math.hypot(first.x - second.x, first.y - second.y);

          if (distance < 140) {
            context.beginPath();
            context.strokeStyle = `rgba(255,255,255,${0.065 * (1 - distance / 140)})`;
            context.moveTo(first.x, first.y);
            context.lineTo(second.x, second.y);
            context.stroke();
          }
        }
      }

      animationFrame = window.requestAnimationFrame(render);
    };

    resize();
    render();

    window.addEventListener('resize', resize);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="auth-particle-canvas" aria-hidden="true" />;
}
