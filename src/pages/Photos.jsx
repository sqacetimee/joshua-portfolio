import styles from './Photos.module.css'

// To add real photos:
// 1. Put images in public/photos/ (e.g. public/photos/1.jpg)
// 2. Replace the placeholder divs with:
//    <img src="/photos/1.jpg" alt="description" />

const PHOTOS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export default function Photos() {
  return (
    <div className={styles.page}>
      <h2 className={styles.pageTitle}>Photos</h2>
      <p className={styles.hint}>
        Add images to <code>public/photos/</code> and update this page.
      </p>

      <div className={styles.grid}>
        {PHOTOS.map(n => (
          <div key={n} className={styles.slot}>
            {/* swap with: <img src={`/photos/${n}.jpg`} alt="" /> */}
            <div className={styles.placeholder}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/>
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
