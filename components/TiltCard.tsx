'use client';
import { useRef, useCallback, ReactNode, CSSProperties } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  intensity?: number;
  glare?: boolean;
  lift?: boolean;
  style?: CSSProperties;
}

export default function TiltCard({
  children,
  className = '',
  intensity = 8,
  glare = true,
  lift = true,
  style,
}: Props) {
  const ref       = useRef<HTMLDivElement>(null);
  const glareRef  = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;

    el.style.transform = `perspective(800px) rotateX(${-y * intensity}deg) rotateY(${x * intensity}deg) translateZ(${lift ? 10 : 0}px)`;
    el.style.boxShadow = `${x * -16}px ${y * -16}px 32px rgba(108,99,255,0.14), 0 20px 40px rgba(0,0,0,0.08)`;

    if (glare && glareRef.current) {
      const gx = (x + 0.5) * 100;
      const gy = (y + 0.5) * 100;
      glareRef.current.style.background =
        `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.22) 0%, transparent 55%)`;
      glareRef.current.style.opacity = '1';
    }
  }, [intensity, glare, lift]);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = '';
    el.style.boxShadow = '';
    if (glare && glareRef.current) glareRef.current.style.opacity = '0';
  }, [glare]);

  return (
    <div
      ref={ref}
      className={`tilt-card ${className}`}
      style={style}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {children}
      {glare && (
        <div
          ref={glareRef}
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-200"
          style={{ borderRadius: 'inherit', zIndex: 1 }}
        />
      )}
    </div>
  );
}
