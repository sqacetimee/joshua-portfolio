import { useRef, useCallback, useState, useEffect } from 'react'
import styles from './Photos.module.css'

const PHOTOS = [
  { src: '/photos/1.jpeg',  alt: 'Campus at night',       song: '/songs/1.mp3',  name: 'Path (Dream) — Salvia',                  desc: 'the moon found a gap in the clouds, and everything else went quiet' },
  { src: '/photos/2.jpeg',  alt: 'Sunset on campus',      song: '/songs/2.mp3',  name: 'Flying (Till Death) — CloseMiMind',      desc: 'golden hour off the roof, the whole city turned amber' },
  { src: '/photos/3.jpeg',  alt: 'Canada geese',          song: '/songs/3.mp3',  name: 'Waiting — Leverfall',                    desc: 'they never seem in a hurry, which is something to admire' },
  { src: '/photos/4.jpeg',  alt: 'Roller coaster sunset', song: '/songs/4.mp3',  name: 'Palace — ADTurnUP',           pos: '30% center', start: 30, desc: 'that pause at the top right before everything drops away' },
  { src: '/photos/5.jpeg',  alt: 'Toronto at night',      song: '/songs/5.mp3',  name: "U Weren't Here — Cult Member", start: 55, desc: 'somewhere in all those lights, someone is having the best night of their life' },
  { src: '/photos/6.jpeg',  alt: 'Snowy path at night',   song: '/songs/6.mp3',  name: 'Memories Flawed — Killswitch', start: 17, desc: 'lamp-lit snow and pine trees, the whole world muffled and still' },
  { src: '/photos/7.jpeg',  alt: 'Snowy campus night',    song: '/songs/7.mp3',  name: 'A Winter — Juelz',                       desc: 'colored light spilling onto fresh snow, no one else around' },
  { src: '/photos/8.jpeg',  alt: 'Pink winter sunrise',   song: '/songs/8.mp3',  name: 'Desert Sand Feels Warm at Night',         desc: 'the sky caught fire for ten minutes before the day began' },
  { src: '/photos/9.jpeg',  alt: 'Winter sunrise',        song: '/songs/9.mp3',  name: 'Amanda Putri Hasana — Gambar Indah',      desc: 'cold enough your breath disappears, warm enough to stay one more minute' },
  { src: '/photos/10.jpeg', alt: 'Snowy campus path',     song: '/songs/10.mp3', name: 'What Would I Do — Strawberry Guy', start: 7, desc: "the path leads somewhere, and for once you're not in a rush to get there" },
]

export default function Photos() {
  const audioRef   = useRef(null)
  const fadeRef    = useRef(null)
  const currentRef = useRef(null)
  const [lightbox, setLightbox] = useState(null)

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

    setLightbox(photo)

    if (currentRef.current === photo.song) {
      if (audio.paused) audio.play().catch(() => {})
      fadeTo(0.45)
      return
    }

    if (fadeRef.current) { clearInterval(fadeRef.current); fadeRef.current = null }
    currentRef.current = photo.song
    audio.pause()
    audio.src = photo.song
    audio.currentTime = photo.start ?? 0
    audio.volume = 0
    audio.play().then(() => fadeTo(0.45)).catch(() => {})
  }, [fadeTo])

  const handleLeave = useCallback(() => {
    setLightbox(null)
    fadeTo(0, () => {
      const audio = audioRef.current
      if (audio) { audio.pause(); audio.currentTime = 0 }
      currentRef.current = null
    })
  }, [fadeTo])

  // Escape key to close
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e) => { if (e.key === 'Escape') handleLeave() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, handleLeave])

  // Lock body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = lightbox ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightbox])

  return (
    <div className={styles.page}>
      <audio ref={audioRef} loop preload="none" />

      <div className={styles.titleRow}>
        <h2 className={styles.pageTitle}>photos i've taken</h2>
        <span className={styles.mobileHint}>tap to hear ♪</span>
      </div>

      <div className={styles.grid}>
        {PHOTOS.map((p, i) => (
          <div
            key={i}
            className={styles.slot}
            onMouseEnter={() => handleEnter(p)}
            onClick={() => handleEnter(p)}
          >
            <img src={p.src} alt={p.alt} loading="lazy" style={p.pos ? { objectPosition: p.pos } : undefined} />
          </div>
        ))}
      </div>

      {lightbox && (
        <div
          className={styles.lightbox}
          onMouseLeave={handleLeave}
          onClick={(e) => { if (e.target === e.currentTarget) handleLeave() }}
        >
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            className={styles.lightboxImg}
            style={lightbox.pos ? { objectPosition: lightbox.pos } : undefined}
          />
          <div className={styles.lightboxMeta}>
            <p className={styles.lightboxDesc}>{lightbox.desc}</p>
            <p className={styles.lightboxSong}>♪ {lightbox.name}</p>
          </div>
          <button className={styles.lightboxClose} onClick={handleLeave} aria-label="Close">✕</button>
        </div>
      )}
    </div>
  )
}
