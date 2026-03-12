import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

// ─────────────────────────────────────────────────────────────────────────────
// Scenario
//   Josh:    A♠ T♠
//   Villain: K♣ K♦
//   Board:   K♠ K♥ Q♠ 2♠ J♠
//   Josh makes Royal Flush  (A♠ K♠ Q♠ J♠ T♠)  ← rivers the J♠
//   Villain makes Quad Kings (K♣ K♦ K♠ K♥)
// ─────────────────────────────────────────────────────────────────────────────

const JOSH    = [{ r:'A', s:'s' }, { r:'T', s:'s' }]
const VILLAIN = [{ r:'K', s:'c' }, { r:'K', s:'d' }]
const BOARD   = [
  { r:'K', s:'s' }, // 0 — Josh HL + Villain HL
  { r:'K', s:'h' }, // 1 — Villain HL only
  { r:'Q', s:'s' }, // 2 — Josh HL
  { r:'2', s:'s' }, // 3 — neither
  { r:'J', s:'s' }, // 4 — Josh HL (river royal)
]

const JOSH_BOARD_HL = [true, false, true, false, true]

const EQUITIES = {
  preflop:  { josh: 33, villain: 67 },
  flop:     { josh:  4, villain: 96 },
  turn:     { josh:  2, villain: 98 },
  river:    { josh:100, villain:  0 },
  showdown: { josh:100, villain:  0 },
}

const STAGE_META = {
  preflop:  { label: 'Pre-flop' },
  flop:     { label: 'Flop'     },
  turn:     { label: 'Turn'     },
  river:    { label: 'River'    },
  showdown: { label: 'Showdown' },
}

const BOARD_VISIBLE = {
  preflop:  [false, false, false, false, false],
  flop:     [true,  true,  true,  false, false],
  turn:     [true,  true,  true,  true,  false],
  river:    [true,  true,  true,  true,  true ],
  showdown: [true,  true,  true,  true,  true ],
}

const SUIT_SYM   = { s:'♠', h:'♥', d:'♦', c:'♣' }
const SUIT_COLOR = { s:'var(--ink)', h:'#bf2318', d:'#bf2318', c:'var(--ink)' }

function rand(a, b) { return a + Math.random() * (b - a) }

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
.ps-deck-wrap {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;
}
.ps-deck { position: relative; width: 52px; height: 72px; }
.ps-deck-card {
  position: absolute; width: 52px; height: 72px;
  border-radius: 5px; background: var(--bg);
  border: 1px solid var(--faint); box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  background-image: repeating-linear-gradient(45deg, var(--faint) 0px, var(--faint) 1px, transparent 1px, transparent 6px);
  transition: transform 0.2s var(--ease);
}
.ps-deck-wrap:hover .ps-deck-card { transform: translateY(-3px) rotate(-1deg); }
.ps-deck-label {
  font-family: var(--font-mono); font-size: 0.58rem; font-weight: 300;
  letter-spacing: 0.1em; color: var(--muted); white-space: nowrap;
  animation: ps-pulse 2s ease-in-out infinite;
}
@keyframes ps-pulse { 0%,100%{opacity:.45} 50%{opacity:1} }

.ps-table {
  width: 100%; background: var(--bg2); border: 1px solid var(--faint);
  border-radius: 12px; padding: 1.2rem 1.1rem 1.1rem;
  display: flex; flex-direction: column; align-items: center; gap: 1.1rem;
  animation: ps-rise 0.28s cubic-bezier(0.22,1,0.36,1) forwards;
  position: relative; z-index: 4;
}
@keyframes ps-rise { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

.ps-pill {
  font-family: var(--font-mono); font-size: 0.58rem; font-weight: 400;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);
  border: 1px solid var(--faint); border-radius: 20px; padding: 0.18rem 0.7rem;
}

.ps-hands {
  display: flex; align-items: flex-start; justify-content: center;
  gap: 1.5rem; width: 100%;
}
.ps-hand { display: flex; flex-direction: column; align-items: center; gap: 0.45rem; min-width: 0; }
.ps-hand-label {
  font-family: var(--font-mono); font-size: 0.62rem; font-weight: 300;
  letter-spacing: 0.06em; color: var(--muted);
  display: flex; align-items: center; gap: 0.38rem; white-space: nowrap;
}
.ps-badge { font-family: var(--font-mono); font-size: 0.58rem; border-radius: 3px; padding: 0.08rem 0.32rem; white-space: nowrap; }
.ps-badge-win  { color: #2a7a4a; background: #e8f5ee; }
[data-theme="dark"] .ps-badge-win { color: #5fc98a; background: #1a2e22; }
.ps-badge-lose { color: var(--muted); border: 1px solid var(--faint); }
.ps-cards { display: flex; gap: 0.32rem; }
.ps-vs { font-family: var(--font-mono); font-size: 0.62rem; color: var(--muted); margin-top: 1.7rem; flex-shrink: 0; }

.ps-equity-wrap { width: 100%; display: flex; flex-direction: column; gap: 0.28rem; }
.ps-equity-labels {
  display: flex; justify-content: space-between;
  font-family: var(--font-mono); font-size: 0.58rem; color: var(--muted); letter-spacing: 0.04em;
}
.ps-equity-bar { width: 100%; height: 5px; background: var(--faint); border-radius: 99px; overflow: hidden; }
.ps-equity-fill { height: 100%; border-radius: 99px; background: var(--ink); transition: width 0.55s cubic-bezier(0.22,1,0.36,1); }

.ps-board { display: flex; gap: 0.32rem; align-items: center; }
.ps-slot { width: 44px; height: 62px; border: 1px dashed var(--faint); border-radius: 5px; flex-shrink: 0; }

.ps-card {
  position: relative; width: 44px; height: 62px;
  background: var(--bg); border: 1px solid var(--faint); border-radius: 5px;
  box-shadow: 0 1px 5px rgba(0,0,0,0.09), inset 0 0 0 0.5px rgba(255,255,255,0.5);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  animation: ps-deal 0.22s cubic-bezier(0.22,1,0.36,1) both;
}
.ps-card-lg { width: 52px; height: 72px; }
@keyframes ps-deal { from{opacity:0;transform:scale(0.82) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
.ps-card-hl { border-color: var(--ink); box-shadow: 0 0 0 1.5px var(--ink), 0 3px 10px rgba(0,0,0,0.14); }
.ps-card-back { background: var(--bg2); }
.ps-card-back-pattern {
  width: 100%; height: 100%; border-radius: 4px; opacity: 0.7;
  background-image: repeating-linear-gradient(45deg, var(--faint) 0px, var(--faint) 1px, transparent 1px, transparent 5px);
}
.ps-corner-tl { position: absolute; top: 3px; left: 4px; font-family: var(--font-serif); font-size: 0.54rem; font-weight: 600; line-height: 1.2; text-align: center; }
.ps-card-lg .ps-corner-tl { font-size: 0.62rem; top: 4px; left: 5px; }
.ps-corner-br { position: absolute; bottom: 3px; right: 4px; font-family: var(--font-serif); font-size: 0.54rem; font-weight: 600; line-height: 1.2; text-align: center; transform: rotate(180deg); }
.ps-card-lg .ps-corner-br { font-size: 0.62rem; bottom: 4px; right: 5px; }
.ps-suit-center { font-size: 1.05rem; line-height: 1; }
.ps-card-lg .ps-suit-center { font-size: 1.3rem; }

.ps-banner {
  font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.04em;
  color: var(--ink); background: var(--hover-bg); border: 1px solid var(--faint);
  border-radius: 7px; padding: 0.55rem 1.1rem; text-align: center; line-height: 1.6;
  animation: ps-rise 0.3s cubic-bezier(0.22,1,0.36,1) forwards;
}

.ps-btn {
  font-family: var(--font-mono); font-size: 0.65rem; font-weight: 300;
  letter-spacing: 0.08em; color: var(--muted); background: none;
  border: 1px solid var(--faint); border-radius: 5px; padding: 0.3rem 0.9rem;
  cursor: pointer; transition: color 0.15s, border-color 0.15s, background 0.15s, transform 0.15s;
  user-select: none;
}
.ps-btn:hover { color: var(--ink); border-color: var(--muted); background: var(--hover-bg); transform: translateY(-1px); }
.ps-btn:active { transform: translateY(0); }

.ps-card:nth-child(1){animation-delay:0.00s}
.ps-card:nth-child(2){animation-delay:0.06s}
.ps-card:nth-child(3){animation-delay:0.12s}
.ps-card:nth-child(4){animation-delay:0.18s}
.ps-card:nth-child(5){animation-delay:0.24s}

.ps-progress { width: 100%; height: 2px; background: var(--faint); border-radius: 99px; overflow: hidden; }
.ps-progress-fill { height: 100%; background: var(--muted); border-radius: 99px; transition: width linear; }

@media (max-width: 480px) {
  .ps-card    { width: 36px; height: 52px; }
  .ps-card-lg { width: 44px; height: 60px; }
  .ps-slot    { width: 36px; height: 52px; }
  .ps-suit-center { font-size: 0.88rem; }
  .ps-card-lg .ps-suit-center { font-size: 1.1rem; }
  .ps-hands { gap: 1rem; }
}
`

const CHIP_COLORS = ['#e63946','#2a9d8f','#e9c46a','#264653','#f4a261','#457b9d','#a8dadc']

// ─────────────────────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────────────────────
function CardFace({ r, s, large = false, highlight = false, faceDown = false, delay = 0 }) {
  const col = SUIT_COLOR[s]
  const sym = SUIT_SYM[s]
  const cls = ['ps-card', large ? 'ps-card-lg' : '', highlight ? 'ps-card-hl' : '', faceDown ? 'ps-card-back' : ''].filter(Boolean).join(' ')
  if (faceDown) {
    return <div className={cls} style={{ animationDelay:`${delay}s` }}><div className="ps-card-back-pattern" /></div>
  }
  return (
    <div className={cls} style={{ animationDelay:`${delay}s` }}>
      <span className="ps-corner-tl" style={{ color:col }}>{r}<br/>{sym}</span>
      <span className="ps-suit-center" style={{ color:col }}>{sym}</span>
      <span className="ps-corner-br" style={{ color:col }}>{r}<br/>{sym}</span>
    </div>
  )
}

function EquityBar({ stage }) {
  const eq = EQUITIES[stage]
  return (
    <div className="ps-equity-wrap">
      <div className="ps-equity-labels">
        <span>Josh {eq.josh}%</span>
        <span>Villain {eq.villain}%</span>
      </div>
      <div className="ps-equity-bar">
        <div className="ps-equity-fill" style={{ width:`${eq.josh}%` }} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas chip drawing
// ─────────────────────────────────────────────────────────────────────────────
function drawChip(ctx, c) {
  const R = 11
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(c.rot)

  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = 7
  ctx.shadowOffsetY = c.settled ? 1 : 3

  ctx.beginPath()
  ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.fillStyle = c.color
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  ctx.beginPath()
  ctx.arc(0, 0, R - 2, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.32)'
  ctx.lineWidth = 2.5
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(0, 0, R - 5.5, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1
  ctx.stroke()

  const grad = ctx.createRadialGradient(-R * 0.28, -R * 0.28, 0, 0, 0, R)
  grad.addColorStop(0, 'rgba(255,255,255,0.26)')
  grad.addColorStop(0.55, 'rgba(255,255,255,0)')
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()

  ctx.restore()
}

// ─────────────────────────────────────────────────────────────────────────────
// Chip celebration — canvas physics, chips land on footer line, cleared on reset
// ─────────────────────────────────────────────────────────────────────────────
function ChipBurst({ origin }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const W   = window.innerWidth
    const H   = window.innerHeight

    // Fixed canvas = zero layout impact, no scroll jump
    canvas.width        = W * dpr
    canvas.height       = H * dpr
    canvas.style.width  = W + 'px'
    canvas.style.height = H + 'px'

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    // Chips stored in DOCUMENT coordinates; drawn at (docX, docY - scrollY) each frame
    const R        = 11
    const footerEl = document.querySelector('footer')
    const sy0      = window.scrollY

    // Floor = footer border-top in doc coords, chip bottom rests 2px above the line
    const floorDocY = footerEl
      ? footerEl.getBoundingClientRect().top + sy0 - 2
      : sy0 + H * 0.9

    const chips = Array.from({ length: 28 }, () => {
      const angle = rand(0, Math.PI * 2)
      const spd   = rand(180, 460)
      return {
        docX:    origin.x,
        docY:    origin.y + sy0,        // viewport y → doc y
        vx:      Math.cos(angle) * spd,
        vy:      Math.sin(angle) * spd - rand(200, 420),
        rot:     rand(0, Math.PI * 2),
        rotV:    rand(-14, 14),
        color:   CHIP_COLORS[Math.floor(rand(0, CHIP_COLORS.length))],
        settled: false,
        bounces: 0,
      }
    })

    let lastTime   = null
    let rafId
    let allSettled = false

    function redraw(sy) {
      ctx.clearRect(0, 0, W, H)
      for (const c of chips) drawChip(ctx, { ...c, x: c.docX, y: c.docY - sy })
    }

    function frame(time) {
      if (!lastTime) lastTime = time
      const dt = Math.min((time - lastTime) / 1000, 0.05)
      lastTime = time

      const sy = window.scrollY
      let anyMoving = false

      for (const c of chips) {
        if (!c.settled) {
          anyMoving = true
          c.vy    += 900 * dt
          c.docX  += c.vx   * dt
          c.docY  += c.vy   * dt
          c.rot   += c.rotV * dt

          if (c.docY + R >= floorDocY) {
            c.docY = floorDocY - R
            if (Math.abs(c.vy) < 70 || c.bounces >= 4) {
              c.settled = true
              c.vx = 0; c.vy = 0; c.rotV = 0
            } else {
              c.vy    = -Math.abs(c.vy) * 0.42
              c.vx   *= 0.82
              c.rotV *= 0.62
              c.bounces++
            }
          }

          if (c.docX - R < 0)  { c.docX = R;     c.vx =  Math.abs(c.vx) * 0.72 }
          if (c.docX + R > W)  { c.docX = W - R; c.vx = -Math.abs(c.vx) * 0.72 }
          if (c.docY - R < sy) { c.docY = sy + R; c.vy = Math.abs(c.vy) * 0.5   }
        }
      }

      redraw(sy)

      if (anyMoving) {
        rafId = requestAnimationFrame(frame)
      } else {
        allSettled = true
      }
    }

    // After chips settle, redraw on scroll so they stay pinned to the footer line
    function onScroll() { if (allSettled) redraw(window.scrollY) }
    window.addEventListener('scroll', onScroll, { passive: true })

    rafId = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position:'fixed', top:0, left:0, pointerEvents:'none', zIndex:9999 }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
const AUTO_DELAY = 4000

export default function PokerShowdown() {
  const [stage,    setStage]    = useState(null)
  const [dealKey,  setDealKey]  = useState(0)
  const [chips,    setChips]    = useState(null)
  const [progress, setProgress] = useState(0)
  const tableRef  = useRef(null)
  const timerRef  = useRef(null)
  const progRef   = useRef(null)
  const stageRef        = useRef(stage)
  const scrollRestoreRef = useRef(null)

  stageRef.current = stage

  // Fires synchronously after DOM mutations, before browser paint — prevents
  // the showdown banner growth from causing a visible scroll jump
  useLayoutEffect(() => {
    if (scrollRestoreRef.current !== null) {
      window.scrollTo({ top: scrollRestoreRef.current, behavior: 'instant' })
      scrollRestoreRef.current = null
    }
  })
  const isShowdown = stage === 'showdown'

  const advance = useCallback(() => {
    setStage(prev => {
      if (!prev)              return 'preflop'
      if (prev === 'preflop') return 'flop'
      if (prev === 'flop')    return 'turn'
      if (prev === 'turn')    return 'river'
      if (prev === 'river')   return 'showdown'
      return null
    })
    setDealKey(k => k + 1)
  }, [])

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current)
    clearInterval(progRef.current)
    setProgress(0)
    let elapsed = 0
    progRef.current = setInterval(() => {
      elapsed += 40
      setProgress(Math.min(100, (elapsed / AUTO_DELAY) * 100))
    }, 40)
    timerRef.current = setTimeout(() => {
      clearInterval(progRef.current)
      setProgress(0)
      if (stageRef.current !== 'showdown') advance()
    }, AUTO_DELAY)
  }, [advance])

  const stopTimer = useCallback(() => {
    clearTimeout(timerRef.current)
    clearInterval(progRef.current)
    setProgress(0)
  }, [])

  useEffect(() => {
    if (stage && stage !== 'showdown') startTimer()
    else stopTimer()
    return () => stopTimer()
  }, [stage])

  // Burst on showdown
  useEffect(() => {
    if (stage === 'showdown' && tableRef.current) {
      const rect = tableRef.current.getBoundingClientRect()
      setChips({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    }
  }, [stage])

  const handleManual = () => {
    if (stageRef.current === 'showdown') setChips(null) // clear chips on reset
    stopTimer()
    scrollRestoreRef.current = window.scrollY
    advance()
  }

  const boardVis = stage ? BOARD_VISIBLE[stage] : BOARD_VISIBLE.preflop

  return (
    <>
      <style>{CSS}</style>

      {chips && createPortal(<ChipBurst origin={chips} />, document.getElementById('chip-root'))}

      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1.2rem', paddingBottom:'0.5rem', overflowAnchor:'none' }}>

        {!stage && (
          <div className="ps-deck-wrap" onClick={handleManual} role="button" aria-label="Deal cards" style={{ marginTop:'1.1rem' }}>
            <div className="ps-deck">
              {[4,3,2,1,0].map(i => (
                <div key={i} className="ps-deck-card" style={{ bottom:i*2, right:i*2 }} />
              ))}
            </div>
            <span className="ps-deck-label">click to deal</span>
          </div>
        )}

        {stage && (
          <div className="ps-table" key={dealKey} ref={tableRef}>

            <div className="ps-pill">{STAGE_META[stage].label}</div>

            <div className="ps-hands">

              <div className="ps-hand">
                <div className="ps-hand-label">
                  Josh
                  {isShowdown && <span className="ps-badge ps-badge-win">🏆 Royal Flush</span>}
                </div>
                <div className="ps-cards">
                  {JOSH.map((c, i) => (
                    <CardFace key={i} r={c.r} s={c.s} large highlight={isShowdown} delay={i * 0.07} />
                  ))}
                </div>
              </div>

              <span className="ps-vs">vs</span>

              <div className="ps-hand">
                <div className="ps-hand-label">
                  Villain
                  {isShowdown && <span className="ps-badge ps-badge-lose">Quad Kings</span>}
                </div>
                <div className="ps-cards">
                  {stage === 'preflop'
                    ? VILLAIN.map((_, i) => <CardFace key={i} faceDown large delay={i * 0.07 + 0.14} />)
                    : VILLAIN.map((c, i) => (
                        <CardFace key={i} r={c.r} s={c.s} large highlight={isShowdown} delay={i * 0.07} />
                      ))
                  }
                </div>
              </div>

            </div>

            <EquityBar stage={stage} />

            <div className="ps-board">
              {BOARD.map((c, i) =>
                boardVis[i]
                  ? <CardFace key={i} r={c.r} s={c.s} highlight={isShowdown && JOSH_BOARD_HL[i]} delay={i * 0.07} />
                  : <div key={i} className="ps-slot" />
              )}
            </div>

            {isShowdown && (
              <div className="ps-banner">
                Josh wins with a <strong>Royal Flush</strong> — A♠ K♠ Q♠ J♠ T♠<br/>
                <span style={{ fontSize:'0.62rem', color:'var(--muted)' }}>
                  vs Quad Kings — the ultimate bad beat
                </span>
              </div>
            )}

            {!isShowdown && (
              <div className="ps-progress">
                <div
                  className="ps-progress-fill"
                  style={{ width:`${progress}%`, transitionDuration: progress === 0 ? '0ms' : '40ms' }}
                />
              </div>
            )}

            <button className="ps-btn" onClick={handleManual}>
              {isShowdown ? '↺ Reset' : 'Skip →'}
            </button>

          </div>
        )}

      </div>
    </>
  )
}
