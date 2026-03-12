import { useState, useEffect } from 'react'
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
          <a href="mailto:jenningsjoshua72@gmail.com" aria-label="Email"><MailIcon /></a>
          <a href="https://linkedin.com/in/joshuajennings" target="_blank" rel="noreferrer" aria-label="LinkedIn"><LinkedInIcon /></a>
          <a href="https://github.com/sqacetimee" target="_blank" rel="noreferrer" aria-label="GitHub"><GitHubIcon /></a>
        </div>
      </footer>
    </div>
  )
}

/* footer icons */
const MailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/>
  </svg>
)
const LinkedInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)
const GitHubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
)