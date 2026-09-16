import { useRef, useSyncExternalStore } from 'react'
import { getAmbient, setMusicEnabled, subscribeAmbient } from '../lib/ambient'
import styles from './SoundToggle.module.css'

/* Music on/off in the nav. Hidden until the track file is available.
   It answers the press itself rather than waiting for the click that follows, so a tap on a phone and a
   click on a computer both register the moment the finger or the mouse goes down. */
export default function SoundToggle() {
  const { available, enabled, playing } = useSyncExternalStore(subscribeAmbient, getAmbient)
  const byPointer = useRef(false)
  if (!available) return null

  const flip = () => setMusicEnabled(!enabled)

  return (
    <button
      type="button"
      className={styles.toggle}
      data-music-toggle
      data-playing={playing}
      aria-pressed={enabled}
      aria-label={enabled ? 'Turn music off' : 'Turn music on'}
      title="Good Looking (instrumental) · Suki Waterhouse"
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        byPointer.current = true
        flip()
      }}
      onClick={() => {
        // The click after a press is already handled; this is the keyboard's way in
        if (byPointer.current) {
          byPointer.current = false
          return
        }
        flip()
      }}
    >
      <span className={styles.bars} aria-hidden="true"><i /><i /><i /><i /></span>
      <span className={styles.label}>{enabled ? 'sound' : 'muted'}</span>
    </button>
  )
}
