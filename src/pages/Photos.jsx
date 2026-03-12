import { useRef, useCallback, useState } from 'react'
import styles from './Photos.module.css'

const PHOTOS = [
  { src: '/photos/1.jpeg',  alt: 'Campus at night',       song: '/songs/1.mp3',  name: 'Path (Dream) — Salvia' },
  { src: '/photos/2.jpeg',  alt: 'Sunset on campus',      song: '/songs/2.mp3',  name: 'Flying (Till Death) — CloseMiMind' },
  { src: '/photos/3.jpeg',  alt: 'Canada geese',          song: '/songs/3.mp3',  name: 'Waiting — Leverfall' },
  { src: '/photos/4.jpeg',  alt: 'Roller coaster sunset', song: '/songs/4.mp3',  name: 'Palace — ADTurnUP',             pos: '30% center', start: 30 },
  { src: '/photos/5.jpeg',  alt: 'Toronto skyline',       song: '/songs/5.mp3',  name: "U Weren't Here — Cult Member",  start: 55 },
  { src: '/photos/6.jpeg',  alt: 'Snowy path at night',   song: '/songs/6.mp3',  name: 'Memories Flawed — Killswitch',  start: 17 },
  { src: '/photos/7.jpeg',  alt: 'Pink winter sunset',    song: '/songs/7.mp3',  name: 'A Winter — Juelz' },
  { src: '/photos/8.jpeg',  alt: 'Winter sunrise',        song: '/songs/8.mp3',  name: 'Desert Sand Feels Warm at Night' },
  { src: '/photos/9.jpeg',  alt: 'Snowy night path',      song: '/songs/9.mp3',  name: 'Amanda Putri Hasana — Gambar Indah' },
  { src: '/photos/10.jpeg', alt: 'Sunset on campus',      song: '/songs/10.mp3', name: 'What Would I Do — Strawberry Guy', start: 7 },
]

export default function Photos() {
  const audioRef    = useRef(null)
  const fadeRef     = useRef(null)
  const currentRef  = useRef(null)
  const [activeSong, setActiveSong] = useState(null)

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

  const handleEnter = useCallback((photo) => {
    const audio = audioRef.current
    if (!audio) return

    if (currentRef.current === photo.song) {
      // Same song — just fade back in if paused
      if (audio.paused) audio.play().catch(() => {})
      fadeTo(0.45)
      return
    }

    // Stop any ongoing fade, swap immediately, fade in
    // (iOS requires play() to be called directly in the tap handler — no async delay)
    if (fadeRef.current) { clearInterval(fadeRef.current); fadeRef.current = null }
    currentRef.current = photo.song
    setActiveSong(photo.song)
    audio.pause()
    audio.src = photo.song
    audio.currentTime = photo.start ?? 0
    audio.volume = 0
    audio.play().then(() => fadeTo(0.45)).catch(() => {})
  }, [fadeTo])

  const handleLeave = useCallback(() => {
    setActiveSong(null)
    fadeTo(0, () => {
      const audio = audioRef.current
      if (audio) { audio.pause(); audio.currentTime = 0 }
      currentRef.current = null
    })
  }, [fadeTo])

  return (
    <div className={styles.page}>
      <audio ref={audioRef} loop preload="none" />

      <div className={styles.titleRow}>
        <h2 className={styles.pageTitle}>Photos</h2>
        <span className={styles.mobileHint}>tap to hear ♪</span>
      </div>

      <div className={styles.grid} onMouseLeave={handleLeave}>
        {PHOTOS.map((p, i) => (
          <div
            key={i}
            className={`${styles.slot} ${activeSong === p.song ? styles.slotActive : ''}`}
            onMouseEnter={() => handleEnter(p)}
            onClick={() => handleEnter(p)}
          >
            <img src={p.src} alt={p.alt} loading="lazy" style={p.pos ? { objectPosition: p.pos } : undefined} />
            <span className={styles.songLabel}>{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
