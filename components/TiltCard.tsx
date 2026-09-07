'use client';
import { useRef, useCallback, ReactNode, CSSProperties } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  intensity?: number;
  glare?: boolean;
  lift?: boolean;
  style?: CSSProperties;
  /** render 3D slab side-faces so the card reads as a physical object on deep tilt */
  edge?: boolean;
  edgeDepth?: number;
}

export default function TiltCard({
  children,
  className = '',
  intensity = 8,
  glare = true,
  lift = true,
  style,
  edge = false,
  edgeDepth = 12,
}: Props) {
  const ref       = useRef<HTMLDivElement>(null);
  const glareRef  = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;

    el.style.transform = `perspective(900px) rotateX(${-y * intensity}deg) rotateY(${x * intensity}deg) translateZ(${lift ? 10 : 0}px)`;
    // realistic cast: the resting shadow, shifted opposite the tilt as the card leans
    el.style.boxShadow = `${x * -10}px ${10 - y * 12}px 22px rgba(20,16,10,0.12), ${x * -22}px ${30 - y * 20}px 56px rgba(20,16,10,0.10)`;

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
    // restore the caller's resting shadow (e.g. var(--card-elev)) instead of
    // wiping it — otherwise a card loses its shadow after the first hover.
    el.style.boxShadow = (style?.boxShadow as string | undefined) ?? '';
    if (glare && glareRef.current) glareRef.current.style.opacity = '0';
  }, [glare, style?.boxShadow]);

  return (
    <div
      ref={ref}
      className={`tilt-card ${edge ? 'tilt-3d' : ''} ${className}`}
      style={style}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {children}

      {edge && (
        <>
          <div className="tilt-edge tilt-edge-bottom" style={{ height: edgeDepth }} aria-hidden />
          <div className="tilt-edge tilt-edge-right" style={{ width: edgeDepth }} aria-hidden />
        </>
      )}

      {glare && (
        <div
          ref={glareRef}
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-200"
          style={{ borderRadius: 'inherit', zIndex: 2 }}
        />
      )}
    </div>
  );
}
