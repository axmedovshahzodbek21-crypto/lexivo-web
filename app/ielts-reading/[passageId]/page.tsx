'use client';
import Link from 'next/link';
import { use, useState } from 'react';
import BackButton from '@/components/BackButton';
import { ieltsData } from '@/lib/ielts-data';

const TOTAL_TESTS = 30;

export default function PassagePage({ params }: { params: Promise<{ passageId: string }> }) {
  const { passageId } = use(params);
  const section = ieltsData.find(s => s.passageSection === Number(passageId));
  const availableTests = new Set((section?.tests ?? []).map(t => t.testNumber));
  const [flipped, setFlipped] = useState<number | null>(null);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <BackButton href="/ielts-reading" label="Back to Passages" className="mb-8" />

      <div className="mb-10">
        <p className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-[0.15em] mb-1">IELTS Reading</p>
        <h1 className="text-4xl font-black text-[var(--text)] leading-none">Passage {passageId}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-2">Hover a test to reveal actions. Tap on mobile.</p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical connecting line */}
        <div
          className="absolute top-5 bottom-5 w-px"
          style={{
            left: '19px',
            background: 'linear-gradient(to bottom, var(--primary), var(--border) 60%)',
          }}
        />

        <div className="flex flex-col gap-4">
          {Array.from({ length: TOTAL_TESTS }, (_, i) => i + 1).map(n => {
            const available = availableTests.has(n);
            const test = section?.tests.find(t => t.testNumber === n);
            const isHero = n === 1;
            const isFlipped = flipped === n;

            return (
              <div key={n} className="relative flex items-start gap-4">
                {/* Timeline node */}
                <div
                  className="relative z-10 flex-shrink-0 flex items-center justify-center rounded-full font-black text-xs border-2 transition-all duration-300"
                  style={{
                    width: isHero ? '44px' : '38px',
                    height: isHero ? '44px' : '38px',
                    background: available ? 'var(--primary)' : 'var(--surface)',
                    borderColor: available ? 'var(--primary)' : 'var(--border)',
                    color: available ? '#fff' : 'var(--text-muted)',
                    boxShadow: available ? '0 0 12px color-mix(in srgb, var(--primary) 50%, transparent)' : 'none',
                    marginTop: isHero ? '0px' : '4px',
                  }}
                >
                  {available ? n : '🔒'}
                </div>

                {/* Card */}
                {available ? (
                  <div
                    className="flex-1 cursor-pointer"
                    style={{ perspective: '1200px', minHeight: isHero ? '130px' : '88px' }}
                    onMouseEnter={() => setFlipped(n)}
                    onMouseLeave={() => setFlipped(null)}
                    onClick={() => setFlipped(isFlipped ? null : n)}
                  >
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: isHero ? '130px' : '88px',
                        transformStyle: 'preserve-3d',
                        transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      }}
                    >
                      {/* Front face */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          borderRadius: '16px',
                          overflow: 'hidden',
                          border: `${isHero ? '2px' : '1px'} solid var(--primary)`,
                          background: isHero
                            ? 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, var(--surface)), var(--surface))'
                            : 'var(--surface)',
                          padding: isHero ? '20px' : '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <p
                            style={{
                              fontSize: '10px',
                              fontWeight: 900,
                              color: 'var(--primary)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.12em',
                              marginBottom: '6px',
                            }}
                          >
                            Test {n}
                          </p>
                          <p
                            style={{
                              fontSize: isHero ? '20px' : '13px',
                              fontWeight: 900,
                              color: 'var(--text)',
                              lineHeight: 1.25,
                              display: '-webkit-box',
                              WebkitLineClamp: isHero ? 2 : 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {test?.title}
                          </p>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                          {test?.questions.length} questions · 20 min
                        </p>
                        {isHero && (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                            Hover to start →
                          </p>
                        )}
                      </div>

                      {/* Back face */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                          borderRadius: '16px',
                          border: '2px solid var(--primary)',
                          background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 22%, var(--surface)), var(--surface))',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          padding: '16px',
                        }}
                      >
                        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>
                          {test?.title}
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <Link href={`/ielts-reading/${passageId}/${n}?mode=review`} onClick={e => e.stopPropagation()}>
                            <button
                              className="transition-all"
                              style={{
                                padding: '8px 18px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 700,
                                border: '1.5px solid var(--border)',
                                color: 'var(--text-muted)',
                                background: 'transparent',
                                cursor: 'pointer',
                              }}
                            >
                              📖 Review
                            </button>
                          </Link>
                          <Link href={`/ielts-reading/${passageId}/${n}?mode=test`} onClick={e => e.stopPropagation()}>
                            <button
                              style={{
                                padding: '8px 18px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 700,
                                background: 'var(--primary)',
                                color: '#fff',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              📝 Test
                            </button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex-1 rounded-2xl p-3"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      opacity: 0.28,
                      minHeight: '56px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Test {n}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Coming soon</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
