import { Reveal } from './Motion'
import styles from './Section.module.css'

/* Atlas-style row: a small catalogue label on the left, content on the right. */
export default function Section({ label, meta, id, wide = false, children }) {
  return (
    <section id={id} className={styles.section}>
      <Reveal className={styles.label}>
        <span>{label}</span>
        {meta && <span className={styles.meta}>{meta}</span>}
      </Reveal>
      <div className={`${styles.body} ${wide ? styles.wide : ''}`}>{children}</div>
    </section>
  )
}
