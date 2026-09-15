import { motion, useReducedMotion } from 'motion/react'

export const EASE = [0.22, 1, 0.36, 1]

/* Page wrapper: a quick crossfade between routes (short exit so navigation feels instant). */
export function Page({ children, className }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.35, ease: EASE } }}
      exit={{ opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
    >
      {children}
    </motion.div>
  )
}

/* Fades content in once as it scrolls into view. */
export function Reveal({ children, className, as = 'div', delay = 0, ...rest }) {
  const reduce = useReducedMotion()
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -6% 0px' }}
      transition={{ duration: 0.65, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/* Children marked <Item> fade in one after another. */
export function Stagger({ children, className, as = 'div', stagger = 0.06, delay = 0, inView = false }) {
  const Tag = motion[as]
  const trigger = inView
    ? { whileInView: 'show', viewport: { once: true, margin: '0px 0px -6% 0px' } }
    : { animate: 'show' }
  return (
    <Tag
      className={className}
      initial="hidden"
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      {...trigger}
    >
      {children}
    </Tag>
  )
}

export function Item({ children, className, as = 'div', ...rest }) {
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
