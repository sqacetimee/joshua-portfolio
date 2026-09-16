import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import styles from './Home.module.css'
import Section from '../components/Section'
import SkyClock from '../components/SkyClock'
import { Page, Reveal, Stagger, Item } from '../components/Motion'
import {
  D2R, localSiderealDeg, toHorizontal, planetPositions, moonPosition, moonPhase, sunAltitudeDeg, nextSunEvents,
} from '../lib/astro'
import { getSkyOffset, setSkyOffset, subscribeSkyOffset } from '../lib/skyTime'
import { useWeather, weatherAt, compass } from '../lib/weather'
import Letters from '../components/Letters'

const EMAIL = 'j2jennings@uwaterloo.ca'
const LINKEDIN = 'https://linkedin.com/in/joshuajennings'
const GITHUB = 'https://github.com/sqacetimee'

const ABOUT = [
  'Math student at the University of Waterloo',
  'Interested in software, strategy, and building things that are thoughtful and useful',
  'Enjoy end-to-end projects and solving difficult problems',
  'Always improving at things that reward precision, patience, and good decision-making',
  'Play poker, which shapes how I think about risk, discipline, and choices under uncertainty',
  'Drawn to ambitious ideas, sharp people, and meaningful work',
]

const TZ = 'America/Toronto'
const liveFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' })
const shiftedFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' })
const clockParts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })

const joinNames = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

function formatOffset(h) {
  if (Math.abs(h) < 0.01) return 'now'
  const abs = Math.abs(h)
  const hours = Math.floor(abs)
  const mins = Math.round((abs - hours) * 60)
  return `${h > 0 ? '+' : '−'}${hours}h ${String(mins).padStart(2, '0')}m`
}

/* What is actually in the sky over Waterloo at a given moment */
function skyReport(date) {
  const lst = localSiderealDeg(date)
  const planets = planetPositions(date)
    .filter((p) => p.name !== 'Mercury' && toHorizontal(p.ra, p.dec, lst)[0] > 5 * D2R)
    .map((p) => p.name)
  const mp = moonPosition(date)
  return {
    sunAlt: sunAltitudeDeg(date),
    planets,
    moon: moonPhase(date),
    moonUp: toHorizontal(mp.ra, mp.dec, lst)[0] > 0,
  }
}

export default function Home() {
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef(null)
  const offset = useSyncExternalStore(subscribeSkyOffset, getSkyOffset)
  const weather = useWeather()

  useEffect(() => {
    // Tick every second so the sky note stays on the same minute as the live readout above it
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const live = Math.abs(offset) < 0.01
  const shown = new Date(now + offset * 3600000)
  const shownLabel = live ? liveFmt.format(shown) : shiftedFmt.format(shown).replace(',', '')
  const minute = Math.floor(shown.getTime() / 60000)
  const sky = useMemo(() => skyReport(new Date(minute * 60000)), [minute])
  const tenMinutes = Math.floor(now / 600000)
  const events = useMemo(() => nextSunEvents(new Date(tenMinutes * 600000)), [tenMinutes])

  // Jump the sky to a moment, as an offset from now (limited to the slider's range)
  const jumpTo = (ms) => {
    const hours = (ms - Date.now()) / 3600000
    setSkyOffset(Math.max(-24, Math.min(24, Math.round(hours * 4) / 4)))
  }
  const nextMidnight = () => {
    const [hh, mm] = clockParts.format(new Date()).split(':').map(Number)
    return Date.now() + ((24 - hh) * 60 - mm) * 60000
  }

  const copyEmail = () => {
    const done = () => {
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(EMAIL).then(done).catch(() => { window.location.href = 'mailto:' + EMAIL })
    } else {
      window.location.href = 'mailto:' + EMAIL
    }
  }

  const when = live ? 'right now' : `at ${shownLabel}`
  let skyNote = `Behind this page: the real sky over Waterloo, ${when}.`
  if (sky.sunAlt > 0) skyNote = `Behind this page: the real sky over Waterloo, ${when}, in daylight.`
  else if (sky.sunAlt > -12) skyNote = `Behind this page: the real sky over Waterloo, ${when}, at twilight.`

  const planetLine = sky.planets.length
    ? `${joinNames(sky.planets)} ${sky.planets.length === 1 ? 'is' : 'are'} above the horizon`
    : 'no bright planets above the horizon'
  const moonLine = `${sky.moon.name}, ${Math.round(sky.moon.illum * 100)}% lit${sky.moonUp ? '' : ', below the horizon'}`

  // Real hourly weather for the chosen moment
  const wx = weather ? weatherAt(weather, shown.getTime()) : null
  const weatherLine = wx
    ? `cloud cover ${Math.round(wx.cover)}% · wind ${Math.round(wx.speed)} km/h from the ${compass(wx.from)}`
    : weather === undefined ? 'loading the weather…' : ''
  if (wx && sky.sunAlt < -12 && wx.cover >= 70) skyNote += ' Clouds would hide most of these stars.'

  return (
    <Page className={styles.page}>
      <section className={styles.hero}>
        <Stagger className={styles.heroText} delay={0.05} stagger={0.08}>
          <Item as="p" className={styles.coords}>
            <span className={styles.live} data-live={live} aria-hidden="true" />
            <SkyClock />
          </Item>
          <Item as="h1" className={styles.name} aria-label="Joshua Jennings"><Letters text="Joshua Jennings" constellation /></Item>
          <Item as="p" className={styles.role}>
            Math @ <a href="https://uwaterloo.ca" target="_blank" rel="noreferrer">University of Waterloo</a>
          </Item>
          <Item className={styles.links}>
            <button className={styles.textLink} onClick={copyEmail}>{copied ? 'email copied' : 'email'}</button>
            <a className={styles.textLink} href={LINKEDIN} target="_blank" rel="noreferrer">linkedin ↗</a>
            <a className={styles.textLink} href={GITHUB} target="_blank" rel="noreferrer">github ↗</a>
          </Item>
        </Stagger>

        <Reveal className={styles.skyNote} delay={0.4}>
          <p className={styles.skyNoteText}>{skyNote}</p>
          <p className={styles.skyMeta}>{planetLine} · moon {moonLine}</p>
          {weatherLine && <p className={styles.skyMeta}>{weatherLine}</p>}

          <div className={styles.skyControl}>
            <div className={styles.scrubTop}>
              <span>−24h</span>
              <span className={styles.scrubNow}>{formatOffset(offset)}</span>
              <span>+24h</span>
            </div>
            <input
              className={styles.range}
              type="range"
              min={-24}
              max={24}
              step={0.25}
              value={offset}
              onChange={(e) => setSkyOffset(parseFloat(e.target.value))}
              aria-label="Move the sky through time"
            />
            <div className={styles.jumps}>
              <button className={styles.jump} onClick={() => setSkyOffset(0)} disabled={live}>now</button>
              {events.rise && <button className={styles.jump} onClick={() => jumpTo(events.rise.getTime())}>sunrise</button>}
              {events.set && <button className={styles.jump} onClick={() => jumpTo(events.set.getTime())}>sunset</button>}
              <button className={styles.jump} onClick={() => jumpTo(nextMidnight())}>midnight</button>
            </div>
          </div>
        </Reveal>
      </section>

      <div className={styles.wrap}>
        <Section label="About">
          <div className={styles.about}>
            <Reveal as="img" className={styles.portrait} src="/avatar.webp" width="56" height="56" decoding="async" alt="Joshua Jennings" />
            <div>
              <Reveal as="p" className={styles.aboutLead}>I'm Josh.</Reveal>
              <Stagger as="ul" className={styles.aboutList} inView stagger={0.07}>
                {ABOUT.map((point) => <Item as="li" key={point}>{point}</Item>)}
              </Stagger>
            </div>
          </div>
        </Section>

        <Section label="Log" meta="some things I've done (and doing)">
          <Stagger as="ul" className={styles.log} inView stagger={0.08}>
            <Item as="li">
              <span className={styles.logTitle}>
                Software Engineer Intern @{' '}
                <a href="https://thethird.dev/" target="_blank" rel="noreferrer">The Third Developer</a>
              </span>
              <span className={styles.logDetail}>Oct 2024 to Sept 2025</span>
            </Item>
            <Item as="li">
              <span className={styles.logTitle}>Top 9 of 300+</span>
              <span className={styles.logDetail}>UWaterloo Poker Club × Citadel Securities Tournament</span>
            </Item>
            <Item as="li">
              <span className={styles.logTitle}>Top 3 of 280+ participants</span>
              <span className={styles.logDetail}>UWaterloo Estimathon × Jane Street</span>
            </Item>
          </Stagger>
        </Section>

        <Section label="Contact">
          <Reveal as="h2" className={styles.hello}>say hello</Reveal>
          <Reveal delay={0.08}>
            <button className={styles.email} onClick={copyEmail}>{EMAIL}</button>
            <span className={styles.hint} aria-live="polite">{copied ? 'copied to clipboard' : 'click to copy'}</span>
          </Reveal>
          <Reveal className={styles.contactLinks} delay={0.16}>
            <a className={styles.textLink} href={LINKEDIN} target="_blank" rel="noreferrer">linkedin ↗</a>
            <a className={styles.textLink} href={GITHUB} target="_blank" rel="noreferrer">github ↗</a>
          </Reveal>
        </Section>
      </div>
    </Page>
  )
}
