import { useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import styles from './Tilt.module.css'

/* Card that tilts in 3D towards the cursor and grows slightly (`lift`). The star cursor travels behind
   these cards, so no light falls on their surface; LightRig gives them a rim where the light escapes
   around their edges, and a soft spill and shadow around them. */
export default function Tilt({ as: Tag = 'div', className = '', max = 7, lift = 1, style, children, ...rest }) {
  const ref = useRef(null)
  const frame = useRef(0)
  const reduce = useReducedMotion()

  const onPointerMove = (e) => {
    if (reduce || e.pointerType !== 'mouse') return
    const el = ref.current
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty('--rx', `${((0.5 - y) * max).toFixed(2)}deg`)
      el.style.setProperty('--ry', `${((x - 0.5) * max).toFixed(2)}deg`)
      el.dataset.hover = 'true'
    })
  }

  const onPointerLeave = () => {
    const el = ref.current
    cancelAnimationFrame(frame.current)
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    el.dataset.hover = 'false'
  }

  return (
    <Tag
      ref={ref}
      className={`${styles.tilt} ${className}`}
      style={{ '--lift': lift, ...style }}
      data-light=""
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      {...rest}
    >
      {children}
      <span className={styles.rim} aria-hidden="true" />
    </Tag>
  )
}
