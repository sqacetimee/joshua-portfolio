import { useRef, useCallback, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import styles from './Photos.module.css'
import { EASE, Page, Reveal } from '../components/Motion'
import Tilt from '../components/Tilt'
import { duckMusic } from '../lib/ambient'
import Letters from '../components/Letters'

const PHOTOS = [
  { src: '/photos/1.jpeg',  size: [1179, 1919], alt: 'Campus at night',       song: '/songs/1.mp3',  name: 'Path (Dream) · Salvia',                  desc: 'the moon found a gap in the clouds, and everything else went quiet' },
  { src: '/photos/2.jpeg',  size: [1179, 2043], alt: 'Sunset on campus',      song: '/songs/2.mp3',  name: 'Flying (Till Death) · CloseMiMind',      desc: 'golden hour off the roof, the whole city turned amber' },
  { src: '/photos/3.jpeg',  size: [1166, 2064], alt: 'Canada geese',          song: '/songs/3.mp3',  name: 'Waiting · Leverfall',                    desc: 'they never seem in a hurry, which is something to admire' },
  { src: '/photos/4.jpeg',  size: [1179, 2053], alt: 'Roller coaster sunset', song: '/songs/4.mp3',  name: 'Palace · ADTurnUP',           pos: '30% center', start: 30, desc: 'that pause at the top right before everything drops away' },
  { src: '/photos/5.jpeg',  size: [1179, 2030], alt: 'Toronto at night',      song: '/songs/5.mp3',  name: "U Weren't Here · Cult Member", start: 55, desc: 'somewhere in all those lights, someone is having the best night of their life' },
  { src: '/photos/6.jpeg',  size: [1179, 2062], alt: 'Snowy path at night',   song: '/songs/6.mp3',  name: 'Memories Flawed · Killswitch', start: 17, desc: 'lamp-lit snow and pine trees, the whole world muffled and still' },
  { src: '/photos/7.jpeg',  size: [1179, 2034], alt: 'Snowy campus night',    song: '/songs/7.mp3',  name: 'A Winter · Juelz',                       desc: 'colored light spilling onto fresh snow, no one else around' },
  { src: '/photos/8.jpeg',  size: [1179, 2049], alt: 'Pink winter sunrise',   song: '/songs/8.mp3',  name: 'Desert Sand Feels Warm at Night',         desc: 'the sky caught fire for ten minutes before the day began' },
  { src: '/photos/9.jpeg',  size: [1179, 2088], alt: 'Winter sunrise',        song: '/songs/9.mp3',  name: 'Amanda Putri Hasana · Gambar Indah',      desc: 'cold enough your breath disappears, warm enough to stay one more minute' },
  { src: '/photos/10.jpeg', size: [1179, 2067], alt: 'Snowy campus path',     song: '/songs/10.mp3', name: 'What Would I Do · Strawberry Guy', start: 7, desc: "the path leads somewhere, and for once you're not in a rush to get there" },
]

// Scattered layout on wide screens, as fractions of the gallery's width: [left, top, width, tilt in degrees]
const LAYOUT = [
  [0.00, 0.00, 0.27, -1.2], [0.36, 0.12, 0.22, 1.4], [0.70, 0.03, 0.26, -0.6],
  [0.05, 0.66, 0.22, 0.8], [0.37, 0.66, 0.28, -1.0], [0.73, 0.63, 0.24, 1.6],
  [0.00, 1.20, 0.25, -1.5], [0.33, 1.30, 0.23, 0.6], [0.66, 1.19, 0.27, -0.8],
  [0.40, 1.86, 0.26, 1.1],
]
const SCATTER_HEIGHT = 2.44
// Faint constellation lines joining the photos
const LINKS = [[0, 1], [1, 2], [1, 4], [3, 4], [4, 5], [4, 7], [6, 7], [7, 8], [7, 9]]
const centre = ([x, y, w]) => [(x + w / 2) * 100, (y + (w * 16) / 9 / 2) * 100]

const small = (p) => p.src.replace('/photos/', '/photos/small/').replace('.jpeg', '.webp')
const pad = (n) => String(n).padStart(2, '0')
const VOLUME = 0.45
const HOVER_INTENT_MS = 170 // brief pause so sweeping across the gallery doesn't grab every photo
const VIEW_ASPECT = 0.575 // typical width / height of these photos, for the open and close zoom

// The full view zooms out of the tile it was opened from, and back into it when closed
const stageVariants = {
  hidden: (rect) => {
    if (!rect) return { opacity: 0, scale: 0.96, x: 0, y: 0, transition: { duration: 0.3, ease: EASE } }
    const vw = window.innerWidth
    const vh = window.innerHeight
    const boxH = Math.min(vh * 0.8, (vw * 0.9) / VIEW_ASPECT)
    return {
      x: rect.left + rect.width / 2 - vw / 2,
      y: rect.top + rect.height / 2 - vh / 2 + 28,
      scale: rect.width / (boxH * VIEW_ASPECT),
      opacity: 0,
      transition: { duration: 0.5, ease: EASE },
    }
  },
  shown: { x: 0, y: 0, scale: 1, opacity: 1, transition: { duration: 0.6, ease: EASE } },
}

function Bars({ playing }) {
  return (
    <span className={`${styles.bars} ${playing ? styles.barsOn : ''}`} aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  )
}

export default function Photos() {
  // Two players so one song can fade out while the next fades in
  const audioA = useRef(null)
  const audioB = useRef(null)
  const liveIdx = useRef(0)
  const fadeTimers = useRef(new Map())
  const hoverTimer = useRef(null)
  const canFade = useRef(true)
  const slotRefs = useRef([])
  const viewRef = useRef(null)
  const closeRef = useRef(null)
  const swipeX = useRef(null)
  const [activeSong, setActiveSong] = useState(null)
  const [view, setView] = useState(null) // { index, rect }
  const [exitRect, setExitRect] = useState(null)
  const [loaded, setLoaded] = useState({})

  // iOS ignores audio.volume; there we switch songs directly instead of fading
  useEffect(() => {
    const a = audioA.current
    try {
      a.volume = 0.5
      canFade.current = a.volume === 0.5
      a.volume = 1
    } catch {
      canFade.current = false
    }
  }, [])

  // The site's background music steps aside while a photo's song is playing
  const hasSong = activeSong !== null
  useEffect(() => {
    if (!hasSong) return
    duckMusic(true)
    return () => duckMusic(false)
  }, [hasSong])

  const fadeAudio = useCallback((audio, to, ms, onDone) => {
    const timers = fadeTimers.current
    clearInterval(timers.get(audio))
    timers.delete(audio)
    if (!canFade.current) { onDone?.(); return }
    const from = audio.volume
    const start = performance.now()
    const id = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / ms)
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * eased))
      if (p >= 1) {
        clearInterval(id)
        timers.delete(audio)
        onDone?.()
      }
    }, 30)
    timers.set(audio, id)
  }, [])

  const playSong = useCallback((photo) => {
    const a = audioA.current
    const b = audioB.current
    if (!a || !b) return
    setActiveSong(photo.song)
    const current = liveIdx.current === 0 ? a : b
    const other = current === a ? b : a

    if (current.dataset.song === photo.song) {
      if (current.paused) current.play().catch(() => {})
      fadeAudio(current, VOLUME, 800)
      if (!other.paused) fadeAudio(other, 0, 1000, () => other.pause())
      return
    }

    // Crossfade: the old song fades out while the new one fades in on the other player
    if (!current.paused) {
      if (canFade.current) fadeAudio(current, 0, 1200, () => current.pause())
      else current.pause()
    }
    clearInterval(fadeTimers.current.get(other))
    other.pause()
    other.dataset.song = photo.song
    other.src = photo.song
    other.currentTime = photo.start ?? 0
    if (canFade.current) other.volume = 0
    liveIdx.current = current === a ? 1 : 0
    other.play().then(() => fadeAudio(other, VOLUME, 1500)).catch(() => {})
  }, [fadeAudio])

  const stopSongs = useCallback(() => {
    clearTimeout(hoverTimer.current)
    setActiveSong(null)
    for (const audio of [audioA.current, audioB.current]) {
      if (audio && !audio.paused) fadeAudio(audio, 0, 1400, () => audio.pause())
    }
  }, [fadeAudio])

  const handleEnter = useCallback((photo) => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => playSong(photo), HOVER_INTENT_MS)
  }, [playSong])

  const handlePhotoLeave = useCallback(() => clearTimeout(hoverTimer.current), [])

  // Leaving the gallery stops the music, unless a photo is open on top of it
  const handleGalleryLeave = useCallback(() => {
    if (!viewRef.current) stopSongs()
  }, [stopSongs])

  const openAt = useCallback((index) => {
    clearTimeout(hoverTimer.current)
    const el = slotRefs.current[index]
    const next = { index, rect: el ? el.getBoundingClientRect() : null }
    viewRef.current = next
    setView(next)
    // Called straight from the click so mobile browsers allow the audio to start
    playSong(PHOTOS[index])
  }, [playSong])

  const step = useCallback((dir) => {
    const current = viewRef.current
    if (!current) return
    const index = (current.index + dir + PHOTOS.length) % PHOTOS.length
    const next = { index, rect: null }
    viewRef.current = next
    setView(next)
    playSong(PHOTOS[index])
  }, [playSong])

  const close = useCallback(() => {
    const current = viewRef.current
    if (!current) return
    const el = slotRefs.current[current.index]
    setExitRect(el ? el.getBoundingClientRect() : null)
    viewRef.current = null
    setView(null)
    stopSongs()
  }, [stopSongs])

  // Keyboard, focus and scroll lock while a photo is open
  const isOpen = view !== null
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      root.style.overflow = previous
    }
  }, [isOpen, close, step])

  // Stop the music when leaving the page
  useEffect(() => {
    const timers = fadeTimers.current
    const players = [audioA.current, audioB.current]
    return () => {
      clearTimeout(hoverTimer.current)
      timers.forEach((id) => clearInterval(id))
      players.forEach((p) => p?.pause())
    }
  }, [])

  const activePhoto = PHOTOS.find((p) => p.song === activeSong)
  const viewed = view ? PHOTOS[view.index] : null

  return (
    <Page className={styles.page}>
      <audio ref={audioA} loop preload="none" />
      <audio ref={audioB} loop preload="none" />

      <div className={styles.wrap}>
        <header className={styles.header}>
          <Reveal as="p" className={styles.eyebrow}>field photographs · {PHOTOS.length} plates, each with a song</Reveal>
          <Reveal as="h1" className={styles.title} delay={0.08} aria-label="photos i've taken"><Letters text="photos i've taken" /></Reveal>
          <Reveal as="p" className={styles.hint} delay={0.16}>
            <span className={styles.hintDesktop}>hover to hear · click to view</span>
            <span className={styles.hintTouch}>tap a photo to view and hear it</span>
          </Reveal>
        </header>

        <div className={styles.scatterWrap}>
          <div className={styles.scatter} onMouseLeave={handleGalleryLeave}>
            <svg className={styles.lines} viewBox={`0 0 100 ${SCATTER_HEIGHT * 100}`} preserveAspectRatio="none" aria-hidden="true">
              {LINKS.map(([a, b], i) => {
                const [x1, y1] = centre(LAYOUT[a])
                const [x2, y2] = centre(LAYOUT[b])
                return (
                  <motion.line
                    key={`${a}-${b}`}
                    className={styles.line}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: 1 }}
                    viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                    transition={{ duration: 1.8, ease: EASE, delay: 0.2 + i * 0.12 }}
                  />
                )
              })}
            </svg>

            {PHOTOS.map((p, i) => {
              const active = activeSong === p.song
              const dimmed = activeSong !== null && !active && !view
              const [x, y, w, rot] = LAYOUT[i]
              return (
                <Reveal
                  as="figure"
                  key={p.src}
                  className={`${styles.figure} ${active ? styles.isActive : ''} ${dimmed ? styles.isDimmed : ''}`}
                  style={{ '--x': x, '--y': y, '--w': w, '--rot': `${rot}deg` }}
                  delay={(i % 3) * 0.08}
                >
                  <Tilt className={styles.frame} max={9} lift={1.03}>
                    <div
                      ref={(el) => { slotRefs.current[i] = el }}
                      className={styles.slot}
                      data-cursor="view"
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${p.alt}`}
                      onPointerEnter={(e) => e.pointerType === 'mouse' && handleEnter(p)}
                      onPointerLeave={(e) => e.pointerType === 'mouse' && handlePhotoLeave()}
                      onClick={() => openAt(i)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAt(i) } }}
                    >
                      <img
                        src={small(p)}
                        decoding="async"
                        alt={p.alt}
                        loading="lazy"
                        draggable="false"
                        style={p.pos ? { objectPosition: p.pos } : undefined}
                      />
                      <span className={styles.songLabel}>
                        <Bars playing={active} />
                        <span className={styles.songName}>{p.name}</span>
                      </span>
                    </div>
                  </Tilt>
                  <figcaption className={styles.caption}>
                    <span className={styles.plateNum}>plate {pad(i + 1)}</span>
                    <span className={styles.desc}>{p.desc}</span>
                  </figcaption>
                </Reveal>
              )
            })}
          </div>
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {activePhoto && !view && (
            <motion.div
              className={styles.nowPlaying}
              initial={{ opacity: 0, y: 16, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 16, x: '-50%' }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <Bars playing />
              <span className={styles.npLabel}>now playing</span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={activePhoto.song}
                  className={styles.npSong}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {activePhoto.name}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {createPortal(
        <AnimatePresence custom={exitRect}>
          {view && (
            <motion.div
              key="lb-backdrop"
              className={styles.lbBackdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
              onClick={close}
            />
          )}
          {view && (
            <motion.figure
              key="lb-stage"
              className={styles.lbStage}
              role="dialog"
              aria-modal="true"
              aria-label={viewed.alt}
              custom={view.rect}
              variants={stageVariants}
              initial="hidden"
              animate="shown"
              exit="hidden"
              onPointerDown={(e) => { swipeX.current = e.clientX }}
              onPointerUp={(e) => {
                if (swipeX.current === null) return
                const dx = e.clientX - swipeX.current
                swipeX.current = null
                if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1)
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={view.index}
                  className={styles.lbImage}
                  style={{ '--ar': viewed.size[0] / viewed.size[1] }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <img src={small(viewed)} alt="" aria-hidden="true" draggable="false" />
                  <img
                    className={styles.lbFull}
                    data-loaded={!!loaded[view.index]}
                    src={viewed.src}
                    alt={viewed.alt}
                    draggable="false"
                    onLoad={() => setLoaded((l) => ({ ...l, [view.index]: true }))}
                  />
                </motion.div>
              </AnimatePresence>
              <figcaption className={styles.lbCaption}>
                <span className={styles.lbMeta}>
                  <span>plate {pad(view.index + 1)} / {pad(PHOTOS.length)}</span>
                  <span className={styles.lbSong}><Bars playing={activeSong === viewed.song} /> {viewed.name}</span>
                </span>
                <span className={styles.lbDesc}>{viewed.desc}</span>
              </figcaption>
            </motion.figure>
          )}
          {view && (
            <motion.div
              key="lb-controls"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <button ref={closeRef} type="button" className={styles.lbClose} onClick={close} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
              </button>
              <button type="button" className={`${styles.lbNav} ${styles.lbPrev}`} onClick={() => step(-1)} aria-label="Previous photo">←</button>
              <button type="button" className={`${styles.lbNav} ${styles.lbNext}`} onClick={() => step(1)} aria-label="Next photo">→</button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </Page>
  )
}
