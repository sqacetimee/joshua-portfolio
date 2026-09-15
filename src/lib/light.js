// Where the star cursor is, shared so the sky's flashlight and the cards on the page can react to it.
// `open` runs from 0 (no light, e.g. pointer outside the window) to 1.
let light = { x: -9999, y: -9999, open: 0 }
const listeners = new Set()

export const getLight = () => light

export function setLight(x, y, open) {
  if (x === light.x && y === light.y && open === light.open) return
  light = { x, y, open }
  listeners.forEach((fn) => fn())
}

export function subscribeLight(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Stars, planets, the Sun and the Moon currently on screen, so the cursor can lock onto them
let skyTargets = []
const targetListeners = new Set()

export const getSkyTargets = () => skyTargets

export function setSkyTargets(list) {
  skyTargets = list
  targetListeners.forEach((fn) => fn())
}

export function subscribeSkyTargets(fn) {
  targetListeners.add(fn)
  return () => targetListeners.delete(fn)
}
