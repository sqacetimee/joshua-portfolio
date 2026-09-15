import { useEffect } from 'react'
import { getLight, subscribeLight } from '../lib/light'

const FALLOFF_PX = 150 // distance at which the light on a card has dropped to half
const CUTOFF = 0.015

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/* Lights every [data-light] card from the cursor flashlight.
   Intensity follows a softened inverse-square falloff from the nearest point on the card, so the edge
   closest to the light glows first and the glow wraps around the corners as the light gets nearer.
   The card receives: --li (intensity), --lx/--ly (light position in its own box), --tx/--ty (a unit
   vector towards the light, scaled by intensity) for the spill of light and the shadow it casts.

   Card positions are measured once and kept in page coordinates, then re-measured only when something
   moves them (resize, a card changing size, cards being added). Reading layout every frame while the
   page is also restyling would force the browser to recalculate layout on every frame. */
export default function LightRig() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let raf = 0
    let cards = []
    let dirty = true
    const lit = new WeakMap()
    const observed = new WeakSet()

    const resizeObserver = new ResizeObserver(() => { dirty = true; schedule() })

    const measure = () => {
      dirty = false
      const sx = window.scrollX
      const sy = window.scrollY
      cards = [...document.querySelectorAll('[data-light]')].map((el) => {
        if (!observed.has(el)) {
          resizeObserver.observe(el)
          observed.add(el)
        }
        const r = el.getBoundingClientRect()
        return { el, left: r.left + sx, top: r.top + sy, width: r.width, height: r.height }
      })
    }

    const update = () => {
      raf = 0
      if (dirty) measure()
      const { x, y, open } = getLight()
      const sx = window.scrollX
      const sy = window.scrollY
      const W = window.innerWidth
      const H = window.innerHeight
      for (const card of cards) {
        const { el, width, height } = card
        const left = card.left - sx
        const top = card.top - sy
        const offscreen = top + height < -300 || top > H + 300 || left + width < -300 || left > W + 300
        const px = clamp(x, left, left + width)
        const py = clamp(y, top, top + height)
        const li = offscreen ? 0 : open / (1 + (Math.hypot(x - px, y - py) / FALLOFF_PX) ** 2)
        if (li < CUTOFF) {
          if (lit.get(el)) {
            el.style.setProperty('--li', '0')
            lit.set(el, 0)
          }
          continue
        }
        const dx = x - (left + width / 2)
        const dy = y - (top + height / 2)
        const len = Math.hypot(dx, dy) || 1
        el.style.setProperty('--li', li.toFixed(3))
        el.style.setProperty('--lx', `${(x - left).toFixed(1)}px`)
        el.style.setProperty('--ly', `${(y - top).toFixed(1)}px`)
        el.style.setProperty('--tx', `${((dx / len) * 16 * li).toFixed(2)}px`)
        el.style.setProperty('--ty', `${((dy / len) * 16 * li).toFixed(2)}px`)
        lit.set(el, li)
      }
    }

    function schedule() {
      if (!raf) raf = requestAnimationFrame(update)
    }

    // New pages and lazily revealed cards: re-measure when the page's content changes
    const mutationObserver = new MutationObserver(() => { dirty = true; schedule() })
    mutationObserver.observe(document.querySelector('main') || document.body, { childList: true, subtree: true })
    // Cards are measured while the opening scales the site, so measure again once it ends
    mutationObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-intro'] })
    const onResize = () => { dirty = true; schedule() }

    const unsubscribe = subscribeLight(schedule)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      unsubscribe()
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return null
}
