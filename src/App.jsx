import { useEffect, useRef } from 'react'
import { Routes, Route, NavLink, Link, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, useMotionValueEvent, useScroll } from 'motion/react'
import SkyBackdrop from './components/SkyBackdrop'
import Intro from './components/Intro'
import StarCursor from './components/StarCursor'
import ScrollMoon from './components/ScrollMoon'
import Mark from './components/Mark'
import SoundToggle from './components/SoundToggle'
import LightRig from './components/LightRig'
import { initAmbient } from './lib/ambient'
import Home from './pages/Home'
import Projects from './pages/Projects'
import Photos from './pages/Photos'
import NotFound from './pages/NotFound'
import styles from './App.module.css'

const SITE_URL = 'joshuajennings.ca'

const NAV = [
  { to: '/', label: 'home', end: true },
  { to: '/work', label: 'projects' },
  { to: '/photos', label: 'photos' },
]

const PiIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="50 50 420 390" width="14" height="14" fill="currentColor" aria-hidden="true">
    <rect x="60" y="60" width="380" height="52" rx="10" ry="10" />
    <rect x="148" y="112" width="48" height="260" rx="8" ry="8" />
    <rect x="114" y="352" width="116" height="36" rx="8" ry="8" />
    <path d="M 304,112 C 304,112 316,112 328,112 C 340,112 352,120 352,132 L 352,300 C 352,340 364,370 390,392 C 408,408 428,414 440,406 C 452,398 454,382 444,368 C 436,357 424,352 416,344 C 396,324 388,296 388,260 L 388,132 C 388,120 376,112 364,112 Z"/>
  </svg>
)

export default function App() {
  const location = useLocation()
  const navRef = useRef(null)
  const { scrollY } = useScroll()

  // The nav stays fixed; a soft fade appears behind it once content scrolls underneath
  useMotionValueEvent(scrollY, 'change', (y) => {
    const scrolled = String(y > 12)
    if (navRef.current && navRef.current.dataset.scrolled !== scrolled) navRef.current.dataset.scrolled = scrolled
  })

  // Background music: loads quietly, starts on the first interaction if the visitor hasn't turned it off
  useEffect(() => { initAmbient() }, [])

  return (
    <div className={styles.shell} data-shell>
      <SkyBackdrop home={location.pathname === '/'} />
      <Intro />
      <StarCursor />
      <ScrollMoon />
      <LightRig />

      <nav ref={navRef} className={styles.nav} data-scrolled="false" aria-label="Main">
        <Link to="/" className={styles.brand} aria-label="Joshua Jennings, home">
          <Mark size={30} />
        </Link>
        <ul className={styles.navLinks}>
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              >
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <SoundToggle />
      </nav>

      <main className={styles.main}>
        <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo(0, 0)}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            {/* Addresses phones, shortcuts and old links open, which all mean the home page */}
            <Route path="/index.html" element={<Navigate to="/" replace />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/resume" element={<Navigate to="/" replace />} />
            <Route path="/work" element={<Projects />} />
            <Route path="/projects" element={<Navigate to="/work" replace />} />
            <Route path="/photos" element={<Photos />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnimatePresence>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footLeft}>
          <span>© 2026 Joshua Jennings</span>
          <span className={styles.credit}>
            weather by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>
          </span>
        </div>
        <div className={styles.webring} aria-label="UW Math Webring">
          <a href={`https://math-webring.vercel.app/#${SITE_URL}?nav=prev`} aria-label="Previous math webring site">←</a>
          <a href={`https://math-webring.vercel.app/#${SITE_URL}`} target="_blank" rel="noreferrer" title="UW Math Webring"><PiIcon /></a>
          <a href={`https://math-webring.vercel.app/#${SITE_URL}?nav=next`} aria-label="Next math webring site">→</a>
        </div>
      </footer>
    </div>
  )
}
