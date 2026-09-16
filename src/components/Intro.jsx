import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getMusicTime, initAmbient, startMusic } from '../lib/ambient'
import styles from './Intro.module.css'

const MAX_MS = 8000 // after entering, never hold the site back longer than this
const HOLD_MS = 450 // pause at 100% before the site opens
const FADE_MS = 700
// The beat drop in the song. Its loudness roughly doubles at 4.8s; the song starts on the click, so the site
// opens 4.8s after it
const DROP_S = 4.8
const TRAVEL_MS = 1600 // how long the last planets take to fall in, so they arrive on the drop
const TICKS = 24

// What is loading, in order; the bar can't pass a step's share until that step has actually finished
const STEPS = ['loading the page', 'loading fonts', 'drawing the sky over Waterloo']

const PLANET_COLOURS = ['232,201,121', '214,164,120', '170,190,240', '236,232,223', '200,146,112']

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const easeInOut = (t) => {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/* Entry and loading screen. A small gold planet waits under the stars for a click (the site loads behind it
   meanwhile). The click starts the song, which fades in, and the loading bar appears; shooting stars cross the
   screen and little planets fall in towards the planet. The site opens on the song's beat drop, with the last
   planets landing on it. Then the titles fade in (index.css). */
export default function Intro() {
  const [done, setDone] = useState(false)
  const [verb] = useState(() => (window.matchMedia('(pointer: coarse)').matches ? 'tap' : 'click'))
  const overlayRef = useRef(null)
  const canvasRef = useRef(null)
  const planetRef = useRef(null)
  const fillRef = useRef(null)
  const headRef = useRef(null)
  const percentRef = useRef(null)
  const statusRef = useRef(null)
  const enterRef = useRef(() => {})

  // Waiting for the click: the page can't scroll, the titles stay hidden, and stray clicks don't start the song
  useLayoutEffect(() => {
    const root = document.documentElement
    if (done) delete root.dataset.intro
    else if (!root.dataset.intro) root.dataset.intro = 'start'
  }, [done])

  // Start downloading the song now, so it is ready when the visitor clicks in
  useLayoutEffect(() => { initAmbient() }, [])

  useEffect(() => {
    const root = document.documentElement
    const overlay = overlayRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const mountedAt = performance.now()
    const finished = new Array(STEPS.length).fill(false)
    const timers = []
    let raf = 0
    let shown = 0
    let complete = false
    let entered = false
    let enterAt = 0
    let leaving = false
    let leftAt = 0
    let revealAt = Infinity

    const when = (i, promise) => { promise.then(() => { finished[i] = true }) }
    when(0, document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true })))
    when(1, document.fonts?.ready ?? Promise.resolve())
    when(2, root.dataset.skyReady === 'true' ? Promise.resolve() : new Promise((r) => window.addEventListener('sky-ready', r, { once: true })))

    // Canvas: sized to the screen, with the planet's centre as the point everything falls towards
    let W = 0
    let H = 0
    let dpr = 1
    let cx = 0
    let cy = 0
    const size = () => {
      // The screen can be resized after the site has opened, when the planet is gone
      if (!planetRef.current) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      const r = planetRef.current.getBoundingClientRect()
      cx = r.left + r.width / 2
      cy = r.top + r.height / 2
    }
    size()
    window.addEventListener('resize', size)

    const rand = (a, b) => a + Math.random() * (b - a)
    const stars = Array.from({ length: 140 }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() < 0.85 ? 0.6 : 1.1, a: rand(0.15, 0.65), phase: rand(0, 6.28), speed: rand(0.6, 1.8),
    }))
    const streaks = []
    const bodies = []
    const pulses = []
    let nextStreak = mountedAt + 900
    let nextBody = Infinity
    let finalLaunched = false

    const launchBody = (now, travel) => {
      bodies.push({
        born: now,
        travel,
        a0: rand(0, Math.PI * 2),
        turn: rand(0.8, 1.7) * (Math.random() < 0.5 ? -1 : 1),
        r0: Math.hypot(W, H) * rand(0.5, 0.62),
        size: rand(1.4, 3.2),
        colour: PLANET_COLOURS[Math.floor(Math.random() * PLANET_COLOURS.length)],
      })
    }
    // A falling planet's position part way along its path: it curves in, speeding up as it nears the centre
    const along = (b, u) => {
      const k = clamp01(u)
      const r = 24 + (b.r0 - 24) * (1 - k * k * (1.6 - 0.6 * k))
      const a = b.a0 + b.turn * easeInOut(k)
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.82]
    }

    // The click in: start the song and the loading screen together
    enterRef.current = () => {
      if (entered) return
      entered = true
      enterAt = performance.now()
      startMusic()
      root.dataset.intro = 'waiting'
      overlay.dataset.entered = 'true'
      revealAt = enterAt + DROP_S * 1000
      nextBody = enterAt + 250
      nextStreak = Math.min(nextStreak, enterAt + 300)
      pulses.push({ born: enterAt, from: 16, to: 120, life: 900, alpha: 0.45 })
    }

    const draw = (now) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const t = (now - mountedAt) / 1000

      // Faint twinkling stars
      ctx.fillStyle = '#e9ecf5'
      for (const s of stars) {
        ctx.globalAlpha = s.a * (0.65 + 0.35 * Math.sin(t * s.speed + s.phase))
        ctx.fillRect(s.x * W, s.y * H, s.r, s.r)
      }
      ctx.globalAlpha = 1

      // Shooting stars: now and then while waiting, more often once loading
      if (!leaving && now >= nextStreak) {
        nextStreak = now + (entered ? rand(650, 1400) : rand(1600, 3000))
        const fromTop = Math.random() < 0.6
        const angle = rand(0.35, 0.75) * (Math.random() < 0.5 ? 1 : -1) + Math.PI / 2
        streaks.push({
          born: now,
          x: fromTop ? rand(0.1, 0.9) * W : (Math.cos(angle) > 0 ? rand(-0.05, 0.2) : rand(0.8, 1.05)) * W,
          y: fromTop ? rand(-0.05, 0.25) * H : rand(0.05, 0.45) * H,
          dx: Math.cos(angle),
          dy: Math.sin(angle),
          speed: rand(850, 1300),
          length: rand(90, 170),
          life: rand(650, 900),
        })
      }
      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i]
        const p = (now - s.born) / s.life
        if (p >= 1) { streaks.splice(i, 1); continue }
        const travelled = (s.speed * (now - s.born)) / 1000
        const hx = s.x + s.dx * travelled
        const hy = s.y + s.dy * travelled
        const tail = s.length * Math.min(1, p * 4)
        const fade = Math.sin(Math.PI * p)
        const g = ctx.createLinearGradient(hx - s.dx * tail, hy - s.dy * tail, hx, hy)
        g.addColorStop(0, 'rgba(210,225,255,0)')
        g.addColorStop(1, `rgba(250,248,240,${(0.85 * fade).toFixed(3)})`)
        ctx.strokeStyle = g
        ctx.lineWidth = 1.2
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(hx - s.dx * tail, hy - s.dy * tail)
        ctx.lineTo(hx, hy)
        ctx.stroke()
      }

      // Little planets falling in after the click; the last group is timed to land on the drop
      if (entered && !leaving) {
        if (!finalLaunched && now >= revealAt - TRAVEL_MS) {
          finalLaunched = true
          for (let i = 0; i < 4; i++) launchBody(revealAt - TRAVEL_MS, TRAVEL_MS)
        } else if (!finalLaunched && now >= nextBody && revealAt - now > TRAVEL_MS + 300) {
          nextBody = now + rand(380, 620)
          launchBody(now, rand(1300, 1900))
        }
      }
      for (let i = bodies.length - 1; i >= 0; i--) {
        const b = bodies[i]
        const u = (now - b.born) / b.travel
        if (u >= 1) {
          bodies.splice(i, 1)
          pulses.push({ born: now, from: 12, to: 44, life: 600, alpha: 0.35 })
          continue
        }
        ctx.lineCap = 'round'
        for (let k = 1; k <= 12; k++) {
          const [x0, y0] = along(b, u - (k - 1) * 0.018)
          const [x1, y1] = along(b, u - k * 0.018)
          ctx.strokeStyle = `rgba(${b.colour},${(0.28 * (1 - k / 12) * Math.min(1, u * 5)).toFixed(3)})`
          ctx.lineWidth = b.size * (1 - k / 14)
          ctx.beginPath()
          ctx.moveTo(x0, y0)
          ctx.lineTo(x1, y1)
          ctx.stroke()
        }
        const [x, y] = along(b, u)
        ctx.globalAlpha = Math.min(1, u * 5)
        ctx.fillStyle = `rgb(${b.colour})`
        ctx.beginPath()
        ctx.arc(x, y, b.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      // Rings: on the click, where planets land, and the wide ring on the drop
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]
        const k = (now - p.born) / p.life
        if (k >= 1) { pulses.splice(i, 1); continue }
        const e = 1 - Math.pow(1 - k, 3)
        ctx.strokeStyle = `rgba(232,201,121,${(p.alpha * (1 - k)).toFixed(3)})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(cx, cy, p.from + (p.to - p.from) * e, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    const frame = (now) => {
      if (entered && !leaving) {
        const elapsed = now - enterAt
        let allowed = 0
        while (allowed < STEPS.length && finished[allowed]) allowed++
        const realDone = elapsed > MAX_MS || allowed >= STEPS.length

        // Follow the song's own clock, so the site opens exactly on the drop
        const songTime = getMusicTime()
        if (songTime !== null && songTime < DROP_S) {
          revealAt = Math.min(now + (DROP_S - songTime) * 1000, enterAt + MAX_MS)
        }
        // Loading that hasn't finished holds the opening back
        if (!realDone) revealAt = Math.max(revealAt, now + HOLD_MS + 250)

        const realLimit = realDone ? 1 : Math.min(1, (allowed + 0.85) / STEPS.length)
        const fillEnd = revealAt - HOLD_MS
        const timeLimit = 1 - Math.pow(1 - clamp01(elapsed / (fillEnd - enterAt)), 1.7)
        const target = Math.min(realLimit, timeLimit)
        shown += (target - shown) * 0.14
        if (target >= 1 && shown > 0.995) shown = 1

        fillRef.current.style.transform = `scaleX(${shown.toFixed(4)})`
        headRef.current.style.left = `${(shown * 100).toFixed(2)}%`
        const percent = Math.round(shown * 100)
        percentRef.current.textContent = String(percent).padStart(2, '0')
        const step = Math.min(STEPS.length - 1, Math.floor(shown * STEPS.length))
        const label = percent >= 100 ? 'ready' : STEPS[step]
        if (statusRef.current.textContent !== label) statusRef.current.textContent = label
        if (percent >= 100 && !complete) {
          complete = true
          overlay.dataset.complete = 'true'
        }

        // The drop: the site opens
        if (realDone && now >= revealAt) {
          leaving = true
          leftAt = now
          fillRef.current.style.transform = 'scaleX(1)'
          headRef.current.style.left = '100%'
          percentRef.current.textContent = '100'
          statusRef.current.textContent = 'ready'
          overlay.dataset.complete = 'true'
          overlay.dataset.drop = 'true'
          pulses.push({ born: now, from: 14, to: Math.hypot(W, H) * 0.35, life: 900, alpha: 0.55 })
          root.dataset.intro = 'revealing'
          overlay.dataset.leaving = 'true'
          window.removeEventListener('keydown', onKey)
          timers.push(setTimeout(() => setDone(true), FADE_MS + 100))
        }
      }

      draw(now)
      if (!leaving || now - leftAt < FADE_MS + 100) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // Enter or Space also goes in. Once the site is open these keys belong to the page again, so the
    // listener steps aside instead of swallowing them.
    const onKey = (e) => {
      if (entered || (e.key !== 'Enter' && e.key !== ' ')) return
      e.preventDefault()
      enterRef.current()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
      window.removeEventListener('resize', size)
      window.removeEventListener('keydown', onKey)
      delete root.dataset.intro
    }
  }, [])

  if (done) return null

  return createPortal(
    <div
      ref={overlayRef}
      className={styles.loader}
      data-entered="false"
      role="status"
      aria-live="polite"
      aria-label="Loading"
      onClick={() => enterRef.current()}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      <button ref={planetRef} type="button" className={styles.planet} aria-label="Enter the site">
        <span className={styles.orbit}>
          <span className={styles.moon} />
        </span>
        <span className={styles.body} />
      </button>

      <div className={styles.below}>
        <p className={styles.prompt} aria-hidden="true">{verb} the planet to enter</p>

        <div className={styles.meter} aria-hidden="true">
          <div className={styles.readout}>
            <span ref={statusRef} className={styles.status}>{STEPS[0]}</span>
            <span className={styles.percent}><span ref={percentRef}>00</span>%</span>
          </div>
          <div className={styles.track}>
            <span ref={fillRef} className={styles.fill}>
              <span className={styles.shimmer} />
            </span>
            <span ref={headRef} className={styles.head} />
          </div>
          <div className={styles.ticks}>
            {Array.from({ length: TICKS + 1 }, (_, i) => (
              <span key={i} data-major={i % 6 === 0} />
            ))}
          </div>
          <p className={styles.coords}>43.47° N · 80.54° W</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
