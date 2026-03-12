import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import styles from './Home.module.css'
import PokerShowdown from './PokerShowdown'

const FULL_NAME = 'Joshua Jennings'
const EMAIL = 'jenningsjoshua72@gmail.com'

function TypingName() {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (displayed.length < FULL_NAME.length) {
      const t = setTimeout(() => setDisplayed(FULL_NAME.slice(0, displayed.length + 1)), 68)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setDone(true), 800)
    return () => clearTimeout(t)
  }, [displayed])
  return (
    <h1 className={styles.name}>
      {displayed}
      <span className={done ? styles.cursorHidden : styles.cursor}>|</span>
    </h1>
  )
}

const CONTACT = [
  {
    label: 'Email', href: 'mailto:' + EMAIL, copyEmail: true,
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>,
  },
  {
    label: 'LinkedIn', href: 'https://linkedin.com/in/joshuajennings',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
  },
  {
    label: 'GitHub', href: 'https://github.com/sqacetimee',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>,
  },
  {
    label: 'Resume', href: '/resume',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  },
]

export default function Home() {
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef(null)

  const handleEmailClick = (e) => {
    e.preventDefault()
    navigator.clipboard.writeText(EMAIL).then(() => {
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={styles.page}>

      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <TypingName />
          <div className={styles.roleLine}>
            Math @{' '}
            <a href="https://uwaterloo.ca" target="_blank" rel="noreferrer">
              University of Waterloo
            </a>
          </div>
        </div>
        <div className={styles.avatarWrap}>
          <div className={styles.fanCards}>
            <div className={`${styles.fanCard} ${styles.fanCardLeft}`}>
              <span className={styles.fanCardCorner}>A<br/>♠</span>
              <span className={styles.fanCardSuit}>♠</span>
            </div>
            <div className={`${styles.fanCard} ${styles.fanCardRight}`}>
              <span className={styles.fanCardCorner}>T<br/>♠</span>
              <span className={styles.fanCardSuit}>♠</span>
            </div>
          </div>
          <img src="/avatar.png" alt="Joshua Jennings" className={styles.avatar} />
        </div>
      </div>

      <hr className={styles.rule} />

      <div className={styles.contactRow}>
        {CONTACT.map(c => {
          if (c.href.startsWith('/')) {
            return (
              <Link key={c.label} to={c.href} className={styles.contactIcon} aria-label={c.label} title={c.label}>
                {c.icon}
              </Link>
            )
          }
          if (c.copyEmail) {
            return (
              <button
                key={c.label}
                className={styles.contactIcon}
                onClick={handleEmailClick}
                aria-label={copied ? 'Copied!' : c.label}
                title={copied ? 'Copied!' : 'Copy email'}
              >
                {c.icon}
                {copied && <span className={styles.copiedTooltip}>copied!</span>}
              </button>
            )
          }
          return (
            <a
              key={c.label} href={c.href}
              target="_blank" rel="noreferrer"
              className={styles.contactIcon}
              aria-label={c.label} title={c.label}
            >
              {c.icon}
            </a>
          )
        })}
      </div>

      <hr className={styles.rule} />

      <p className={styles.bio}>
        I'm Josh, a University of Waterloo student interested in software, strategy,
        and building things that are both thoughtful and useful. I enjoy working on
        end-to-end projects, solving difficult problems, and improving at things that
        reward precision, patience, and good decision-making. Outside of tech, I play
        poker, which has shaped how I think about risk, discipline, and
        making strong choices under uncertainty. I'm always interested in ambitious
        ideas, sharp people, and meaningful work.
      </p>

      <hr className={styles.rule} />

      <p className={styles.highlightsIntro}>Some things I've done (and doing):</p>
      <ul className={styles.highlights}>
        <li>
          Full-Stack Web Developer Intern @{' '}
          <a href="https://thethird.dev/" target="_blank" rel="noreferrer">
            <strong>The Third Developer</strong>
          </a>{' '}
          — built and shipped websites for 3+ clients, cutting delivery time by 35%
        </li>
        <li>
          Built{' '}
          <a href="https://prspctvs.xyz/perspective" target="_blank" rel="noreferrer">
            Perspective AI
          </a>{' '}
          — dual-viewpoint AI assistant, optimized streaming to cut latency by 30%
        </li>
        <li>
          Top 9 of 300+ —{' '}
          <strong>UWaterloo Poker Club × Citadel Securities Tournament</strong>
        </li>
        <li>
          Currently <strong>Top 5 in UWaterloo Poker Club</strong>!
        </li>
        <li>
          Top 3 (team) of 280+ participants —{' '}
          <strong>UWaterloo Estimathon × Jane Street</strong>
        </li>
      </ul>

      <hr className={styles.rule} />

      <PokerShowdown />

    </div>
  )
}
