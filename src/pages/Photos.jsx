import { useRef, useCallback } from 'react'
import styles from './Photos.module.css'

const PHOTOS = [
  { src: '/photos/1.jpg', alt: 'Campus at night' },
  { src: '/photos/2.jpg', alt: 'Sunset on campus' },
  { src: '/photos/3.jpg', alt: 'Winter sunrise' },
  { src: '/photos/4.jpg', alt: 'Snowy path' },
  { src: '/photos/5.jpg', alt: 'Toronto skyline' },
  { src: '/photos/6.jpg', alt: 'Roller coaster sunset' },
  { src: '/photos/7.jpg', alt: 'Pink winter sunset' },
  { src: '/photos/8.jpg', alt: 'Canada geese on campus' },
  { src: '/photos/9.jpg', alt: 'Snowy night path' },
]

export default function Photos() {
  const audioRef = useRef(null)
  const playingRef = useRef(false)

  const startMusic = useCallback(() => {
    const audio = audioRef.current
    if (!audio || playingRef.current) return
    audio.volume = 0
    audio.play().then(() => {
      playingRef.current = true
      // Fade in
      let v = 0
      const fade = setInterval(() => {
        v = Math.min(v + 0.05, 0.45)
        audio.volume = v
        if (v >= 0.45) clearInterval(fade)
      }, 40)
    }).catch(() => {})
  }, [])

  const stopMusic = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !playingRef.current) return
    // Fade out
    let v = audio.volume
    const fade = setInterval(() => {
      v = Math.max(v - 0.05, 0)
      audio.volume = v
      if (v <= 0) {
        clearInterval(fade)
        audio.pause()
        audio.currentTime = 0
        playingRef.current = false
      }
    }, 40)
  }, [])

  return (
    <div className={styles.page}>
      <audio ref={audioRef} src="/song.mp3" loop preload="none" />

      <h2 className={styles.pageTitle}>Photos</h2>

      <div
        className={styles.grid}
        onMouseEnter={startMusic}
        onMouseLeave={stopMusic}
      >
        {PHOTOS.map((p, i) => (
          <div
            key={i}
            className={styles.slot}
            onClick={startMusic}
          >
            <img src={p.src} alt={p.alt} loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  )
}
