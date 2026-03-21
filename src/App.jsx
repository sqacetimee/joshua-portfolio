import { useState, useEffect } from 'react'

const SITE_URL = 'joshuajennings.ca'

const PiIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="50 50 420 390" width="16" height="16" fill="currentColor" aria-hidden="true">
    <rect x="60" y="60" width="380" height="52" rx="10" ry="10" />
    <rect x="148" y="112" width="48" height="260" rx="8" ry="8" />
    <rect x="114" y="352" width="116" height="36" rx="8" ry="8" />
    <path d="M 304,112 C 304,112 316,112 328,112 C 340,112 352,120 352,132 L 352,300 C 352,340 364,370 390,392 C 408,408 428,414 440,406 C 452,398 454,382 444,368 C 436,357 424,352 416,344 C 396,324 388,296 388,260 L 388,132 C 388,120 376,112 364,112 Z"/>
  </svg>
)
import { Routes, Route, NavLink } from 'react-router-dom'
import Logo from './components/Logo'
import Home from './pages/Home'
import Projects from './pages/Projects'
import Photos from './pages/Photos'
import Resume from './pages/Resume'
import NotFound from './pages/NotFound'
import styles from './App.module.css'

const SunIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="4.5"/>
    <line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/>
    <line x1="4.22" y1="4.22" x2="5.86" y2="5.86"/><line x1="18.14" y1="18.14" x2="19.78" y2="19.78"/>
    <line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.86" y2="18.14"/><line x1="18.14" y1="5.86" x2="19.78" y2="4.22"/>
  </svg>
)

const MoonIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

export default function App() {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('jj-theme') || 'light'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('jj-theme', theme)
  }, [theme])

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <NavLink to="/" className={styles.brand}>
          <span className={styles.brandLogo}><Logo size={28} /></span>
          <span className={styles.brandName}>Joshua Jennings</span>
        </NavLink>

        <div className={styles.navRight}>
          <ul className={styles.navLinks}>
            <li>
              <NavLink to="/" end className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}>
                home
              </NavLink>
            </li>
            <li>
              <NavLink to="/projects" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}>
                projects
              </NavLink>
            </li>
            <li>
              <NavLink to="/photos" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}>
                photos
              </NavLink>
            </li>
            <li>
              <NavLink to="/resume" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}>
                resume
              </NavLink>
            </li>
          </ul>

          <button
            className={styles.themeBtn}
            onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>
      </nav>

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/photos" element={<Photos />} />
          <Route path="/resume" element={<Resume />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerCopy}>2026 © Joshua Jennings</span>
        <div className={styles.footerLinks}>
          <a href={`https://math-webring.vercel.app/#${SITE_URL}?nav=prev`} aria-label="Previous math webring site">←</a>
          <a href={`https://math-webring.vercel.app/#${SITE_URL}`} target="_blank" rel="noreferrer" title="UW Math Webring"><PiIcon /></a>
          <a href={`https://math-webring.vercel.app/#${SITE_URL}?nav=next`} aria-label="Next math webring site">→</a>
        </div>
      </footer>
    </div>
  )
}

