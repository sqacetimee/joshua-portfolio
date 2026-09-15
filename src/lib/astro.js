// Astronomy helpers for the live sky chart and the "right now" panel.
// Sources: IAU mean sidereal time approximation; USNO low-precision Sun;
// Astronomical Almanac low-precision Moon (about 0.3 deg); JPL "Approximate Positions
// of the Planets", Table 1 (valid 1800 to 2050); Kasten and Young (1989) airmass;
// Ballesteros (2012) B-V to temperature.

export const WATERLOO = { lat: 43.4723, lon: -80.5449 }
export const D2R = Math.PI / 180
const R2D = 180 / Math.PI
const norm360 = (d) => ((d % 360) + 360) % 360

export const daysSinceJ2000 = (date) => date.getTime() / 86400000 + 2440587.5 - 2451545.0

export function localSiderealDeg(date, lon = WATERLOO.lon) {
  return norm360(280.46061837 + 360.98564736629 * daysSinceJ2000(date) + lon)
}

/* Right ascension / declination (deg) to [altitude, azimuth] in radians, azimuth from north through east */
export function toHorizontal(ra, dec, lst, lat = WATERLOO.lat) {
  const ha = (lst - ra) * D2R
  const d = dec * D2R
  const l = lat * D2R
  const alt = Math.asin(Math.sin(d) * Math.sin(l) + Math.cos(d) * Math.cos(l) * Math.cos(ha))
  const az = Math.atan2(
    -Math.cos(d) * Math.sin(ha),
    Math.sin(d) * Math.cos(l) - Math.cos(d) * Math.cos(ha) * Math.sin(l),
  )
  return [alt, az]
}

const obliquity = (d) => (23.439291 - 0.0000003563 * d) * D2R

export function eclipticToEquatorial(lonDeg, latDeg, d) {
  const e = obliquity(d)
  const l = lonDeg * D2R
  const b = latDeg * D2R
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l))
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l))
  return [norm360(ra * R2D), dec * R2D]
}

export function sunPosition(date) {
  const d = daysSinceJ2000(date)
  const g = (357.529 + 0.98560028 * d) * D2R
  const q = 280.459 + 0.98564736 * d
  const lambda = norm360(q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g))
  const [ra, dec] = eclipticToEquatorial(lambda, 0, d)
  return { ra, dec, lambda }
}

export function sunAltitudeDeg(date) {
  const s = sunPosition(date)
  return toHorizontal(s.ra, s.dec, localSiderealDeg(date))[0] * R2D
}

export function moonPosition(date) {
  const d = daysSinceJ2000(date)
  const T = d / 36525
  const s = (x) => Math.sin(x * D2R)
  const lambda = norm360(
    218.32 + 481267.881 * T
    + 6.29 * s(135.0 + 477198.87 * T) - 1.27 * s(259.3 - 413335.36 * T)
    + 0.66 * s(235.7 + 890534.22 * T) + 0.21 * s(269.9 + 954397.74 * T)
    - 0.19 * s(357.5 + 35999.05 * T) - 0.11 * s(186.5 + 966404.03 * T),
  )
  const beta = 5.13 * s(93.3 + 483202.02 * T) + 0.28 * s(228.2 + 960400.89 * T)
    - 0.28 * s(318.3 + 6003.15 * T) - 0.17 * s(217.6 - 407332.21 * T)
  const [ra, dec] = eclipticToEquatorial(lambda, beta, d)
  return { ra, dec, lambda, beta }
}

const PHASES = ['new moon', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full moon', 'waning gibbous', 'last quarter', 'waning crescent']

/* Phase from the Sun-Moon elongation */
export function moonPhase(date) {
  const elong = norm360(moonPosition(date).lambda - sunPosition(date).lambda)
  const fraction = elong / 360
  return {
    fraction,
    illum: (1 - Math.cos(elong * D2R)) / 2,
    waxing: elong < 180,
    name: PHASES[Math.floor(fraction * 8 + 0.5) % 8],
  }
}

/* SVG path of the lit part of the moon, lit side towards +x while waxing */
export function moonPath(fraction, R = 8) {
  const k = Math.cos(2 * Math.PI * fraction)
  const waxing = fraction < 0.5
  const rx = Math.abs(k) * R
  const outer = waxing ? 1 : 0
  const inner = (k > 0) === waxing ? 0 : 1
  return `M0 ${-R} A${R} ${R} 0 0 ${outer} 0 ${R} A${rx} ${R} 0 0 ${inner} 0 ${-R} Z`
}

/* Point a fraction t of the way along the great circle between two sky positions */
export function towards(ra1, dec1, ra2, dec2, t) {
  const vec = (ra, dec) => [Math.cos(dec * D2R) * Math.cos(ra * D2R), Math.cos(dec * D2R) * Math.sin(ra * D2R), Math.sin(dec * D2R)]
  const a = vec(ra1, dec1)
  const b = vec(ra2, dec2)
  const x = a[0] * (1 - t) + b[0] * t
  const y = a[1] * (1 - t) + b[1] * t
  const z = a[2] * (1 - t) + b[2] * t
  return [norm360(Math.atan2(y, x) * R2D), Math.asin(z / Math.hypot(x, y, z)) * R2D]
}

// a, e, I, L, long.peri, long.node with rates per Julian century (JPL Table 1)
const EARTH = [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0]
const PLANETS = [
  { name: 'Mercury', mag: 0.0, el: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081] },
  { name: 'Venus', mag: -4.2, el: [0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418] },
  { name: 'Mars', mag: 0.8, el: [1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343] },
  { name: 'Jupiter', mag: -2.3, el: [5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106] },
  { name: 'Saturn', mag: 0.6, el: [9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794] },
]

function heliocentric(el, T) {
  const a = el[0] + el[1] * T
  const e = el[2] + el[3] * T
  const I = (el[4] + el[5] * T) * D2R
  const L = el[6] + el[7] * T
  const peri = el[8] + el[9] * T
  const node = el[10] + el[11] * T
  const w = (peri - node) * D2R
  const O = node * D2R
  const M = ((((L - peri) % 360) + 540) % 360 - 180) * D2R
  let E = M + e * Math.sin(M)
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
  const xp = a * (Math.cos(E) - e)
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I)
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ]
}

/* Precess J2000 right ascension / declination (deg) to the equinox of date (IAU 1976, as in Meeus ch. 21) */
export function precessFromJ2000(ra, dec, date) {
  const t = daysSinceJ2000(date) / 36525
  const arcsec = D2R / 3600
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t ** 3) * arcsec
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t ** 3) * arcsec
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t ** 3) * arcsec
  const a0 = ra * D2R + zeta
  const d0 = dec * D2R
  const A = Math.cos(d0) * Math.sin(a0)
  const B = Math.cos(theta) * Math.cos(d0) * Math.cos(a0) - Math.sin(theta) * Math.sin(d0)
  const C = Math.sin(theta) * Math.cos(d0) * Math.cos(a0) + Math.cos(theta) * Math.sin(d0)
  return [norm360((Math.atan2(A, B) + z) * R2D), Math.asin(C) * R2D]
}

export function planetPositions(date) {
  const d = daysSinceJ2000(date)
  const T = d / 36525
  const earth = heliocentric(EARTH, T)
  return PLANETS.map(({ name, mag, el }) => {
    const p = heliocentric(el, T)
    const dx = p[0] - earth[0]
    const dy = p[1] - earth[1]
    const dz = p[2] - earth[2]
    // JPL elements use the J2000 ecliptic: convert with the J2000 obliquity, then precess to date
    const [ra0, dec0] = eclipticToEquatorial(norm360(Math.atan2(dy, dx) * R2D), Math.atan2(dz, Math.hypot(dx, dy)) * R2D, 0)
    const [ra, dec] = precessFromJ2000(ra0, dec0, date)
    return { name, mag, ra, dec }
  })
}

/* Next sunrise and sunset (standard -0.833 deg horizon) within the coming 36 hours */
export function nextSunEvents(date) {
  const f = (ms) => sunAltitudeDeg(new Date(ms)) + 0.833
  const step = 4 * 60000
  let t0 = date.getTime()
  let v0 = f(t0)
  const out = {}
  for (let i = 1; i <= 540 && !(out.rise && out.set); i++) {
    const t1 = date.getTime() + i * step
    const v1 = f(t1)
    if (v0 < 0 && v1 >= 0 && !out.rise) out.rise = new Date(t0 + (t1 - t0) * (-v0 / (v1 - v0)))
    if (v0 >= 0 && v1 < 0 && !out.set) out.set = new Date(t0 + (t1 - t0) * (v0 / (v0 - v1)))
    t0 = t1
    v0 = v1
  }
  return out
}

/* Relative path length through the atmosphere */
export function airmass(altRad) {
  const h = Math.max(altRad * R2D, -0.5)
  return 1 / (Math.sin(h * D2R) + 0.50572 * Math.pow(h + 6.07995, -1.6364))
}

/* Star colour from its B-V colour index, softened because naked-eye colours are subtle */
export function bvToRgb(bvIn) {
  const bv = Math.min(2, Math.max(-0.4, Number.isFinite(bvIn) ? bvIn : 0.6))
  const temp = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))
  const k = temp / 100
  let r, g, b
  if (k <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(k) - 161.1195681661
    b = k <= 19 ? 0 : 138.5177312231 * Math.log(k - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(k - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(k - 60, -0.0755148492)
    b = 255
  }
  const soft = (c) => Math.round(Math.min(255, Math.max(0, c)) * 0.72 + 255 * 0.28)
  return [soft(r), soft(g), soft(b)]
}
