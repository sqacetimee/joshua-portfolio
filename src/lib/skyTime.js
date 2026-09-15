// Shared sky time, in hours from now.
// `offset` is where the Home slider points; `shown` is where the backdrop currently is
// while it glides towards that offset. Readouts follow `shown` so they move with the sky.
let offset = 0
let shown = 0
let driven = false
const offsetListeners = new Set()
const shownListeners = new Set()

export const getSkyOffset = () => offset
export const getSkyShown = () => shown

export function setSkyOffset(hours) {
  offset = hours
  offsetListeners.forEach((fn) => fn())
  // Without an animating backdrop there is no glide, so the readout jumps straight there
  if (!driven) setSkyShown(hours)
}

export function setSkyShown(hours) {
  if (hours === shown) return
  shown = hours
  shownListeners.forEach((fn) => fn())
}

export const setSkyDriven = (value) => { driven = value }

export function subscribeSkyOffset(fn) {
  offsetListeners.add(fn)
  return () => offsetListeners.delete(fn)
}

export function subscribeSkyShown(fn) {
  shownListeners.add(fn)
  return () => shownListeners.delete(fn)
}
