import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import {
  D2R, localSiderealDeg, toHorizontal, airmass, bvToRgb, precessFromJ2000,
  planetPositions, moonPosition, moonPhase, moonPath, sunPosition, towards,
} from '../lib/astro'
import { getSkyOffset, subscribeSkyOffset, setSkyShown, setSkyDriven } from '../lib/skyTime'
import { getWeather, weatherAt } from '../lib/weather'
import { getLight, subscribeLight, setSkyTargets } from '../lib/light'
import styles from './SkyBackdrop.module.css'

const TAU = Math.PI * 2
const BRIGHT_MAG = 2.6 // stars at least this bright twinkle on their own layer
const EXTINCTION = 0.25
const GLIDE_MS = 240 // base time constant for easing the sky towards a new time
const LENS_R = 150 // radius of the star chart window around the star cursor
const HOLE_D = 520 // soft hole the star's light makes in the night veil (wide, with a long eased edge)
const HAZE_SCALE = 6 // the Milky Way is drawn at 1/6 size, blurred, then scaled up
const CLOUD_TEX = 256 // cloud texture size; it tiles seamlessly in both directions
const CLOUD_RES = 2 // the cloud layer renders at half size and the browser scales it up
const CLOUD_FRAME_MS = 66 // clouds drift slowly; 15 updates a second is plenty
const TWI_RES = 6 // twilight colours are smooth, so they are computed at 1/6 size and scaled up
// Used only if the weather can't be loaded: light cloud on a typical westerly breeze
const FALLBACK_WEATHER = { cover: 18, speed: 14, from: 270 }
// Toronto's light dome seen from Waterloo: about 95 km away on a bearing of 78°
const TORONTO_AZ = 78 * D2R
// Galactic centre (J2000). The Milky Way's central bulge, in Sagittarius, glows warmer than its disc
const GC_RA = 266.4
const GC_DEC = -28.94
const WARM_COS = Math.cos(50 * D2R)

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`
const mod = (a, n) => ((a % n) + n) % n

// Faint stars are batched into a few colour classes; their tints are too subtle to need more
const CLASS_RGB = [-0.1, 0.35, 0.85, 1.4].map((bv) => bvToRgb(bv).join(','))
const colourClass = (bv) => (bv < 0.1 ? 0 : bv < 0.6 ? 1 : bv < 1.15 ? 2 : 3)

// Sky colours: deep enough at every hour for the page text to stay readable
const NIGHT = { zenith: [5, 8, 21], horizon: [16, 22, 46] }
const TWILIGHT = { zenith: [18, 32, 76], horizon: [74, 64, 112] }
const DAY = { zenith: [36, 78, 144], horizon: [104, 146, 192] }

// Cloud colours: sunlit edge and shadowed underside, by time of day
const CLOUD = {
  // Kept translucent so even an overcast sky never buries the text on the page
  night: { lit: [52, 60, 84], shade: [16, 20, 32], alpha: 0.38 },
  twilight: { lit: [255, 168, 128], shade: [62, 54, 88], alpha: 0.6 },
  day: { lit: [250, 251, 253], shade: [118, 132, 158], alpha: 0.84 },
}

const hourFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', hour: '2-digit', hourCycle: 'h23' })

function skyState(sunAlt, moonAlt, moonIllum) {
  const tw = clamp((sunAlt + 18) / 18, 0, 1)
  const day = clamp((sunAlt + 2) / 12, 0, 1)
  let zenith = mix(NIGHT.zenith, TWILIGHT.zenith, tw * tw)
  let horizon = mix(NIGHT.horizon, TWILIGHT.horizon, tw)
  zenith = mix(zenith, DAY.zenith, day)
  horizon = mix(horizon, DAY.horizon, day)
  const moonlight = moonAlt > 0 ? moonIllum * clamp(moonAlt / 20, 0, 1) * (1 - tw) : 0
  zenith = mix(zenith, [14, 20, 36], moonlight * 0.5)
  const darkness = 1 - clamp((sunAlt + 18) / 12, 0, 1)
  // Faintest visible magnitude: washed out by twilight, moonlight and daylight
  const nightLimit = 1.4 + 3.9 * darkness - moonlight * 1.2
  const limitMag = nightLimit + (-1.5 - nightLimit) * day
  return { zenith, horizon, tw, day, darkness, moonlight, limitMag }
}

/* Fractal value noise that wraps seamlessly on both axes, normalised to 0..1 */
function tileableNoise(size, seed) {
  const out = new Float32Array(size * size)
  const hash = (n) => {
    const s = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453
    return s - Math.floor(s)
  }
  let amp = 1
  // Five octaves on the larger texture: defined cloud edges without turning blocky when scaled up
  for (let octave = 0, cells = 4; octave < 5; octave++, cells *= 2) {
    const lattice = new Float32Array(cells * cells)
    for (let i = 0; i < lattice.length; i++) lattice[i] = hash(i + octave * 7919)
    for (let y = 0; y < size; y++) {
      const fy = (y * cells) / size
      const iy = Math.floor(fy)
      const ty = fy - iy
      const sy = ty * ty * (3 - 2 * ty)
      const y0 = iy * cells
      const y1 = ((iy + 1) % cells) * cells
      for (let x = 0; x < size; x++) {
        const fx = (x * cells) / size
        const ix = Math.floor(fx)
        const tx = fx - ix
        const sx = tx * tx * (3 - 2 * tx)
        const x1 = (ix + 1) % cells
        const top = lattice[y0 + ix] + (lattice[y0 + x1] - lattice[y0 + ix]) * sx
        const bottom = lattice[y1 + ix] + (lattice[y1 + x1] - lattice[y1 + ix]) * sx
        out[y * size + x] += (top + (bottom - top) * sy) * amp
      }
    }
    amp *= 0.5
  }
  let lo = Infinity
  let hi = -Infinity
  for (const v of out) { if (v < lo) lo = v; if (v > hi) hi = v }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo)
  return out
}

/* Shift the J2000 catalogue to today's equinox and split it into static and twinkling stars */
function prepare(data, date) {
  const precess = (ra, dec) => precessFromJ2000(ra, dec, date)
  const stars = data.STARS.map(([ra, dec, mag, bv], i) => {
    const [pra, pdec] = precess(ra, dec)
    const colour = bvToRgb(bv)
    return { ra: pra, dec: pdec, mag, rgbArr: colour, rgb: colour.join(','), cls: colourClass(bv), seed: (i * 12.9898) % TAU }
  })
  const milkyWay = []
  const sinGC = Math.sin(GC_DEC * D2R)
  const cosGC = Math.cos(GC_DEC * D2R)
  for (let j = 0; j < data.MILKY_WAY.length; j += 3) {
    const ra0 = data.MILKY_WAY[j]
    const dec0 = data.MILKY_WAY[j + 1]
    const toCentre = Math.sin(dec0 * D2R) * sinGC + Math.cos(dec0 * D2R) * cosGC * Math.cos((ra0 - GC_RA) * D2R)
    const [ra, dec] = precess(ra0, dec0)
    milkyWay.push(ra, dec, data.MILKY_WAY[j + 2], toCentre > WARM_COS ? 1 : 0)
  }
  // The Great Rift: dark dust lanes that split the Milky Way from Cygnus down to Sagittarius (J2000)
  const RIFT = [[311, 44], [303, 33], [296, 20], [291, 8], [285, -2], [278, -11], [271, -19], [265, -26]]
  const rift = []
  for (let i = 0; i < RIFT.length - 1; i++) {
    for (let k = 0; k < 4; k++) {
      const t = k / 4
      rift.push(precess(RIFT[i][0] + (RIFT[i + 1][0] - RIFT[i][0]) * t, RIFT[i][1] + (RIFT[i + 1][1] - RIFT[i][1]) * t))
    }
  }
  return {
    rift,
    faint: stars.filter((s) => s.mag > BRIGHT_MAG),
    bright: stars.filter((s) => s.mag <= BRIGHT_MAG),
    named: data.NAMED.map(([ra, dec, mag, name]) => {
      const [pra, pdec] = precess(ra, dec)
      return { ra: pra, dec: pdec, mag, name }
    }),
    lines: data.LINES.map((line) => line.map(([ra, dec]) => precess(ra, dec))),
    labels: data.LABELS.map(([ra, dec, name]) => {
      const [pra, pdec] = precess(ra, dec)
      return { ra: pra, dec: pdec, name }
    }),
    milkyWay,
  }
}

/* The real sky over Waterloo behind the whole site, at "now" plus the chosen time offset:
   stars, planets, Moon, Sun, real clouds and wind. The star cursor's light opens a window through the
   night veil onto a star chart (constellation lines, names, altitude rings and the Sun's path). */
export default function SkyBackdrop({ home }) {
  const baseRef = useRef(null)
  const sparkRef = useRef(null)
  const cloudRef = useRef(null)
  const lensRef = useRef(null)
  const lensWinRef = useRef(null)
  const holeRef = useRef(null)
  const veilTopRef = useRef(null)
  const veilBottomRef = useRef(null)
  const veilLeftRef = useRef(null)
  const veilRightRef = useRef(null)
  const reduce = useReducedMotion()
  const [ready, setReady] = useState(false)
  const [finePointer] = useState(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  const { scrollY } = useScroll()
  // A night veil darkens the sky as you scroll; the star's light cuts through it
  const veilOnScroll = useTransform(scrollY, (y) => Math.min(0.7, (y / (window.innerHeight * 0.9)) * 0.7))

  useEffect(() => {
    const base = baseRef.current
    const spark = sparkRef.current
    const lens = lensRef.current
    const bctx = base.getContext('2d')
    const sctx = spark.getContext('2d')
    const lctx = lens.getContext('2d')
    const cloudCanvas = cloudRef.current
    const cctx = cloudCanvas.getContext('2d')
    const haze = document.createElement('canvas')
    const hctx = haze.getContext('2d')
    const hazeBlur = document.createElement('canvas')
    const hbctx = hazeBlur.getContext('2d')
    const twilight = document.createElement('canvas')
    const twctx = twilight.getContext('2d')
    let twImage = null
    const canBlur = typeof bctx.filter === 'string'
    const glowSprites = new Map()
    const labelWidths = new Map()
    let alive = true
    let raf = 0
    let last = 0
    let lastBase = 0
    let lastCloud = 0
    let settledDrawn = false
    let sky = null
    let weather = undefined
    let w = 0
    let h = 0
    let dpr = 1
    let scale = 1
    let shown = getSkyOffset()
    let bright = []
    let planets = []
    let moon = null
    let sun = null
    let dayAmount = 0
    let darkAmount = 0
    let lastBrightness = -1
    let nextMeteorAt = 0
    const meteors = []

    // Clouds: two tiling layers (far and near) drifting with the real wind
    const cloudNoise = []
    const cloudLayers = [
      { scale: 1.3, alpha: 1, speed: 1, offset: [0, 0] },
      { scale: 0.72, alpha: 0.55, speed: 0.55, offset: [0, 0] },
    ].map((layer) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = CLOUD_TEX
      return { ...layer, canvas, ctx: canvas.getContext('2d'), pattern: null }
    })
    const clouds = { cover: 0, lit: [0, 0, 0], shade: [0, 0, 0], alpha: 0, lx: 0, ly: -1, vx: 0, vy: 0, tint: 0, tx: 0, ty: 0, tr: 1 }
    let cloudKey = ''
    let cloudBuiltAt = 0

    const currentDate = () => new Date(Date.now() + shown * 3600000)

    // Soft glow of a given colour, rendered once and reused every frame
    const glowSprite = (colour) => {
      let sprite = glowSprites.get(colour)
      if (sprite) return sprite
      sprite = document.createElement('canvas')
      sprite.width = sprite.height = 64
      const g = sprite.getContext('2d')
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, `rgba(${colour},1)`)
      grad.addColorStop(1, `rgba(${colour},0)`)
      g.fillStyle = grad
      g.fillRect(0, 0, 64, 64)
      glowSprites.set(colour, sprite)
      return sprite
    }

    /* Rebuild the cloud textures when cover, colour or sun direction change (throttled) */
    const buildClouds = (now) => {
      if (clouds.cover < 1) return
      const key = `${Math.round(clouds.cover / 2)}|${clouds.lit.map((v) => v >> 3)}|${clouds.shade.map((v) => v >> 3)}|${clouds.lx.toFixed(1)},${clouds.ly.toFixed(1)}`
      if (key === cloudKey || now - cloudBuiltAt < 400) return
      if (!cloudNoise.length) cloudNoise.push(tileableNoise(CLOUD_TEX, 3.17), tileableNoise(CLOUD_TEX, 11.9))
      cloudKey = key
      cloudBuiltAt = now
      const S = CLOUD_TEX
      // More cloud cover lowers the density threshold, so more of the noise becomes cloud
      // Even a fully overcast sky keeps some structure, so the clouds read as clouds rather than a grey sheet
      const threshold = 0.74 - (clouds.cover / 100) * 0.42
      const ox = Math.round(clouds.lx * 7)
      const oy = Math.round(clouds.ly * 7)
      const { lit, shade } = clouds
      cloudLayers.forEach((layer, li) => {
        const noise = cloudNoise[li]
        const img = layer.ctx.createImageData(S, S)
        const px = img.data
        for (let y = 0; y < S; y++) {
          const row = y * S
          const sunRow = mod(y + oy, S) * S
          for (let x = 0; x < S; x++) {
            const v = noise[row + x]
            const t = clamp((v - (threshold - 0.04)) / 0.2, 0, 1)
            if (t <= 0) continue
            const density = t * t * (3 - 2 * t)
            // Edges facing the sun (where density falls away towards it) catch the light
            const toward = noise[sunRow + mod(x + ox, S)]
            const light = clamp(0.5 + (v - toward) * 9 - (density - 0.5) * 0.45, 0, 1)
            const o = (row + x) * 4
            px[o] = shade[0] + (lit[0] - shade[0]) * light
            px[o + 1] = shade[1] + (lit[1] - shade[1]) * light
            px[o + 2] = shade[2] + (lit[2] - shade[2]) * light
            px[o + 3] = density * 255
          }
        }
        layer.ctx.putImageData(img, 0, 0)
        layer.pattern = cctx.createPattern(layer.canvas, 'repeat')
      })
    }

    const setup = () => {
      w = base.clientWidth
      h = base.clientHeight
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      scale = Math.max(0.75, Math.min(1.2, Math.min(w, h) / 850))
      for (const c of finePointer ? [base, spark, lens] : [base, spark]) {
        c.width = Math.round(w * dpr)
        c.height = Math.round(h * dpr)
      }
      // The lens canvas lives inside the moving window, so it needs explicit page-sized dimensions
      lens.style.width = `${w}px`
      lens.style.height = `${h}px`
      haze.width = hazeBlur.width = Math.ceil(w / HAZE_SCALE)
      haze.height = hazeBlur.height = Math.ceil(h / HAZE_SCALE)
      cloudCanvas.width = Math.ceil(w / CLOUD_RES)
      cloudCanvas.height = Math.ceil(h / CLOUD_RES)
      twilight.width = Math.ceil(w / TWI_RES)
      twilight.height = Math.ceil(h / TWI_RES)
      labelWidths.clear()
      // Patterns belong to the cloud context, which resets on resize
      cloudKey = ''
      cloudBuiltAt = 0
    }

    /* Sunrise, sunset and twilight, worked out for every point of the sky from its altitude and its angle
       from the sun's direction, so the colours follow the horizon instead of sitting in round patches:
       a red and orange band hugging the horizon under the sun, a golden glow that rises higher as the sun
       sinks, the purple light high above the sunset point while the sun is about 2 to 7 degrees down,
       the deep blue hour, and opposite the sun Earth's blue shadow rising under the pink Belt of Venus. */
    const drawTwilight = (S, sunAz, cx, cy, R) => {
      const tw = twilight.width
      const th = twilight.height
      if (!tw || !th) return
      if (!twImage || twImage.width !== tw || twImage.height !== th) twImage = twctx.createImageData(tw, th)
      const px = twImage.data
      const down = Math.max(0, -S)
      // How strong each effect is at this sun altitude
      const red = smoothstep(-8, -1, S) * (1 - smoothstep(2, 9, S))
      const warm = smoothstep(-12, -1, S) * (1 - smoothstep(6, 18, S))
      const purple = smoothstep(-8, -4, S) * (1 - smoothstep(-3, -1, S))
      const belt = smoothstep(-7, -3, S) * (1 - smoothstep(1, 5, S))
      const blue = smoothstep(-12, -6, S) * (1 - smoothstep(-4, -1, S))
      // The glow climbs and Earth's shadow rises as the sun sinks
      const glowH = 8 + down * 1.4
      const shadowTop = 2 + down * 1.4
      const beltH = shadowTop + 7
      const toDeg = 1 / D2R
      for (let j = 0; j < th; j++) {
        const dy = (j + 0.5) * TWI_RES - cy
        for (let i = 0; i < tw; i++) {
          const dx = (i + 0.5) * TWI_RES - cx
          const alt = 90 - 2 * Math.atan(Math.hypot(dx, dy) / R) * toDeg
          let dAz = Math.abs((Math.atan2(-dx, -dy) - sunAz) * toDeg) % 360
          if (dAz > 180) dAz = 360 - dAz
          const sunSide = Math.exp(-((dAz / 62) ** 2))
          const antiSide = Math.exp(-(((180 - dAz) / 75) ** 2))
          const w1 = 0.7 * red * sunSide * Math.exp(-alt / 7)
          const w2 = 0.58 * warm * sunSide * Math.exp(-alt / glowH)
          const w3 = 0.35 * warm * Math.exp(-((dAz / 95) ** 2)) * Math.exp(-alt / (glowH * 2.4))
          const w4 = 0.36 * purple * Math.exp(-((dAz / 55) ** 2)) * Math.exp(-(((alt - 24) / 14) ** 2))
          const w5 = 0.42 * belt * antiSide * (1 - smoothstep(shadowTop - 2, shadowTop + 2, alt))
          const w6 = 0.42 * belt * antiSide * Math.exp(-(((alt - beltH) / 7) ** 2))
          const w7 = 0.3 * blue * (1 - 0.6 * sunSide) * (0.6 + 0.4 * Math.exp(-alt / 40))
          const sum = w1 + w2 + w3 + w4 + w5 + w6 + w7
          const o = (j * tw + i) * 4
          if (sum < 0.002) {
            px[o + 3] = 0
            continue
          }
          px[o] = (255 * (w1 + w2 + w3) + 196 * w4 + 46 * w5 + 236 * w6 + 36 * w7) / sum
          px[o + 1] = (86 * w1 + 146 * w2 + 204 * w3 + 116 * w4 + 58 * w5 + 156 * w6 + 60 * w7) / sum
          px[o + 2] = (44 * w1 + 72 * w2 + 150 * w3 + 196 * w4 + 104 * w5 + 178 * w6 + 132 * w7) / sum
          px[o + 3] = 255 * (1 - (1 - w1) * (1 - w2) * (1 - w3) * (1 - w4) * (1 - w5) * (1 - w6) * (1 - w7))
        }
      }
      twctx.putImageData(twImage, 0, 0)
      bctx.save()
      bctx.imageSmoothingEnabled = true
      bctx.imageSmoothingQuality = 'high'
      bctx.drawImage(twilight, 0, 0, tw * TWI_RES, th * TWI_RES)
      bctx.restore()
    }

    const drawBase = (date) => {
      if (!sky || !w) return
      const lst = localSiderealDeg(date)
      // Looking straight up: zenith a little above centre, most of the sky across the screen
      const cx = w / 2
      const cy = h * 0.42
      const R = Math.hypot(w, h) * 0.6
      const place = (alt, az) => {
        const r = R * Math.tan(Math.min(Math.PI / 2 - alt, 2.6) / 2)
        return [cx - r * Math.sin(az), cy - r * Math.cos(az)]
      }
      const project = (ra, dec) => {
        const [alt, az] = toHorizontal(ra, dec, lst)
        const [x, y] = place(alt, az)
        return [x, y, alt]
      }
      const fillGradient = (grad) => {
        bctx.fillStyle = grad
        bctx.fillRect(0, 0, w, h)
      }

      const sunEq = sunPosition(date)
      const [sunAlt, sunAz] = toHorizontal(sunEq.ra, sunEq.dec, lst)
      const sunAltDeg = sunAlt / D2R
      const mp = moonPosition(date)
      const [mAltGeo, mAz] = toHorizontal(mp.ra, mp.dec, lst)
      const mAlt = mAltGeo - 0.95 * D2R * Math.cos(mAltGeo) // topocentric parallax
      const phase = moonPhase(date)
      const st = skyState(sunAltDeg, mAlt / D2R, phase.illum)
      const dim = 1 - st.day * 0.85
      const visibleMag = (mag, alt) => mag + EXTINCTION * (airmass(alt) - 1) <= st.limitMag
      dayAmount = st.day
      // How bright the sky is, for the page to keep its text readable in daylight (index.css, --sky-day)
      const brightness = Math.round(Math.max(st.day, st.tw * 0.35) * 100) / 100
      if (brightness !== lastBrightness) {
        lastBrightness = brightness
        document.documentElement.style.setProperty('--sky-day', String(brightness))
      }
      darkAmount = st.darkness

      // Real cloud cover and wind for this moment
      const wx = (weather && weatherAt(weather, date.getTime())) || FALLBACK_WEATHER
      const [sunX, sunY] = place(sunAlt, sunAz)
      const sunLen = Math.hypot(sunX - cx, sunY - cy) || 1
      const [horizonSunX, horizonSunY] = place(0, sunAz)
      const toward = ((wx.from + 180) % 360) * D2R // wind blows towards the opposite direction
      const drift = clamp(wx.speed, 0, 60) * 1.1 * scale
      const tone = (key) => mix(mix(CLOUD.night[key], CLOUD.twilight[key], st.tw * st.tw), CLOUD.day[key], st.day)
      Object.assign(clouds, {
        cover: weather === undefined ? 0 : wx.cover,
        lit: tone('lit'),
        shade: tone('shade'),
        alpha: CLOUD.night.alpha + (CLOUD.twilight.alpha - CLOUD.night.alpha) * st.tw + (CLOUD.day.alpha - CLOUD.twilight.alpha) * st.day,
        lx: (sunX - cx) / sunLen,
        ly: (sunY - cy) / sunLen,
        vx: -Math.sin(toward) * drift,
        vy: -Math.cos(toward) * drift,
        // Around sunrise and sunset the clouds catch warm light from below, strongest facing the sun
        tint: smoothstep(-9, -2, sunAltDeg) * (1 - smoothstep(4, 12, sunAltDeg)),
        tx: horizonSunX,
        ty: horizonSunY,
        tr: R * 1.6,
      })

      bctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      bctx.globalCompositeOperation = 'source-over'
      bctx.globalAlpha = 1

      // Sky colour: zenith at the centre, horizon colour towards the edges
      const skyGrad = bctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      skyGrad.addColorStop(0, rgb(st.zenith))
      skyGrad.addColorStop(1, rgb(st.horizon))
      fillGradient(skyGrad)

      // Night: city light low on every horizon, Toronto's brighter dome, and the faint green airglow
      // that sits about 10° above the horizon on dark nights (oxygen emission at 90 to 100 km up)
      if (st.darkness > 0.01) {
        const d = st.darkness
        const horizonLight = bctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.02)
        horizonLight.addColorStop(0, 'rgba(120,100,86,0)')
        horizonLight.addColorStop(0.7, `rgba(88,116,96,${0.055 * d})`)
        horizonLight.addColorStop(1, `rgba(132,104,86,${0.22 * d})`)
        fillGradient(horizonLight)
        const [tx, ty] = place(0, TORONTO_AZ)
        const dome = bctx.createRadialGradient(tx, ty, 0, tx, ty, R * 0.55)
        dome.addColorStop(0, `rgba(176,130,96,${0.2 * d})`)
        dome.addColorStop(1, 'rgba(176,130,96,0)')
        fillGradient(dome)
      }

      // Sunrise, sunset and twilight colours across the whole sky (see drawTwilight)
      if (sunAltDeg > -16 && sunAltDeg < 18) drawTwilight(sunAltDeg, sunAz, cx, cy, R)

      // Daytime: a broad soft glow on the side of the sky where the sun is
      const glow = smoothstep(4, 16, sunAltDeg) * (1 - st.day * 0.5)
      if (glow > 0.01) {
        const [gx, gy] = place(sunAlt, sunAz)
        const g = bctx.createRadialGradient(gx, gy, 0, gx, gy, R * 1.1)
        g.addColorStop(0, `rgba(255,236,200,${0.36 * glow})`)
        g.addColorStop(0.45, `rgba(255,236,200,${0.09 * glow})`)
        g.addColorStop(1, 'rgba(255,236,200,0)')
        fillGradient(g)
      }

      // Daylight scattering: the sky whitens towards the horizon, where sunlight crosses more air
      if (st.day > 0.01) {
        const scatter = bctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 0.95)
        scatter.addColorStop(0, 'rgba(196,218,242,0)')
        scatter.addColorStop(1, `rgba(196,218,242,${0.18 * st.day})`)
        fillGradient(scatter)
      }

      // Milky Way: wide overlapping blobs on a small canvas, blurred there (cheap), then scaled up.
      // Regions near the galactic centre are drawn warmer, like the old yellow stars of the bulge
      const mwVis = st.darkness * (1 - st.moonlight * 0.7)
      if (mwVis > 0.02) {
        const q = HAZE_SCALE
        hctx.clearRect(0, 0, haze.width, haze.height)
        hctx.globalAlpha = 0.075
        const mw = sky.milkyWay
        const count = mw.length / 4
        const px = new Float32Array(count)
        const py = new Float32Array(count)
        const ok = new Uint8Array(count)
        for (let i = 0, j = 0; i < count; i++, j += 4) {
          const [x, y, alt] = project(mw[j], mw[j + 1])
          px[i] = x
          py[i] = y
          ok[i] = alt > -0.1 ? 1 : 0
        }
        for (let level = 1; level <= 5; level++) {
          for (const warm of [0, 1]) {
            hctx.fillStyle = warm ? 'rgb(255,222,188)' : 'rgb(188,202,255)'
            hctx.beginPath()
            for (let i = 0; i < count; i++) {
              if (!ok[i] || mw[i * 4 + 2] < level || mw[i * 4 + 3] !== warm) continue
              const d2 = ((px[i] - cx) ** 2 + (py[i] - cy) ** 2) / (R * R)
              const r = (R * 0.036 * (1 + d2)) / q
              hctx.moveTo(px[i] / q + r, py[i] / q)
              hctx.arc(px[i] / q, py[i] / q, r, 0, TAU)
            }
            hctx.fill()
          }
        }
        // Carve the Great Rift out of the glow before blurring it
        hctx.globalCompositeOperation = 'destination-out'
        hctx.globalAlpha = 0.5
        hctx.fillStyle = '#000'
        hctx.beginPath()
        for (const [ra, dec] of sky.rift) {
          const [x, y, alt] = project(ra, dec)
          if (alt < -0.1) continue
          const d2 = ((x - cx) ** 2 + (y - cy) ** 2) / (R * R)
          const r = (R * 0.02 * (1 + d2)) / q
          hctx.moveTo(x / q + r, y / q)
          hctx.arc(x / q, y / q, r, 0, TAU)
        }
        hctx.fill()
        hctx.globalCompositeOperation = 'source-over'
        let source = haze
        if (canBlur) {
          hbctx.clearRect(0, 0, hazeBlur.width, hazeBlur.height)
          hbctx.filter = 'blur(3px)'
          hbctx.drawImage(haze, 0, 0)
          hbctx.filter = 'none'
          source = hazeBlur
        }
        bctx.save()
        bctx.globalCompositeOperation = 'screen'
        bctx.globalAlpha = Math.min(1, 1.05 * mwVis)
        bctx.imageSmoothingQuality = 'high'
        bctx.drawImage(source, 0, 0, w, h)
        bctx.restore()
      }

      // Constellation figures: faint on the sky, clearer inside the star's light
      const segments = []
      for (const line of sky.lines) {
        let prev = null
        for (const [ra, dec] of line) {
          const p = project(ra, dec)
          if (prev && (prev[2] > 0 || p[2] > 0)) segments.push(prev[0], prev[1], p[0], p[1])
          prev = p
        }
      }
      const strokeSegments = (ctx) => {
        ctx.beginPath()
        for (let i = 0; i < segments.length; i += 4) {
          ctx.moveTo(segments[i], segments[i + 1])
          ctx.lineTo(segments[i + 2], segments[i + 3])
        }
        ctx.stroke()
      }
      bctx.strokeStyle = `rgba(150,172,230,${0.1 * dim})`
      bctx.lineWidth = 0.9
      strokeSegments(bctx)

      // Faint stars, dimmed near the horizon and by any light in the sky,
      // grouped by colour class and brightness so each group is a single fill
      const buckets = new Map()
      for (const s of sky.faint) {
        const [x, y, alt] = project(s.ra, s.dec)
        if (alt <= 0 || x < -4 || x > w + 4 || y < -4 || y > h + 4) continue
        const margin = st.limitMag - (s.mag + EXTINCTION * (airmass(alt) - 1))
        if (margin <= 0) continue
        const level = Math.min(9, Math.round(Math.min(0.92, 0.12 + margin * 0.21) * 10))
        const key = s.cls * 10 + level
        let list = buckets.get(key)
        if (!list) buckets.set(key, (list = []))
        list.push(x, y, (0.42 + Math.min(margin, 5) * 0.22) * scale)
      }
      for (const [key, list] of buckets) {
        bctx.fillStyle = `rgba(${CLASS_RGB[Math.floor(key / 10)]},${(key % 10) / 10})`
        bctx.beginPath()
        for (let i = 0; i < list.length; i += 3) {
          const x = list[i]
          const y = list[i + 1]
          const r = list[i + 2]
          // Sub-pixel stars look the same as squares and are much cheaper to fill
          if (r < 0.75) bctx.rect(x - r, y - r, r * 2, r * 2)
          else {
            bctx.moveTo(x + r, y)
            bctx.arc(x, y, r, 0, TAU)
          }
        }
        bctx.fill()
      }

      // Labels, placed once so the base and the star chart agree
      const labels = []
      bctx.font = `400 ${9 * scale}px "Geist Mono", monospace`
      if ('letterSpacing' in bctx) bctx.letterSpacing = '2px'
      const placed = []
      for (const l of sky.labels) {
        const [x, y, alt] = project(l.ra, l.dec)
        if (alt < 15 * D2R) continue
        const text = l.name.toUpperCase()
        let tw = labelWidths.get(text)
        if (tw === undefined) labelWidths.set(text, (tw = bctx.measureText(text).width + 16))
        const th = 18
        if (placed.some((b) => Math.abs(b.x - x) < (b.w + tw) / 2 && Math.abs(b.y - y) < (b.h + th) / 2)) continue
        placed.push({ x, y, w: tw, h: th })
        labels.push([text, x, y])
      }
      bctx.textAlign = 'center'
      bctx.textBaseline = 'middle'
      bctx.fillStyle = `rgba(176,190,230,${0.24 * dim})`
      for (const [text, x, y] of labels) bctx.fillText(text, x, y)
      if ('letterSpacing' in bctx) bctx.letterSpacing = '0px'

      const names = []
      const targets = []
      for (const n of sky.named) {
        const [x, y, alt] = project(n.ra, n.dec)
        if (alt < 3 * D2R || !visibleMag(n.mag, alt)) continue
        names.push([n.name, x, y, n.mag])
        targets.push({ x, y, name: n.name, info: `star · mag ${n.mag.toFixed(1)} · ${Math.round(alt / D2R)}° up` })
      }
      bctx.textAlign = 'left'
      bctx.font = `italic 400 ${13 * scale}px "EB Garamond", Georgia, serif`
      bctx.fillStyle = 'rgba(236,238,250,0.42)'
      for (const [name, x, y, mag] of names) if (mag <= 1) bctx.fillText(name, x + 9 * scale, y - 8 * scale)

      // Cache positions for the twinkle layer
      bright = []
      for (const s of sky.bright) {
        const [x, y, alt] = project(s.ra, s.dec)
        if (alt <= 0) continue
        const m = s.mag + EXTINCTION * (airmass(alt) - 1)
        const margin = st.limitMag - m
        // Stars within 25° of the horizon shine through more air, so they scintillate harder and in colour
        if (margin > 0) bright.push({ x, y, m, margin, rgb: s.rgb, rgbArr: s.rgbArr, seed: s.seed, low: clamp(1 - alt / (25 * D2R), 0, 1) })
      }
      planets = []
      for (const p of planetPositions(date)) {
        if (p.name === 'Mercury') continue
        const [x, y, alt] = project(p.ra, p.dec)
        if (alt > 0 && visibleMag(p.mag, alt)) {
          planets.push({ x, y, name: p.name })
          targets.push({ x, y, name: p.name, info: `planet · ${Math.round(alt / D2R)}° up` })
        }
      }
      bctx.fillStyle = 'rgba(255,234,200,0.56)'
      for (const p of planets) bctx.fillText(p.name, p.x + 10 * scale, p.y + 11 * scale)

      // The sun reddens near the horizon, where its light crosses the most atmosphere
      const redden = clamp(1 - sunAltDeg / 12, 0, 1)
      sun = sunAlt > -0.01 ? { x: sunX, y: sunY, colour: mix([255, 248, 232], [255, 146, 68], redden * redden).join(',') } : null
      if (sun) targets.push({ x: sunX, y: sunY, name: 'the Sun', info: `${Math.round(sunAltDeg)}° up · never look at it directly` })

      moon = null
      if (mAlt > 0) {
        const [mx, my] = place(mAlt, mAz)
        const [tra, tdec] = towards(mp.ra, mp.dec, sunEq.ra, sunEq.dec, 0.02)
        const [tAlt, tAz] = toHorizontal(tra, tdec, lst)
        const [tx, ty] = place(tAlt - 0.95 * D2R * Math.cos(tAlt), tAz)
        moon = { x: mx, y: my, angle: Math.atan2(ty - my, tx - mx), phase }
        targets.push({ x: mx, y: my, name: 'the Moon', info: `${phase.name} · ${Math.round(phase.illum * 100)}% lit · ${Math.round(mAlt / D2R)}° up` })
      }
      setSkyTargets(targets)

      // Star chart layer, revealed only around the star cursor (touch screens never see it)
      if (!finePointer) return
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      lctx.clearRect(0, 0, w, h)
      lctx.strokeStyle = 'rgba(210,218,245,0.22)'
      lctx.lineWidth = 1
      lctx.setLineDash([2, 6])
      lctx.beginPath()
      for (const a of [0, 30, 60]) {
        const r = R * Math.tan(((90 - a) * D2R) / 2)
        lctx.moveTo(cx + r, cy)
        lctx.arc(cx, cy, r, 0, TAU)
      }
      lctx.stroke()
      lctx.setLineDash([])
      lctx.fillStyle = 'rgba(210,218,245,0.5)'
      lctx.font = `400 ${8.5 * scale}px "Geist Mono", monospace`
      lctx.textAlign = 'left'
      lctx.textBaseline = 'alphabetic'
      for (const a of [30, 60]) lctx.fillText(`${a}° altitude`, cx + 6, cy - R * Math.tan(((90 - a) * D2R) / 2) - 6)
      lctx.fillText('zenith', cx + 8, cy - 6)
      lctx.beginPath()
      lctx.moveTo(cx - 5, cy); lctx.lineTo(cx + 5, cy)
      lctx.moveTo(cx, cy - 5); lctx.lineTo(cx, cy + 5)
      lctx.stroke()

      // The Sun's path across the sky over the 12 hours either side, with local hour marks
      const quarter = 15 * 60000
      const startMs = Math.floor(date.getTime() / quarter) * quarter
      lctx.strokeStyle = 'rgba(232,201,121,0.55)'
      lctx.fillStyle = 'rgba(232,201,121,0.85)'
      lctx.setLineDash([1, 5])
      lctx.lineCap = 'round'
      lctx.lineWidth = 1.4
      lctx.beginPath()
      let prevUp = false
      const hourMarks = []
      for (let k = -48; k <= 48; k++) {
        const d = new Date(startMs + k * quarter)
        const sp = sunPosition(d)
        const [alt, az] = toHorizontal(sp.ra, sp.dec, localSiderealDeg(d))
        if (alt <= 0) { prevUp = false; continue }
        const [x, y] = place(alt, az)
        if (prevUp) lctx.lineTo(x, y)
        else lctx.moveTo(x, y)
        prevUp = true
        if (d.getUTCMinutes() === 0) {
          const hour = Number(hourFmt.format(d))
          if (hour % 2 === 0) hourMarks.push([x, y, `${String(hour).padStart(2, '0')}:00`])
        }
      }
      lctx.stroke()
      lctx.setLineDash([])
      lctx.font = `400 ${8 * scale}px "Geist Mono", monospace`
      for (const [x, y, text] of hourMarks) {
        lctx.beginPath()
        lctx.arc(x, y, 2, 0, TAU)
        lctx.fill()
        lctx.fillText(text, x + 6, y - 5)
      }

      lctx.strokeStyle = `rgba(170,190,245,${0.6 * dim})`
      lctx.lineWidth = 1
      strokeSegments(lctx)

      lctx.textAlign = 'center'
      lctx.textBaseline = 'middle'
      lctx.font = `400 ${9.5 * scale}px "Geist Mono", monospace`
      if ('letterSpacing' in lctx) lctx.letterSpacing = '2px'
      lctx.fillStyle = `rgba(190,204,240,${0.85 * dim})`
      for (const [text, x, y] of labels) lctx.fillText(text, x, y)
      if ('letterSpacing' in lctx) lctx.letterSpacing = '0px'
      lctx.textAlign = 'left'
      lctx.font = `italic 400 ${13.5 * scale}px "EB Garamond", Georgia, serif`
      lctx.fillStyle = 'rgba(240,242,250,0.9)'
      for (const [name, x, y] of names) lctx.fillText(name, x + 9 * scale, y - 8 * scale)
      lctx.fillStyle = 'rgba(255,232,196,0.95)'
      for (const p of planets) lctx.fillText(p.name, p.x + 10 * scale, p.y + 11 * scale)
    }

    const drawSpark = (t) => {
      if (!w) return
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sctx.clearRect(0, 0, w, h)
      sctx.globalCompositeOperation = 'lighter'

      for (const s of bright) {
        const amp = 0.12 + 0.22 * s.low
        const flicker = reduce ? 1 : 1 + amp * (0.6 * Math.sin(t * 0.0021 + s.seed) + 0.4 * Math.sin(t * 0.0047 + s.seed * 1.7))
        const b = clamp((2.9 - s.m) / 4, 0, 1)
        const a = Math.min(1, (0.65 + b * 0.45) * flicker) * Math.min(1, s.margin / 2.2)
        const core = (1 + b * 1.75) * scale
        const glow = core * 6
        // Chromatic scintillation: low bright stars flash slightly different colours
        let fill = s.rgb
        if (s.low > 0.05 && !reduce) {
          const k = 0.24 * s.low * b
          const [r, g, bl] = s.rgbArr
          fill = `${Math.round(clamp(r * (1 + k * Math.sin(t * 0.011 + s.seed)), 0, 255))},${Math.round(clamp(g * (1 + k * Math.sin(t * 0.014 + s.seed * 1.3)), 0, 255))},${Math.round(clamp(bl * (1 + k * Math.sin(t * 0.017 + s.seed * 2.1)), 0, 255))}`
        }
        sctx.globalAlpha = 0.42 * a
        sctx.drawImage(glowSprite(s.rgb), s.x - glow, s.y - glow, glow * 2, glow * 2)
        sctx.globalAlpha = a
        sctx.fillStyle = `rgb(${fill})`
        sctx.beginPath()
        sctx.arc(s.x, s.y, core, 0, TAU)
        sctx.fill()
      }

      // Meteors: an occasional sporadic streak on a dark, mostly clear night
      // (real sporadic rates are a handful an hour; these come a little more often so visitors see one)
      if (!reduce && darkAmount > 0.6 && clouds.cover < 80) {
        if (!nextMeteorAt) nextMeteorAt = t + 6000 + Math.random() * 20000
        else if (t > nextMeteorAt) {
          const a = Math.random() * TAU
          const r = Math.sqrt(Math.random()) * Math.min(w, h) * 0.5
          meteors.push({
            x: w / 2 + Math.cos(a) * r * 1.5,
            y: h * 0.42 + Math.sin(a) * r,
            dir: Math.random() * TAU,
            len: (70 + Math.random() * 130) * scale,
            born: t,
            dur: 380 + Math.random() * 520,
          })
          nextMeteorAt = t + 20000 + Math.random() * 40000
        }
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const mt = meteors[i]
        const p = (t - mt.born) / mt.dur
        if (p >= 1) {
          meteors.splice(i, 1)
          continue
        }
        const dx = Math.cos(mt.dir)
        const dy = Math.sin(mt.dir)
        const hx = mt.x + dx * mt.len * 1.4 * p
        const hy = mt.y + dy * mt.len * 1.4 * p
        const tail = mt.len * Math.min(1, p * 3) * (1 - p * 0.4)
        const glowAmt = Math.sin(Math.PI * p)
        const streak = sctx.createLinearGradient(hx - dx * tail, hy - dy * tail, hx, hy)
        streak.addColorStop(0, 'rgba(210,230,255,0)')
        streak.addColorStop(1, `rgba(246,250,255,${0.85 * glowAmt})`)
        sctx.globalAlpha = 1
        sctx.strokeStyle = streak
        sctx.lineWidth = 1.2 * scale
        sctx.lineCap = 'round'
        sctx.beginPath()
        sctx.moveTo(hx - dx * tail, hy - dy * tail)
        sctx.lineTo(hx, hy)
        sctx.stroke()
      }

      // Planets shine steadily
      const planetGlow = glowSprite('255,238,210')
      for (const p of planets) {
        const g = 10 * scale
        sctx.globalAlpha = 0.52
        sctx.drawImage(planetGlow, p.x - g, p.y - g, g * 2, g * 2)
        sctx.globalAlpha = 0.95
        sctx.fillStyle = 'rgb(255,246,230)'
        sctx.beginPath()
        sctx.arc(p.x, p.y, 2.1 * scale, 0, TAU)
        sctx.fill()
      }
      sctx.globalAlpha = 1

      // The sun: a small bright disc inside the soft aureole that forward scattering makes around it
      if (sun) {
        const aureole = 150 * scale
        const g = sctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, aureole)
        g.addColorStop(0, `rgba(${sun.colour},0.55)`)
        g.addColorStop(0.06, `rgba(${sun.colour},0.32)`)
        g.addColorStop(0.28, `rgba(${sun.colour},0.07)`)
        g.addColorStop(1, `rgba(${sun.colour},0)`)
        sctx.fillStyle = g
        sctx.beginPath()
        sctx.arc(sun.x, sun.y, aureole, 0, TAU)
        sctx.fill()
        const disc = 7 * scale
        const d = sctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, disc)
        d.addColorStop(0, 'rgba(255,255,250,1)')
        d.addColorStop(0.65, `rgba(${sun.colour},0.95)`)
        d.addColorStop(1, `rgba(${sun.colour},0)`)
        sctx.fillStyle = d
        sctx.beginPath()
        sctx.arc(sun.x, sun.y, disc, 0, TAU)
        sctx.fill()
      }

      // Moon with its real phase, lit side towards the sun
      if (moon) {
        const mr = 9 * scale
        const illum = moon.phase.illum
        const halo = sctx.createRadialGradient(moon.x, moon.y, 0, moon.x, moon.y, mr * 8)
        halo.addColorStop(0, `rgba(236,240,255,${(0.06 + 0.22 * illum) * (1 - dayAmount * 0.7)})`)
        halo.addColorStop(1, 'rgba(236,240,255,0)')
        sctx.fillStyle = halo
        sctx.beginPath()
        sctx.arc(moon.x, moon.y, mr * 8, 0, TAU)
        sctx.fill()
        sctx.globalCompositeOperation = 'source-over'
        // Earthshine: sunlight reflected off Earth faintly lights the dark side, most visibly on a crescent
        const shine = 1 - illum
        sctx.fillStyle = `rgba(${Math.round(34 + 30 * shine)},${Math.round(40 + 32 * shine)},${Math.round(58 + 38 * shine)},${0.9 * (1 - dayAmount)})`
        sctx.beginPath()
        sctx.arc(moon.x, moon.y, mr, 0, TAU)
        sctx.fill()
        sctx.save()
        sctx.translate(moon.x, moon.y)
        sctx.rotate(moon.phase.waxing ? moon.angle : moon.angle + Math.PI)
        sctx.globalAlpha = 1 - dayAmount * 0.35
        const lit = sctx.createRadialGradient(-mr * 0.25, -mr * 0.25, 0, 0, 0, mr)
        lit.addColorStop(0, 'rgb(255,252,240)')
        lit.addColorStop(1, 'rgb(206,202,188)')
        sctx.fillStyle = lit
        sctx.fill(new Path2D(moonPath(moon.phase.fraction, mr)))
        sctx.restore()
      }
    }

    /* Clouds on their own low-resolution layer, drifting with the wind */
    const drawClouds = (t) => {
      const cw = cloudCanvas.width
      const ch = cloudCanvas.height
      if (!cw) return
      const dt = lastCloud ? Math.min(200, t - lastCloud) : 0
      lastCloud = t
      buildClouds(t)
      cctx.setTransform(1, 0, 0, 1, 0, 0)
      cctx.imageSmoothingEnabled = true
      cctx.imageSmoothingQuality = 'high'
      cctx.clearRect(0, 0, cw, ch)
      if (clouds.cover < 1 || !cloudLayers[0].pattern) return
      const tileBase = Math.max(w, h)
      for (let li = cloudLayers.length - 1; li >= 0; li--) {
        const layer = cloudLayers[li]
        const tile = tileBase * layer.scale
        if (!reduce) {
          layer.offset[0] += (clouds.vx * layer.speed * dt) / 1000
          layer.offset[1] += (clouds.vy * layer.speed * dt) / 1000
        }
        const k = tile / CLOUD_TEX / CLOUD_RES
        layer.pattern.setTransform(new DOMMatrix([
          k, 0, 0, k, mod(layer.offset[0], tile) / CLOUD_RES, mod(layer.offset[1], tile) / CLOUD_RES,
        ]))
        cctx.globalAlpha = clouds.alpha * layer.alpha
        cctx.fillStyle = layer.pattern
        cctx.fillRect(0, 0, cw, ch)
      }
      cctx.globalAlpha = 1
      // Sunrise and sunset light the clouds from below: warm facing the sun, rosy then cool further away
      if (clouds.tint > 0.01) {
        const tx = clouds.tx / CLOUD_RES
        const ty = clouds.ty / CLOUD_RES
        const g = cctx.createRadialGradient(tx, ty, 0, tx, ty, clouds.tr / CLOUD_RES)
        g.addColorStop(0, `rgba(255,120,64,${0.75 * clouds.tint})`)
        g.addColorStop(0.35, `rgba(255,158,110,${0.5 * clouds.tint})`)
        g.addColorStop(0.7, `rgba(232,150,170,${0.28 * clouds.tint})`)
        g.addColorStop(1, `rgba(120,110,160,${0.2 * clouds.tint})`)
        cctx.globalCompositeOperation = 'source-atop'
        cctx.fillStyle = g
        cctx.fillRect(0, 0, cw, ch)
        cctx.globalCompositeOperation = 'source-over'
      }
    }

    const loop = (t) => {
      raf = requestAnimationFrame(loop)
      const dt = t - last
      if (dt < 33) return
      last = t
      const target = getSkyOffset()
      if (Math.abs(target - shown) > 0.002) {
        // Longer jumps glide for longer: dragging stays responsive, a half-day jump takes about a second and a half
        const tau = Math.min(1000, GLIDE_MS + Math.abs(target - shown) * 90)
        shown += (target - shown) * (1 - Math.exp(-Math.min(dt, 100) / tau))
        if (Math.abs(target - shown) <= 0.002) shown = target
        drawBase(currentDate())
        setSkyShown(shown)
        settledDrawn = false
      } else if (!settledDrawn || t - lastBase > 60000) {
        shown = target
        drawBase(currentDate())
        setSkyShown(shown)
        lastBase = t
        settledDrawn = true
      }
      drawSpark(t)
      if (t - lastCloud >= CLOUD_FRAME_MS) drawClouds(t)
    }

    const render = () => {
      setup()
      drawBase(currentDate())
      drawSpark(performance.now())
      drawClouds(performance.now())
    }

    // The star catalogue loads separately so the page itself paints first
    import('../data/sky').then((data) => {
      if (!alive) return
      sky = prepare(data, new Date())
      render()
      setReady(true)
      // Lets the loading screen know the sky is drawn
      document.documentElement.dataset.skyReady = 'true'
      window.dispatchEvent(new Event('sky-ready'))
      if (!reduce) {
        setSkyDriven(true)
        raf = requestAnimationFrame(loop)
      }
    })

    // Weather arrives on its own schedule; clouds fade in once it does
    getWeather().then((data) => {
      if (!alive) return
      weather = data
      if (sky) {
        drawBase(currentDate())
        drawSpark(performance.now())
        cloudBuiltAt = 0
        drawClouds(performance.now())
      }
    })

    // Reduced motion: jump straight to the chosen time instead of gliding
    const unsubscribe = subscribeSkyOffset(() => {
      if (!reduce) return
      shown = getSkyOffset()
      drawBase(currentDate())
      drawSpark(0)
      cloudBuiltAt = 0
      drawClouds(performance.now())
    })

    let resizeTimer = 0
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        // Mobile toolbars fire resize while scrolling; only redraw when the canvas really changed
        if (base.clientWidth !== w || base.clientHeight !== h) render()
      }, 150)
    }
    window.addEventListener('resize', onResize)
    const refresh = reduce ? setInterval(() => { drawBase(currentDate()); drawSpark(0) }, 60000) : 0

    return () => {
      alive = false
      setSkyDriven(false)
      cancelAnimationFrame(raf)
      clearInterval(refresh)
      clearTimeout(resizeTimer)
      unsubscribe()
      window.removeEventListener('resize', onResize)
    }
  }, [reduce, finePointer])

  // The star cursor's light in the sky: a soft hole in the night veil and a window onto the star chart,
  // both centred exactly on the star (StarCursor publishes its position to the light store).
  // Everything moves with transforms and opacity only, so the browser composites it without repainting.
  useEffect(() => {
    if (!finePointer) return
    const hole = holeRef.current
    const top = veilTopRef.current
    const bottom = veilBottomRef.current
    const left = veilLeftRef.current
    const right = veilRightRef.current
    const lensWin = lensWinRef.current
    const lensCanvas = lensRef.current
    let W = window.innerWidth
    let H = window.innerHeight

    const sizePieces = () => {
      W = window.innerWidth
      H = window.innerHeight
      top.style.width = bottom.style.width = `${HOLE_D + 2}px`
      top.style.height = bottom.style.height = `${H + 2}px`
      left.style.width = right.style.width = `${W + HOLE_D + 2}px`
      left.style.height = right.style.height = `${2 * H + 2 * HOLE_D}px`
    }

    // The veil is four solid panels around one soft-edged hole
    const apply = () => {
      const light = getLight()
      const o = Math.max(0, light.open)
      // With no pointer the hole is closed; park it mid-screen so the panels still cover everything
      const x = light.x < -1000 ? W / 2 : light.x
      const y = light.y < -1000 ? H / 2 : light.y
      const d = HOLE_D * o
      const f = (v) => v.toFixed(2)
      hole.style.transform = `translate3d(${f(x - d / 2)}px,${f(y - d / 2)}px,0) scale(${o.toFixed(4)})`
      top.style.transform = `translate3d(${f(x - d / 2)}px,${f(y - d / 2 - H - 1)}px,0) scaleX(${o.toFixed(4)})`
      bottom.style.transform = `translate3d(${f(x - d / 2)}px,${f(y + d / 2 - 1)}px,0) scaleX(${o.toFixed(4)})`
      left.style.transform = `translate3d(${f(x - d / 2 - W - HOLE_D - 1)}px,${f(y - H - HOLE_D)}px,0)`
      right.style.transform = `translate3d(${f(x + d / 2 - 1)}px,${f(y - H - HOLE_D)}px,0)`
      lensWin.style.transform = `translate3d(${f(x - LENS_R)}px,${f(y - LENS_R)}px,0)`
      lensCanvas.style.transform = `translate3d(${f(LENS_R - x)}px,${f(LENS_R - y)}px,0)`
      lensWin.style.opacity = Math.min(1, o).toFixed(3)
    }

    sizePieces()
    apply()
    const unsubscribe = subscribeLight(apply)
    const onResize = () => {
      sizePieces()
      apply()
    }
    window.addEventListener('resize', onResize)
    return () => {
      unsubscribe()
      window.removeEventListener('resize', onResize)
    }
  }, [finePointer])

  const layer = `${styles.canvas} ${ready ? styles.ready : ''}`

  return (
    <div className={styles.backdrop} data-sky-backdrop aria-hidden="true">
      <canvas ref={baseRef} className={layer} />
      <canvas ref={sparkRef} className={layer} />
      <canvas ref={cloudRef} className={layer} />
      <motion.div
        className={`${styles.veil} ${finePointer ? '' : styles.veilSolid}`}
        style={{ opacity: home ? veilOnScroll : 0.66 }}
      >
        {finePointer && (
          <>
            <div ref={holeRef} className={styles.hole} />
            <div ref={veilTopRef} className={styles.piece} />
            <div ref={veilBottomRef} className={styles.piece} />
            <div ref={veilLeftRef} className={styles.piece} />
            <div ref={veilRightRef} className={styles.piece} />
          </>
        )}
      </motion.div>
      <div ref={lensWinRef} className={`${styles.lensWindow} ${finePointer ? '' : styles.hidden}`}>
        <canvas ref={lensRef} className={`${styles.lensCanvas} ${ready ? styles.ready : ''}`} />
      </div>
    </div>
  )
}
