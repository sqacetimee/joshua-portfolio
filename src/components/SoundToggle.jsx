import { useSyncExternalStore } from 'react'
import { getAmbient, setMusicEnabled, subscribeAmbient } from '../lib/ambient'
import styles from './SoundToggle.module.css'

/* Music on/off in the nav. Hidden until the track file is available. */
export default function SoundToggle() {
  const { available, enabled, playing } = useSyncExternalStore(subscribeAmbient, getAmbient)
  if (!available) return null

  return (
    <button
      type="button"
      className={styles.toggle}
      data-music-toggle
      data-playing={playing}
      aria-pressed={enabled}
      aria-label={enabled ? 'Turn music off' : 'Turn music on'}
      title="Good Looking (instrumental) · Suki Waterhouse"
      onClick={() => setMusicEnabled(!enabled)}
    >
      <span className={styles.bars} aria-hidden="true"><i /><i /><i /><i /></span>
      <span className={styles.label}>{enabled ? 'sound' : 'muted'}</span>
    </button>
  )
}
