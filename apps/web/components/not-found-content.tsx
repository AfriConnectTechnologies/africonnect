'use client'

import Link from 'next/link'

function Compass() {
  return (
    <svg
      viewBox="0 0 120 120"
      width="120"
      height="120"
      className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 shrink-0"
      aria-hidden="true"
      style={{ filter: 'drop-shadow(0 2px 8px oklch(0.55 0.18 35 / 0.12))' }}
    >
      <circle cx="60" cy="60" r="56" fill="none" stroke="oklch(0.55 0.18 35 / 0.18)" strokeWidth="1" />
      <circle cx="60" cy="60" r="52" fill="oklch(0.55 0.18 35 / 0.03)" stroke="oklch(0.55 0.18 35 / 0.3)" strokeWidth="1.5" />

      {[0, 90, 180, 270].map((angle) => (
        <line
          key={`major-${angle}`}
          x1="60" y1="10" x2="60" y2="20"
          stroke="oklch(0.55 0.18 35 / 0.45)"
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${angle} 60 60)`}
        />
      ))}
      {[45, 135, 225, 315].map((angle) => (
        <line
          key={`minor-${angle}`}
          x1="60" y1="12" x2="60" y2="18"
          stroke="oklch(0.55 0.18 35 / 0.2)"
          strokeWidth="1"
          strokeLinecap="round"
          transform={`rotate(${angle} 60 60)`}
        />
      ))}

      <text x="60" y="32" textAnchor="middle" fontSize="9" fontWeight="700" fill="oklch(0.55 0.18 35 / 0.65)" fontFamily="system-ui, sans-serif">N</text>
      <text x="60" y="97" textAnchor="middle" fontSize="8" fontWeight="600" fill="oklch(0.55 0.18 35 / 0.3)" fontFamily="system-ui, sans-serif">S</text>
      <text x="93" y="64" textAnchor="middle" fontSize="8" fontWeight="600" fill="oklch(0.55 0.18 35 / 0.3)" fontFamily="system-ui, sans-serif">E</text>
      <text x="27" y="64" textAnchor="middle" fontSize="8" fontWeight="600" fill="oklch(0.55 0.18 35 / 0.3)" fontFamily="system-ui, sans-serif">W</text>

      <g style={{ transformOrigin: '60px 60px', animation: 'compass-needle 4s ease-in-out infinite' }}>
        <polygon points="60,22 56,57 64,57" fill="oklch(0.55 0.22 25)" opacity="0.9" />
        <polygon points="60,98 56,63 64,63" fill="oklch(0.75 0.08 55)" opacity="0.6" />
      </g>

      <circle cx="60" cy="60" r="4.5" fill="oklch(0.55 0.18 35)" />
      <circle cx="60" cy="60" r="2" fill="oklch(0.97 0.008 75)" />
    </svg>
  )
}

export default function NotFoundContent() {
  return (
    <>
      <style>{`
        @keyframes compass-needle {
          0%   { transform: rotate(0deg); }
          12%  { transform: rotate(140deg); }
          28%  { transform: rotate(60deg); }
          44%  { transform: rotate(250deg); }
          58%  { transform: rotate(170deg); }
          74%  { transform: rotate(310deg); }
          88%  { transform: rotate(200deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div className="relative min-h-screen overflow-hidden bg-background">
        <div className="pattern-dots absolute inset-0 opacity-20" />

        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 40% at 70% 30%, oklch(0.55 0.18 35 / 0.06), transparent)',
          }}
        />

        <div className="relative z-10 flex min-h-screen flex-col items-start justify-center px-6 sm:px-10 lg:px-16 max-w-3xl mx-auto">
          <div className="flex items-center gap-1 sm:gap-2 mb-6 animate-slide-up">
            <span className="text-7xl sm:text-8xl md:text-9xl font-black leading-none tracking-tighter select-none text-primary">
              4
            </span>
            <Compass />
            <span className="text-7xl sm:text-8xl md:text-9xl font-black leading-none tracking-tighter select-none text-primary">
              4
            </span>
          </div>

          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mb-2 animate-slide-up opacity-0 text-foreground"
            style={{ animationDelay: '120ms', animationFillMode: 'forwards' }}
          >
            Page not found
          </h1>

          <p
            className="text-sm sm:text-base text-muted-foreground mb-10 animate-slide-up opacity-0"
            style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}
          >
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>

          <div
            className="animate-slide-up opacity-0"
            style={{ animationDelay: '280ms', animationFillMode: 'forwards' }}
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 px-5 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 7.5L8 2L14 7.5M4 6.5V13.5H7V10H9V13.5H12V6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Return to Home
            </Link>
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-[3px]"
          style={{
            background: 'linear-gradient(90deg, oklch(0.55 0.18 35), oklch(0.75 0.15 85), oklch(0.6 0.15 145), oklch(0.55 0.18 35))',
          }}
        />
      </div>
    </>
  )
}
