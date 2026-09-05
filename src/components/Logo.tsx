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
          <stop offset="0%" stopColor="#7f94ff" />
          <stop offset="100%" stopColor="#4ec8e8" />
        </linearGradient>
      </defs>
      <rect
        x="1.2"
        y="1.2"
        width="37.6"
        height="37.6"
        rx="10"
        fill="#0a1626"
        stroke="url(#cc-logo-sky)"
        strokeWidth="1.8"
      />
      <path
        d="M11 13h18M11 27h18"
        stroke="#2c4260"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M14 12v16M20 12v16M26 12v16"
        stroke="#7d93ad"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <circle cx="14" cy="20" r="2.7" fill="#e0c36a" />
      <circle cx="20" cy="13.8" r="2.7" fill="#4ec8e8" />
      <circle cx="20" cy="26.2" r="2.7" fill="#7f94ff" />
      <circle cx="26" cy="20" r="2.7" fill="#9ae4f5" />
    </svg>
  )
}
