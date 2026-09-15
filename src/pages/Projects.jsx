import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import styles from './Projects.module.css'
import Section from '../components/Section'
import { Page, Reveal } from '../components/Motion'
import Tilt from '../components/Tilt'
import { PROJECTS } from '../data/projects'
import Letters from '../components/Letters'

const pad = (n) => String(n).padStart(2, '0')

/* Rounded screenshot that tilts towards the cursor */
function Plate({ project }) {
  const href = project.live || project.github
  const linkProps = href
    ? { href, target: '_blank', rel: 'noreferrer', 'aria-label': `Open ${project.name}`, 'data-cursor': project.live ? 'visit' : 'code' }
    : {}
  return (
    <Tilt as={href ? 'a' : 'div'} className={styles.plate} max={5} lift={1.04} {...linkProps}>
      {project.thumb
        ? <img src={project.thumb} alt={`${project.name} screenshot`} loading="lazy" decoding="async" width="1200" height="750" />
        : <span className={styles.noPlate}>no public image · under nda</span>}
    </Tilt>
  )
}

export default function Projects() {
  const location = useLocation()

  // Arriving from the home index: scroll to the chosen entry
  useEffect(() => {
    if (!location.hash) return
    const timer = setTimeout(() => {
      document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => clearTimeout(timer)
  }, [location.hash])

  return (
    <Page className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <Reveal as="p" className={styles.eyebrow}>catalogue · 2023 to 2026 · {PROJECTS.length} entries</Reveal>
          <Reveal as="h1" className={styles.title} delay={0.08} aria-label="Projects"><Letters text="Projects" /></Reveal>
        </header>

        {PROJECTS.map((p, i) => (
          <Section key={p.name} id={`obs-${pad(i + 1)}`} label={`OBS. ${pad(i + 1)}`} meta={p.period}>
            <Reveal>
              <Plate project={p} />
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className={styles.name} aria-label={p.name}><Letters text={p.name} /></h2>
              <p className={styles.desc}>{p.desc}</p>
              <dl className={styles.facts}>
                <div>
                  <dt>built with</dt>
                  <dd>{p.tech.join(' · ')}</dd>
                </div>
                <div>
                  <dt>links</dt>
                  <dd className={styles.linkList}>
                    {p.live && <a href={p.live} target="_blank" rel="noreferrer">live site ↗</a>}
                    {p.github && <a href={p.github} target="_blank" rel="noreferrer">source ↗</a>}
                    {!p.live && !p.github && <span>private, under nda</span>}
                  </dd>
                </div>
              </dl>
            </Reveal>
          </Section>
        ))}
      </div>
    </Page>
  )
}
