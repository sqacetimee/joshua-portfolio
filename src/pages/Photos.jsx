import { useRef, useCallback } from 'react'
import styles from './Photos.module.css'

// Add your song filenames to each photo (put MP3s in public/)
const PHOTOS = [
  { src: '/photos/1.jpeg',  alt: 'Campus at night',       song: '/songs/1.mp3' },
  { src: '/photos/2.jpeg',  alt: 'Sunset on campus',      song: '/songs/2.mp3' },
  { src: '/photos/3.jpeg',  alt: 'Winter sunrise',        song: '/songs/3.mp3' },
  { src: '/photos/4.jpeg',  alt: 'Snowy path',            song: '/songs/4.mp3' },
  { src: '/photos/5.jpeg',  alt: 'Toronto skyline',       song: '/songs/5.mp3' },
  { src: '/photos/6.jpeg',  alt: 'Roller coaster sunset', song: '/songs/6.mp3' },
  { src: '/photos/7.jpeg',  alt: 'Pink winter sunset',    song: '/songs/7.mp3' },
  { src: '/photos/8.jpeg',  alt: 'Canada geese',          song: '/songs/8.mp3' },
  { src: '/photos/9.jpeg',  alt: 'Snowy night path',      song: '/songs/9.mp3' },
  { src: '/photos/10.jpeg', alt: 'Photo 10',              song: '/songs/10.mp3' },
]

export default function Photos() {
  const audioRef   = useRef(null)
  const fadeRef    = useRef(null)
  const currentRef = useRef(null)

  const clearFade = () => {
    if (fadeRef.current) { clearInterval(fadeRef.current); fadeRef.current = null }
  }

  const fadeTo = useCallback((targetVol, onDone) => {
    clearFade()
    const audio = audioRef.current
    if (!audio) return
    fadeRef.current = setInterval(() => {
      const diff = targetVol - audio.volume
      const step = Math.sign(diff) * Math.min(Math.abs(diff), 0.05)
      audio.volume = Math.max(0, Math.min(1, audio.volume + step))
      if (Math.abs(audio.volume - targetVol) < 0.01) {
        audio.volume = targetVol
        clearFade()
        onDone?.()
      }
    }, 30)
  }, [])

  const handleEnter = useCallback((song) => {
    const audio = audioRef.current
    if (!audio) return

    if (currentRef.current === song) {
      // Same song — just fade back in if paused
      if (audio.paused) audio.play().catch(() => {})
      fadeTo(0.45)
      return
    }

    // Different song — crossfade: fade out, swap, fade in
    currentRef.current = song
    fadeTo(0, () => {
      audio.pause()
      audio.src = song
      audio.currentTime = 0
      audio.play().then(() => fadeTo(0.45)).catch(() => {})
    })
  }, [fadeTo])

  const handleLeave = useCallback(() => {
    fadeTo(0, () => {
      const audio = audioRef.current
      if (audio) { audio.pause(); audio.currentTime = 0 }
      currentRef.current = null
    })
  }, [fadeTo])

  return (
    <div className={styles.page}>
      <audio ref={audioRef} loop preload="none" />

      <h2 className={styles.pageTitle}>Photos</h2>

      <div className={styles.grid} onMouseLeave={handleLeave}>
        {PHOTOS.map((p, i) => (
          <div
            key={i}
            className={styles.slot}
            onMouseEnter={() => handleEnter(p.song)}
            onClick={() => handleEnter(p.song)}
          >
            <img src={p.src} alt={p.alt} loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  )
}
