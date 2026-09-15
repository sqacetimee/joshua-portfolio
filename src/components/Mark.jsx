import styles from './Mark.module.css'

/* Ringed planet mark, matching the favicon. The ring passes behind, then in front of, the planet. */
export default function Mark({ size = 30 }) {
  return (
    <svg className={styles.mark} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <clipPath id="jj-mark-front" clipPathUnits="userSpaceOnUse">
          <rect x="0" y="33" width="64" height="31" />
        </clipPath>
        <radialGradient id="jj-mark-shade" cx="38%" cy="32%" r="72%">
          <stop offset="0" stopColor="#f6f2e8" />
          <stop offset="1" stopColor="#a9a293" />
        </radialGradient>
      </defs>
      <g className={styles.orbit}>
        <circle cx="32" cy="6" r="2" className={styles.moon} />
      </g>
      <g className={styles.ring}>
        <ellipse cx="32" cy="33" rx="25" ry="7" fill="none" stroke="#e8c979" strokeWidth="3.2" />
      </g>
      <circle className={styles.planet} cx="32" cy="33" r="12.5" fill="url(#jj-mark-shade)" />
      <g className={styles.ring} clipPath="url(#jj-mark-front)">
        <ellipse cx="32" cy="33" rx="25" ry="7" fill="none" stroke="#e8c979" strokeWidth="3.2" />
      </g>
    </svg>
  )
}
