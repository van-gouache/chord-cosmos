/** Compact Chord Cosmos mark: four chord-tone dots on a night-sky board. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="Chord Cosmos"
    >
      <defs>
        <linearGradient id="cc-logo-sky" x1="6" y1="2" x2="36" y2="38">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <rect
        x="1.2"
        y="1.2"
        width="37.6"
        height="37.6"
        rx="10"
        fill="#12121f"
        stroke="url(#cc-logo-sky)"
        strokeWidth="1.8"
      />
      <path
        d="M11 13h18M11 27h18"
        stroke="#383850"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M14 12v16M20 12v16M26 12v16"
        stroke="#7a7a96"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <circle cx="14" cy="20" r="2.7" fill="#fbbf24" />
      <circle cx="20" cy="13.8" r="2.7" fill="#38bdf8" />
      <circle cx="20" cy="26.2" r="2.7" fill="#a78bfa" />
      <circle cx="26" cy="20" r="2.7" fill="#7dd3fc" />
    </svg>
  )
}
