import { useState } from 'react'
import styles from './Resume.module.css'

export default function Resume() {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className={styles.wrap}>
      <div className={styles.actions}>
        <a href="/resume.pdf" download className={styles.btn}>↓ download</a>
        <a href="/resume.pdf" target="_blank" rel="noreferrer" className={styles.btn}>↗ open</a>
      </div>

      <div className={styles.iframeWrap}>
        {!loaded && <div className={styles.pdfLoader}>loading…</div>}
        <iframe
          src="/resume.pdf"
          title="Resume"
          className={styles.iframe}
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
        />
      </div>

      <div className={styles.mobileFallback}>
        <span className={styles.sadFace}>:(</span>
        <p className={styles.mobileText}>
          PDF preview isn't supported on mobile browsers.
        </p>
        <div className={styles.mobileLinks}>
          <a href="/resume.pdf" target="_blank" rel="noreferrer" className={styles.mobileFallbackLink}>
            ↗ open resume pdf
          </a>
          <a href="/resume.pdf" download className={styles.mobileFallbackLink}>
            ↓ download
          </a>
        </div>
      </div>
    </div>
  )
}
