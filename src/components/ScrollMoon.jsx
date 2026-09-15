import { useEffect, useRef } from 'react'
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from 'motion/react'
import { moonPath } from '../lib/astro'
import styles from './ScrollMoon.module.css'

const TRACK = 150

/* Scroll progress as a Moon moving down a hairline, waxing from new to full as you read.
   On narrow screens it becomes a single hairline across the top. */
export default function ScrollMoon() {
  const rootRef = useRef(null)
  const litRef = useRef(null)
  const pctRef = useRef(null)
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 170, damping: 32, restDelta: 0.0005 })
  const moonY = useTransform(progress, (v) => v * TRACK)

  useMotionValueEvent(progress, 'change', (v) => {
    const p = Math.min(1, Math.max(0, v))
    litRef.current.setAttribute('d', moonPath(Math.min(0.4999, Math.max(0.0001, p * 0.5)), 4.4))
    pctRef.current.textContent = String(Math.round(p * 100)).padStart(2, '0')
  })

  // Only show on pages long enough to scroll
  useEffect(() => {
    const check = () => {
      rootRef.current.dataset.active = String(document.documentElement.scrollHeight > window.innerHeight + 80)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(document.body)
    window.addEventListener('resize', check)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [])

  return (
    <div ref={rootRef} className={styles.root} data-active="false" aria-hidden="true">
      <div className={styles.rail}>
        <div className={styles.track}>
          <motion.div className={styles.fill} style={{ scaleY: progress }} />
          <motion.div className={styles.moon} style={{ y: moonY }}>
            <svg viewBox="-6 -6 12 12" width="12" height="12">
              <circle r="4.4" className={styles.disc} />
              <path ref={litRef} className={styles.lit} d="" />
            </svg>
          </motion.div>
        </div>
        <span className={styles.pct}><span ref={pctRef}>00</span>%</span>
      </div>
      <motion.div className={styles.bar} style={{ scaleX: progress }} />
    </div>
  )
}
