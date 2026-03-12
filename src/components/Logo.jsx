export default function Logo() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="JJ"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Outer circle — orbit ring */}
      <circle cx="18" cy="18" r="16.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" opacity="0.35" />

      {/* Inner solid circle — planet */}
      <circle cx="18" cy="18" r="10" stroke="currentColor" strokeWidth="1" opacity="0.9" fill="none" />

      {/* Small dot — satellite */}
      <circle cx="18" cy="4.5" r="1.5" fill="currentColor" opacity="0.6" />

      {/* JJ text in center */}
      <text
        x="18"
        y="22.5"
        textAnchor="middle"
        fontFamily="'EB Garamond', Georgia, serif"
        fontStyle="italic"
        fontSize="11"
        fill="currentColor"
        opacity="0.95"
        letterSpacing="-0.5"
      >
        jj
      </text>
    </svg>
  )
}
