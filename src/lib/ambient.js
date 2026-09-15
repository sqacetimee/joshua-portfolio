// Background music for the whole site.
// The entry screen starts it from the beginning when the visitor clicks in (startMusic), so the browser always
// allows the sound and the loading screen can open the site on the song's beat drop. Any later first click,
// tap or key press also starts it, if it isn't already playing.
// The toggle in the nav turns it off (remembered), and photo songs duck it while they play.
const SRC = '/music/good-looking-instrumental.mp3'
const STORAGE_KEY = 'jj-music'
const VOLUME = 0.3

let audio = null
let fadeRaf = 0
let started = false
let ducks = 0
let canFade = true
let state = { available: false, enabled: true, playing: false, blocked: false }
try { state.enabled = localStorage.getItem(STORAGE_KEY) !== 'off' } catch { /* storage blocked */ }

const listeners = new Set()
const emit = (patch) => {
  state = { ...state, ...patch }
  listeners.forEach((fn) => fn())
}

export const getAmbient = () => state

/* Where the song is, in seconds, while it is actually playing; null otherwise */
export const getMusicTime = () => (audio && !audio.paused && state.playing ? audio.currentTime : null)

export function subscribeAmbient(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function fadeTo(target, ms, done) {
  cancelAnimationFrame(fadeRaf)
  // iOS ignores audio.volume, so there the music simply starts and stops
  if (!canFade) { done?.(); return }
  const from = audio.volume
  const start = performance.now()
  const step = (now) => {
    const p = Math.min(1, (now - start) / ms)
    const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    audio.volume = Math.max(0, Math.min(1, from + (target - from) * eased))
    if (p < 1) fadeRaf = requestAnimationFrame(step)
    else done?.()
  }
  fadeRaf = requestAnimationFrame(step)
}

const wanted = () => state.available && state.enabled && started && ducks === 0 && !document.hidden

function update() {
  if (!audio || !state.available) return
  if (wanted()) {
    if (audio.paused) {
      if (canFade) audio.volume = 0
      audio.play().then(() => {
        emit({ playing: true, blocked: false })
        fadeTo(VOLUME, 1400)
      }).catch(() => {
        // Blocked until the visitor interacts: wait for the first click, tap or key press
        started = false
        emit({ playing: false, blocked: true })
      })
    } else {
      emit({ playing: true, blocked: false })
      fadeTo(VOLUME, 1400)
    }
  } else if (!audio.paused) {
    emit({ playing: false })
    fadeTo(0, ducks > 0 ? 500 : 900, () => {
      if (!wanted()) audio.pause()
    })
  }
}

// Play from the start inside the visitor's click, even if the track hasn't finished loading yet;
// it fades in once it is ready
function playNow() {
  started = true
  if (state.available) {
    update()
  } else if (audio.paused) {
    if (canFade) audio.volume = 0
    audio.play().catch(() => {})
  }
}

export function initAmbient() {
  if (audio) return
  audio = new Audio()
  audio.loop = true
  audio.preload = 'auto'
  try {
    audio.volume = 0.5
    canFade = audio.volume === 0.5
    audio.volume = 1
  } catch {
    canFade = false
  }
  // The toggle only appears once the track is known to exist and decode
  audio.addEventListener('loadedmetadata', () => { emit({ available: true }); update() }, { once: true })
  audio.addEventListener('error', () => emit({ available: false, playing: false, blocked: false }))
  audio.src = SRC

  const begin = (e) => {
    // The entry screen starts the song itself, in time with its click
    if (document.documentElement.dataset.intro === 'start') return
    // A first click on the toggle itself is handled by the toggle, so it can turn music off without a blip
    if (e.target instanceof Element && e.target.closest('[data-music-toggle]')) return
    if (state.playing || !state.enabled || started) return
    playNow()
  }
  window.addEventListener('pointerdown', begin, { passive: true })
  window.addEventListener('keydown', begin)
  document.addEventListener('visibilitychange', update)
}

/* Start the song from the beginning. Call it from a click or key press, so the browser allows the sound */
export function startMusic() {
  if (!audio || !state.enabled || state.playing) return
  try { audio.currentTime = 0 } catch { /* not seekable yet; it is at the start anyway */ }
  playNow()
}

export function setMusicEnabled(on) {
  started = true
  emit({ enabled: on })
  try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off') } catch { /* storage blocked */ }
  update()
}

/* Lower the music to silence while something else plays; calls must be balanced */
export function duckMusic(on) {
  ducks = Math.max(0, ducks + (on ? 1 : -1))
  update()
}
