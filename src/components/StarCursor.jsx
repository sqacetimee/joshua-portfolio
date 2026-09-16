import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { setLight, getSkyTargets, subscribeSkyTargets } from '../lib/light'
import { createLightField, MAX_OBSTACLES, MAX_TITLES, TRAIL_POINTS, EXTENT } from '../lib/lightField'
import { buildTitleAtlas, TITLE_PAD } from '../lib/titleField'
import styles from './StarCursor.module.css'

// A weighted spring: the star trails noticeably behind the pointer and eases in without bouncing
const STIFFNESS = 100
const DAMPING = 2 * 0.9 * Math.sqrt(STIFFNESS)
const OPEN_STIFFNESS = 60
const LIGHT_RADIUS = 265
const FIELD_SCALE = 0.75 // fine enough for crisp tile edges, still well under full resolution
const FIELD_SCALE_LOW = 0.5 // used if frames run slow
const SLOW_FRAME_MS = 30
const SLOW_LIMIT = 30 // sustained slow frames before lowering quality
const TRAIL_MS = 220
const PULSE_MS = 750
const LOCK_RADIUS = 46
const STAR_REACH = 24 // the star's bloom radius, for clipping it at a tile's edge
// Only the Projects and Photos tiles block the star and its light
const TILE_SELECTOR = '[data-light]'
// Page titles and project names bend the light around their letters, but don't hide the star
const TITLE_SELECTOR = 'main h1, main h2'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

function stepSpring(s, target, dt, stiffness, damping) {
  s.v += ((target - s.x) * stiffness - s.v * damping) * dt
  s.x += s.v * dt
}

// Signed distance from a point to a rounded box (negative inside)
function sdRoundBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r
  const qy = Math.abs(py - cy) - hh + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

// A rounded rectangle as an SVG path, for clipping the star where a tile covers it
function roundRectPath(x, y, w, h, r) {
  const f = (n) => n.toFixed(1)
  return `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}`
    + `A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}`
    + `V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`
}

/* A small glowing white dot that follows the pointer. It is pulled along behind it on a spring, and its
   light (see lib/lightField.js) is always centred on it. It travels behind the Projects and Photos tiles:
   they hide the star and block its light, which escapes around their edges. Page titles bend the light
   around their letters. It also drives the sky's flashlight and the tile rims through the shared light
   store. Mouse and trackpad only. */
export default function StarCursor() {
  const reduce = useReducedMotion()
  const canvasRef = useRef(null)
  const glowRef = useRef(null)
  const starRef = useRef(null)
  const clipRef = useRef(null)
  const bodyRef = useRef(null)
  const tagRef = useRef(null)
  const reticleRef = useRef(null)
  const nameRef = useRef(null)
  const infoRef = useRef(null)

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const canvas = canvasRef.current
    const glow = glowRef.current
    const star = starRef.current
    const clip = clipRef.current
    const body = bodyRef.current
    const tag = tagRef.current
    const reticle = reticleRef.current
    const field = createLightField(canvas, FIELD_SCALE)
    if (!field) glow.dataset.active = 'true'

    const px = { x: -9999, v: 0 }
    const py = { x: -9999, v: 0 }
    const open = { x: 0, v: 0 }
    let mx = 0
    let my = 0
    let openTarget = 0
    let entered = false
    let raf = 0
    let running = false
    let last = 0
    let clickAt = -1e9
    let lastStretch = 1
    let overInteractive = false
    let bubbleEl = null
    let lockKey = null
    let lockName = null
    let hoverName = null
    let pinned = null // the sky object the visitor clicked to keep labelled
    let dirty = true
    let tileEls = []
    let titleEls = []
    let titleKey = ''
    let titleAtlas = null
    let dialogOpen = false
    let nav = null
    let lastClip = 'none'
    let lastTileSig = 0
    let quality = 0 // 0 full, 1 lower resolution, 2 plain glow
    let slow = 0
    const trail = []
    const radiusCache = new WeakMap()
    const obstacles = new Float32Array(MAX_OBSTACLES * 4)
    const radii = new Float32Array(MAX_OBSTACLES)
    const shades = new Float32Array(MAX_OBSTACLES)
    const titleBoxes = new Float32Array(MAX_TITLES * 4)
    const titleUvs = new Float32Array(MAX_TITLES * 4)
    const titleShades = new Float32Array(MAX_TITLES)
    const trailData = new Float32Array(TRAIL_POINTS * 3)

    // Rebuild the letter distance fields only when the titles themselves change (text, size or font)
    const refreshTitles = () => {
      if (!field) return
      // Titles move while the site opens and while the name settles, so measure them once they are still
      if (document.documentElement.dataset.intro || document.documentElement.dataset.settling) {
        titleAtlas = null
        titleKey = ''
        dirty = true
        return
      }
      const key = titleEls.map((el) => {
        const r = el.getBoundingClientRect()
        return `${el.textContent}|${Math.round(r.width)}|${Math.round(r.height)}|${getComputedStyle(el).font}`
      }).join('\n')
      if (key === titleKey) return
      titleKey = key
      titleAtlas = buildTitleAtlas(titleEls)
      field.setTitleAtlas(titleAtlas)
    }

    const refreshTiles = () => {
      dirty = false
      tileEls = [...document.querySelectorAll(TILE_SELECTOR)]
      titleEls = [...document.querySelectorAll(TITLE_SELECTOR)]
      // Tiles sit under the photo viewer while it is open, so they don't block anything then
      dialogOpen = !!document.querySelector('[role="dialog"]')
      nav = document.querySelector('nav[data-scrolled]')
      refreshTitles()
    }

    const radiusOf = (el) => {
      let r = radiusCache.get(el)
      if (r === undefined) {
        r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
        radiusCache.set(el, r)
      }
      return r
    }

    const tick = (now) => {
      raf = 0
      const frameMs = last ? now - last : 16
      const dt = Math.min(1 / 30, frameMs / 1000)
      last = now

      if (reduce) {
        px.x = mx; px.v = 0
        py.x = my; py.v = 0
        open.x = openTarget; open.v = 0
      } else {
        stepSpring(px, mx, dt, STIFFNESS, DAMPING)
        stepSpring(py, my, dt, STIFFNESS, DAMPING)
        stepSpring(open, openTarget, dt, OPEN_STIFFNESS, 2 * Math.sqrt(OPEN_STIFFNESS))
      }
      const x = px.x
      const y = py.x
      const vx = reduce ? 0 : px.v
      const vy = reduce ? 0 : py.v
      const speed = Math.hypot(vx, vy)
      const lit = clamp(open.x, 0, 1)

      // Read the tiles and titles near the star first (fresh every frame, since tiles tilt and grow on
      // hover), before any styles are written, so layout is never forced mid-frame
      if (dirty) refreshTiles()
      const near = []
      const titles = []
      let tileSig = 0
      if (!dialogOpen && lit > 0) {
        const navBottom = nav?.dataset.scrolled === 'true' ? nav.getBoundingClientRect().bottom : -Infinity
        const reach = LIGHT_RADIUS * EXTENT
        for (const el of tileEls) {
          const r = el.getBoundingClientRect()
          // The part of a tile scrolled under the nav is hidden, so it can't block anything
          const top = Math.max(r.top, navBottom)
          if (r.width < 8 || r.bottom - top < 8) continue
          const hw = r.width / 2
          const hh = (r.bottom - top) / 2
          const cx = r.left + hw
          const cy = top + hh
          const radius = Math.min(radiusOf(el), hw, hh)
          const s = sdRoundBox(x, y, cx, cy, hw, hh, radius)
          if (s > reach) continue
          near.push({ s, cx, cy, hw, hh, radius })
          tileSig += r.left + r.top * 3 + r.width * 5 + r.height * 7
        }
        near.sort((a, b) => a.s - b.s)
        if (titleAtlas) {
          for (const entry of titleAtlas.entries) {
            if (!entry.el.isConnected) continue
            const r = entry.el.getBoundingClientRect()
            const left = r.left + entry.dx
            const top = r.top + entry.dy
            if (top + entry.h < navBottom) continue
            const s = sdRoundBox(x, y, left + entry.w / 2, top + entry.h / 2, entry.w / 2, entry.h / 2, 0)
            if (s > reach) continue
            titles.push({ s, left, top, entry })
            tileSig += r.left + r.top * 3
          }
          titles.sort((a, b) => a.s - b.s)
        }
      }
      const count = Math.min(near.length, MAX_OBSTACLES)
      let hidden = 0
      let clipPath = ''
      for (let i = 0; i < count; i++) {
        const t = near[i]
        obstacles[i * 4] = t.cx
        obstacles[i * 4 + 1] = t.cy
        obstacles[i * 4 + 2] = t.hw
        obstacles[i * 4 + 3] = t.hh
        radii[i] = t.radius
        // A tile the star has slid behind stops casting a shadow; the change is gradual across its edge
        shades[i] = smoothstep(-26, 8, t.s)
        hidden = Math.max(hidden, 1 - smoothstep(-8, 4, t.s))
        if (t.s < STAR_REACH) clipPath += roundRectPath(t.cx - t.hw - x, t.cy - t.hh - y, t.hw * 2, t.hh * 2, t.radius)
      }
      const titleCount = Math.min(titles.length, MAX_TITLES)
      for (let i = 0; i < titleCount; i++) {
        const { s, left, top, entry } = titles[i]
        titleBoxes[i * 4] = left - TITLE_PAD
        titleBoxes[i * 4 + 1] = top - TITLE_PAD
        titleBoxes[i * 4 + 2] = entry.w + 2 * TITLE_PAD
        titleBoxes[i * 4 + 3] = entry.h + 2 * TITLE_PAD
        titleUvs.set(entry.uv, i * 4)
        // Among the letters themselves the words stop casting shadows, so the light doesn't flicker
        titleShades[i] = smoothstep(-20, 10, s)
      }

      // The star, stretched a little along its direction of travel
      star.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`
      const stretch = 1 + Math.min(speed / 2200, 0.3)
      if (Math.abs(stretch - lastStretch) > 0.003 || (stretch === 1 && lastStretch !== 1)) {
        const a = Math.atan2(vy, vx)
        body.style.transform = stretch < 1.003
          ? 'none'
          : `rotate(${a.toFixed(3)}rad) scale(${stretch.toFixed(3)},${(1 / Math.sqrt(stretch)).toFixed(3)}) rotate(${(-a).toFixed(3)}rad)`
        lastStretch = stretch < 1.003 ? 1 : stretch
      }
      // Wherever a tile covers the star, cut it away, following the tile's rounded corners
      const nextClip = clipPath ? `path(evenodd, "M-64 -64H64V64H-64Z${clipPath}")` : 'none'
      if (nextClip !== lastClip) {
        clip.style.clipPath = nextClip
        lastClip = nextClip
      }
      // The sky's flashlight and the tile rims are centred on the star itself
      setLight(x, y, lit)

      // An extremely faint trail when moving fast
      if (!reduce && speed > 600 && lit > 0.5) {
        trail.push({ x, y, t: now })
        if (trail.length > TRAIL_POINTS - 1) trail.shift()
      }
      while (trail.length && now - trail[0].t > TRAIL_MS) trail.shift()

      // Click: a brief flare of the core (CSS) and a pulse through the light
      const pulseT = reduce ? 1 : (now - clickAt) / PULSE_MS
      const boost = reduce ? 0 : Math.max(0, 1 - (now - clickAt) / 300)

      // Lock onto a star, planet, the Sun or the Moon when the star cursor passes near one in open sky
      let nearSky = null
      if (!overInteractive && !bubbleEl && hidden === 0 && lit > 0.5) {
        for (const t of getSkyTargets()) {
          const d = (t.x - x) ** 2 + (t.y - y) ** 2
          if (d < LOCK_RADIUS * LOCK_RADIUS && (!nearSky || d < nearSky.d)) nearSky = { ...t, d }
        }
      }
      hoverName = nearSky ? nearSky.name : null
      // A pinned object keeps its label and follows the sky as it moves; it unpins if it sets below the horizon
      let best = nearSky
      if (pinned) {
        best = getSkyTargets().find((t) => t.name === pinned) || null
        if (!best) {
          pinned = null
          reticle.dataset.pinned = 'false'
          best = nearSky
        }
      }
      lockName = best ? best.name : null
      const key = best ? `${best.name}|${best.info}|${pinned === best.name}` : null
      if (best) reticle.style.transform = `translate3d(${best.x.toFixed(2)}px,${best.y.toFixed(2)}px,0)`
      if (key !== lockKey) {
        lockKey = key
        reticle.dataset.on = String(!!best)
        if (best) {
          // Planets and the brightest stars are already labelled on the sky itself; other pinned stars carry their name
          const mag = Number((best.info.match(/mag (-?[\d.]+)/) || [])[1])
          const labelledOnSky = best.info.startsWith('planet') || mag <= 1
          nameRef.current.textContent = best.name.startsWith('the ') || (pinned === best.name && !labelledOnSky) ? best.name : ''
          infoRef.current.textContent = best.info
        }
      }

      // The light field
      if (field && quality < 2) {
        // Newest first, starting from the star itself so the trail stays attached to it
        trailData[0] = x
        trailData[1] = y
        trailData[2] = trail.length ? 0.08 * (1 - (now - trail[trail.length - 1].t) / TRAIL_MS) : 0
        for (let i = 1; i < TRAIL_POINTS; i++) {
          const p = trail[trail.length - i]
          trailData[i * 3] = p ? p.x : 0
          trailData[i * 3 + 1] = p ? p.y : 0
          trailData[i * 3 + 2] = p ? 0.08 * (1 - (now - p.t) / TRAIL_MS) : 0
        }
        const pulseEase = 1 - Math.pow(1 - clamp(pulseT, 0, 1), 3)
        field.render({
          x, y, vx, vy,
          radius: LIGHT_RADIUS,
          power: 0.36 * lit * (1 + 0.7 * boost),
          hidden,
          pulse: pulseT < 1 ? [16 + LIGHT_RADIUS * 0.8 * pulseEase, 0.9 * (1 - pulseT) ** 2, 34] : [0, 0, 1],
          obstacles, radii, shades, count,
          titleBoxes, titleUvs, titleShades, titleCount,
          trail: trailData,
          extent: LIGHT_RADIUS * (EXTENT + Math.min(speed / 2600, 0.4) * 0.5),
        })
        // If this machine can't keep up, step down to a lower resolution, then to the plain glow
        slow = frameMs > SLOW_FRAME_MS ? slow + 1 : Math.max(0, slow - 0.5)
        if (slow > SLOW_LIMIT) {
          slow = 0
          quality += 1
          if (quality === 1) field.setScale(FIELD_SCALE_LOW)
          else {
            field.clear()
            glow.dataset.active = 'true'
          }
        }
      } else {
        glow.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`
        glow.style.opacity = (lit * (1 - 0.7 * hidden) * (1 + 0.5 * boost)).toFixed(3)
      }

      // Keep running while a nearby tile or title is still moving (growing on hover, scrolling)
      const tilesMoving = Math.abs(tileSig - lastTileSig) > 0.05
      lastTileSig = tileSig
      const settled = Math.abs(mx - x) < 0.08 && Math.abs(my - y) < 0.08 && Math.abs(px.v) < 1 && Math.abs(py.v) < 1
        && Math.abs(openTarget - open.x) < 0.002 && Math.abs(open.v) < 0.01
        && trail.length === 0 && pulseT >= 1 && !tilesMoving
      if (settled) {
        running = false
        last = 0
      } else {
        raf = requestAnimationFrame(tick)
      }
    }

    // Runs only while something is moving, then sleeps; the canvas keeps its last frame
    const wake = () => {
      if (running) return
      running = true
      raf = requestAnimationFrame(tick)
    }

    const onMove = (e) => {
      if (e.pointerType !== 'mouse') return
      mx = e.clientX
      my = e.clientY
      if (!entered) {
        // Appear where the pointer is instead of flying in from elsewhere
        entered = true
        px.x = mx; px.v = 0
        py.x = my; py.v = 0
        star.dataset.on = 'true'
      }
      openTarget = 1
      const el = e.target instanceof Element ? e.target : null
      const nextBubble = el?.closest('[data-cursor]') || null
      if (nextBubble !== bubbleEl) {
        bubbleEl = nextBubble
        if (bubbleEl) tag.textContent = bubbleEl.dataset.cursor
        tag.dataset.on = String(!!bubbleEl)
      }
      // Don't lock onto sky objects while pointing at links, buttons or text
      overInteractive = !bubbleEl && !!el?.closest('a, button, p, h1, h2, h3, li, dd, dt, figcaption, input')
      wake()
    }
    const onLeave = (e) => {
      if (e.relatedTarget) return
      openTarget = 0
      entered = false
      star.dataset.on = 'false'
      wake()
    }
    const onDown = (e) => {
      if (e.pointerType !== 'mouse') return
      clickAt = performance.now()
      // Click a star, planet, the Sun or the Moon in open sky to pin its label; click empty sky to unpin
      const target = e.target instanceof Element ? e.target : null
      if (!target?.closest('a, button, input, label, nav, [role="button"], [role="dialog"], [data-cursor], [data-light]')) {
        if (hoverName && hoverName !== pinned) {
          pinned = hoverName
          reticle.dataset.pinned = 'true'
        } else if (pinned) {
          pinned = null
          reticle.dataset.pinned = 'false'
        }
        lockKey = null
      }
      star.dataset.down = 'true'
      wake()
    }
    const onUp = () => { star.dataset.down = 'false' }
    const onScroll = () => { if (entered) wake() }
    const onKey = (e) => {
      if (e.key !== 'Escape' || !pinned) return
      pinned = null
      reticle.dataset.pinned = 'false'
      lockKey = null
      wake()
    }
    const onResize = () => {
      field?.resize()
      dirty = true
      if (entered) wake()
    }
    // Titles must be measured in their real font, so rebuild once web fonts finish loading
    const onFonts = () => {
      titleKey = ''
      dirty = true
      if (entered) wake()
    }
    document.fonts?.ready.then(onFonts)
    document.fonts?.addEventListener?.('loadingdone', onFonts)

    const mutations = new MutationObserver(() => {
      dirty = true
      if (entered) wake()
    })
    mutations.observe(document.body, { childList: true, subtree: true })
    mutations.observe(document.documentElement, { attributes: true, attributeFilter: ['data-intro', 'data-settling'] })
    const unsubscribeTargets = subscribeSkyTargets(() => { if (entered) wake() })

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    document.addEventListener('mouseout', onLeave)
    return () => {
      window.removeEventListener('keydown', onKey)
      cancelAnimationFrame(raf)
      mutations.disconnect()
      unsubscribeTargets()
      document.fonts?.removeEventListener?.('loadingdone', onFonts)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('mouseout', onLeave)
      setLight(-9999, -9999, 0)
      field?.destroy()
    }
  }, [reduce])

  return (
    <>
      <canvas ref={canvasRef} className={styles.field} data-star-cursor aria-hidden="true" />
      <div ref={glowRef} className={styles.fallbackGlow} data-star-cursor aria-hidden="true" />
      <div ref={reticleRef} className={styles.reticle} data-on="false" data-pinned="false" data-star-cursor aria-hidden="true">
        <span className={styles.reticleRing} />
        <span className={styles.lockLabel}>
          <span ref={nameRef} className={styles.lockName} />
          <span ref={infoRef} className={styles.lockInfo} />
        </span>
      </div>
      <div ref={starRef} className={styles.star} data-on="false" data-down="false" data-star-cursor aria-hidden="true">
        <div ref={clipRef} className={styles.clip}>
          <div ref={bodyRef} className={styles.body}>
            <span className={styles.bloom} />
            <span className={styles.core} />
          </div>
        </div>
        <span ref={tagRef} className={styles.tag} data-on="false" />
      </div>
    </>
  )
}
