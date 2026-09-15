// Distance fields of the page titles' actual letters, so the star's light can bend around the letter shapes
// rather than around a box. Each title is drawn word by word into a small canvas at the exact positions
// the browser laid its words out, in the same font. An exact Euclidean distance transform turns the
// letters into signed distances, and all titles are packed into one texture atlas for the light shader.

export const TITLE_PAD = 36 // how far (CSS px) the distance field reaches around the letters
const ATLAS_WIDTH = 1024
const SCALE = 0.75 // texels per CSS pixel
const INF = 1e20

// One dimension of the Felzenszwalb and Huttenlocher distance transform
function edt1d(f, n, d, v, z) {
  let k = 0
  v[0] = 0
  z[0] = -INF
  z[1] = INF
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
  }
}

// Squared distance from every texel to the nearest texel whose mask value is `feature`
function distanceTransform(mask, w, h, feature) {
  const grid = new Float64Array(w * h)
  for (let i = 0; i < grid.length; i++) grid[i] = mask[i] === feature ? 0 : INF
  const size = Math.max(w, h)
  const f = new Float64Array(size)
  const d = new Float64Array(size)
  const v = new Int32Array(size)
  const z = new Float64Array(size + 1)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x]
    edt1d(f, h, d, v, z)
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y]
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x]
    edt1d(f, w, d, v, z)
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x]
  }
  return grid
}

function buildGlyphs(el, range) {
  range.selectNodeContents(el)
  const box = range.getBoundingClientRect()
  if (box.width < 4 || box.height < 4) return null
  const elRect = el.getBoundingClientRect()
  const fullW = box.width + 2 * TITLE_PAD
  const fullH = box.height + 2 * TITLE_PAD
  const scale = Math.min(SCALE, (ATLAS_WIDTH - 4) / fullW)
  const w = Math.ceil(fullW * scale)
  const h = Math.ceil(fullH * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const cs = getComputedStyle(el)
  ctx.scale(scale, scale)
  ctx.translate(TITLE_PAD - box.left, TITLE_PAD - box.top)
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  if ('letterSpacing' in ctx && cs.letterSpacing !== 'normal') ctx.letterSpacing = cs.letterSpacing
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'alphabetic'

  // Draw each word where the browser actually placed it, so wrapping and spacing match exactly
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const match of node.data.matchAll(/\S+/g)) {
      range.setStart(node, match.index)
      range.setEnd(node, match.index + match[0].length)
      const r = range.getBoundingClientRect()
      if (!r.width) continue
      const m = ctx.measureText(match[0])
      const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent
      const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent
      const baseline = r.top + (r.height - (ascent + descent)) / 2 + ascent
      ctx.save()
      ctx.translate(r.left, baseline)
      if (m.width > 0) ctx.scale(r.width / m.width, 1)
      ctx.fillText(match[0], 0, 0)
      ctx.restore()
    }
  }

  const pixels = ctx.getImageData(0, 0, w, h).data
  const inside = new Uint8Array(w * h)
  for (let i = 0; i < inside.length; i++) inside[i] = pixels[i * 4 + 3] > 127 ? 1 : 0
  const toInside = distanceTransform(inside, w, h, 1)
  const toOutside = distanceTransform(inside, w, h, 0)
  const sdf = new Uint8Array(w * h)
  for (let i = 0; i < sdf.length; i++) {
    const texels = inside[i] ? -(Math.sqrt(toOutside[i]) - 0.5) : Math.sqrt(toInside[i]) - 0.5
    const px = texels / scale
    sdf[i] = Math.max(0, Math.min(255, Math.round((0.5 + px / (2 * TITLE_PAD)) * 255)))
  }
  return { el, sdf, w, h, dx: box.left - elRect.left, dy: box.top - elRect.top, bw: box.width, bh: box.height }
}

/* Build the atlas for a list of title elements. Returns the texture data and, for each title, where its
   letters sit relative to the element and which part of the atlas holds them. */
export function buildTitleAtlas(elements) {
  const range = document.createRange()
  const glyphs = elements.map((el) => buildGlyphs(el, range)).filter(Boolean)
  let x = 0
  let y = 0
  let rowH = 0
  for (const g of glyphs) {
    if (x + g.w + 2 > ATLAS_WIDTH) {
      x = 0
      y += rowH + 2
      rowH = 0
    }
    g.ax = x
    g.ay = y
    x += g.w + 2
    rowH = Math.max(rowH, g.h)
  }
  const width = ATLAS_WIDTH
  const height = Math.max(1, y + rowH)
  const data = new Uint8Array(width * height).fill(255)
  for (const g of glyphs) {
    for (let row = 0; row < g.h; row++) data.set(g.sdf.subarray(row * g.w, (row + 1) * g.w), (g.ay + row) * width + g.ax)
  }
  const entries = glyphs.map((g) => ({
    el: g.el,
    dx: g.dx,
    dy: g.dy,
    w: g.bw,
    h: g.bh,
    uv: [(g.ax + 0.5) / width, (g.ay + 0.5) / height, (g.ax + g.w - 0.5) / width, (g.ay + g.h - 0.5) / height],
  }))
  return { data, width, height, entries }
}
