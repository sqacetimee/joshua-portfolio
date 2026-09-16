import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'

/* Text split into letters so they can animate one at a time (see index.css). Words stay unbroken, and the
   parent element should carry the full text as its aria-label.

   With `constellation`, the title arrives the way a constellation resolves: a faint line traces the shape
   the name will take, then each letter drifts in from its own speck of light out in the sky and settles
   just off the line, never landing on a perfect baseline. Used for the name on the home page. */

// How long the whole arrival takes, matching the animations in index.css
const TOTAL_MS = 2700

// Repeatable pseudo-random numbers, so the scatter is designed rather than different on every visit
function rand(seed) {
  let t = (seed * 1831565813 + 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Where the letters come to rest. A slow rise and fall carries across the whole name, each letter is
// nudged off that curve on its own, and every letter leans with the slope and sits at its own size, the way
// the stars in a constellation are all slightly different.
const WAVE = 0.09 // em, height of the rise and fall
const STEP = 1.25 // how quickly the curve turns from letter to letter
const JITTER = 0.045 // em, the nudge on top of the curve
const TILT = 3.8 // deg, the lean along the slope
const KERN = 0.022 // em, the extra air after a letter, so the spacing is never even
const BOB = [0.032, 0.058] // em, how far a letter drifts up and down once it has settled
const BOB_TURN = [0.35, 0.9] // deg, the slight roll that goes with the drift
const BOB_SECS = [4.2, 7] // how long one drift takes; every letter runs at its own speed

function plan(text) {
  const letters = []
  const words = text.split(' ').map((word) => [...word].map((ch) => {
    const i = letters.length
    const seed = text.length * 7 + i * 977
    const r = (c) => rand(seed + c * 31)
    const wave = Math.sin(i * STEP + 0.9)
    const item = {
      ch,
      i,
      dx: (r(1) * 2 - 1) * 2.4, // where the letter waits out in the sky, in em
      dy: (r(2) * 2 - 1) * 1.9,
      sr: (r(3) * 2 - 1) * 26, // how far it is tipped over out there
      ry: wave * WAVE + (r(4) * 2 - 1) * JITTER, // where it finally rests
      rr: Math.cos(i * STEP + 0.9) * TILT + (r(5) * 2 - 1) * 1.1,
      rs: 0.95 + r(7) * 0.11, // its size, like a star's brightness
      rk: r(8) * KERN, // the air after it
      ba: BOB[0] + r(9) * (BOB[1] - BOB[0]), // the slow drift it keeps up afterwards
      bw: (BOB_TURN[0] + r(12) * (BOB_TURN[1] - BOB_TURN[0])) * (r(13) < 0.5 ? -1 : 1),
      bs: BOB_SECS[0] + r(10) * (BOB_SECS[1] - BOB_SECS[0]),
      bd: -r(11) * BOB_SECS[1], // started part way through, so they never drift together
      order: i + r(6) * 3.2, // arrival: left to right overall, shuffled between neighbours
    }
    letters.push(item)
    return item
  }))
  letters.slice().sort((a, b) => a.order - b.order).forEach((l, n) => { l.ord = n })
  return { words, count: letters.length }
}

export default function Letters({ text, constellation = false }) {
  const { words, count } = plan(text)
  const ref = useRef(null)
  const [chart, setChart] = useState(null)
  const [phase, setPhase] = useState(() => (
    constellation && document.documentElement.dataset.intro ? 'hidden' : 'done'
  ))

  // Where the letters will come to rest, for the line that joins them. offsetLeft ignores the transforms
  // the letters are animating with, so this reads their resting places whenever it runs.
  useLayoutEffect(() => {
    if (!constellation) return undefined
    const measure = () => {
      // Fonts can finish loading after this title has gone
      const el = ref.current
      if (!el) return
      const box = el.getBoundingClientRect()
      const pts = [...el.querySelectorAll('[data-letter]')]
        .map((s) => [s.offsetLeft + s.offsetWidth / 2, s.offsetTop + s.offsetHeight * 0.56])
      if (pts.length < 2 || !box.width) return
      let len = 0
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
      const next = { w: box.width, h: box.height, pts, len }
      setChart((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }
    measure()
    document.fonts?.ready.then(measure)
    const ro = new ResizeObserver(measure)
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [constellation, text])

  // The title waits for the entry screen to hand over
  useEffect(() => {
    if (phase !== 'hidden') return undefined
    const root = document.documentElement
    const go = () => {
      if (!root.dataset.intro || root.dataset.intro === 'revealing') setPhase('in')
    }
    const mo = new MutationObserver(go)
    mo.observe(root, { attributes: true, attributeFilter: ['data-intro'] })
    go()
    return () => mo.disconnect()
  }, [phase])

  // The star's light bends around the letters where they rest, so it waits until they stop moving
  useEffect(() => {
    if (phase !== 'in') return undefined
    const root = document.documentElement
    root.dataset.settling = 'true'
    const id = setTimeout(() => {
      delete root.dataset.settling
      setPhase('done')
    }, TOTAL_MS)
    return () => {
      clearTimeout(id)
      delete root.dataset.settling
    }
  }, [phase])

  return (
    <span
      ref={ref}
      className={constellation ? 'letters constellation' : 'letters'}
      data-phase={constellation ? phase : undefined}
      aria-hidden="true"
    >
      {constellation && chart && (
        <svg className="chart" width={chart.w} height={chart.h} aria-hidden="true">
          <polyline className="link" points={chart.pts.map((p) => p.join(',')).join(' ')} style={{ '--len': chart.len }} />
          {chart.pts.map((p, i) => (
            <circle key={i} className="node" cx={p[0]} cy={p[1]} r="1.6" style={{ '--ord': i }} />
          ))}
        </svg>
      )}
      {words.map((chars, w) => (
        <Fragment key={w}>
          {w > 0 && ' '}
          <span className="word">
            {chars.map((l) => (
              <span
                key={l.i}
                className="letter"
                data-letter=""
                style={constellation ? {
                  '--i': l.i,
                  '--ord': l.ord,
                  '--dx': `${l.dx.toFixed(2)}em`,
                  '--dy': `${l.dy.toFixed(2)}em`,
                  '--sr': `${l.sr.toFixed(1)}deg`,
                  '--ry': `${l.ry.toFixed(3)}em`,
                  '--rr': `${l.rr.toFixed(2)}deg`,
                  '--rs': l.rs.toFixed(3),
                  '--rk': `${l.rk.toFixed(4)}em`,
                  '--ba': `${l.ba.toFixed(4)}em`,
                  '--bw': `${l.bw.toFixed(2)}deg`,
                  '--bs': `${l.bs.toFixed(2)}s`,
                  '--bd': `${l.bd.toFixed(2)}s`,
                  '--last': count - 1,
                } : { '--i': l.i }}
              >
                {constellation ? <span className="glyph">{l.ch}</span> : l.ch}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </span>
  )
}
