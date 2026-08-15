'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface BackButtonProps {
  href?: string;
  label?: string;
  className?: string;
  onClick?: () => void;
}

export default function BackButton({ href, label = 'Back', className = 'mb-6', onClick }: BackButtonProps) {
  const router = useRouter();

  const inner = (
    <span
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-85 active:opacity-70"
      style={{
        background: 'linear-gradient(135deg, #a78bfa, #6C63FF)',
        boxShadow: '0 3px 0 #3D1F9E, 0 6px 14px rgba(108,99,255,0.28)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: -2 }}>
        <path d="M10 3L5 8L10 13" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  );

  if (href) {
    return <Link href={href} className={`inline-block ${className}`}>{inner}</Link>;
  }

  return (
    <button onClick={onClick ?? (() => router.back())} className={`inline-block ${className}`}>
      {inner}
    </button>
  );
}
