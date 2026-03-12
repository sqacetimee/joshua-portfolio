import styles from './Projects.module.css'

const GithubIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
)

const ArrowIcon = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 9.5L9.5 2.5M4 2.5H9.5V8"/>
  </svg>
)

const PROJECTS = [
  {
    name: 'Perspective AI',
    desc: 'Dual-perspective AI assistant that generates two contrasting viewpoints on any topic in real time. Reduced single-sided response bias by 50%+ in structured prompt testing. Optimized streaming to cut perceived latency by 30%.',
    tech: ['Next.js', 'TypeScript', 'React', 'AI APIs'],
    period: 'Jan 2026',
    live: 'https://prspctvs.xyz/perspective',
    github: 'https://github.com/sqacetimee/perspective',
  },
  {
    name: 'Automated Email Outreach Platform',
    desc: 'Scalable email automation delivering 2,000+ personalized emails per day. Implemented scheduling, batching, and rate-limiting — improving throughput by 300% and reducing send interruptions by 70%.',
    tech: ['JavaScript', 'Node.js', 'Express'],
    period: 'Jan 2024',
    live: null,
    github: null, // NDA
  },
  {
    name: 'Real Estate Marketing Website',
    desc: 'Full-stack marketing site for a NYC brokerage. Conversion-focused UI with responsive layouts, integrated property inquiry workflows, and secure backend lead handling.',
    tech: ['React', 'JavaScript', 'Node.js'],
    period: 'Dec 2023',
    live: 'https://cityemerald.com',
    github: null, // NDA
  },
]

export default function Projects() {
  return (
    <div className={styles.page}>
      <h2 className={styles.pageTitle}>Projects</h2>

      <ul className={styles.list}>
        {PROJECTS.map((p, i) => (
          <li key={i} className={styles.item}>
            <div className={styles.itemTop}>
              <span className={styles.itemName}>{p.name}</span>
              <div className={styles.itemLinks}>
                {p.github && (
                  <a
                    href={p.github}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.iconBtn}
                    aria-label="GitHub repo"
                    title="GitHub"
                  >
                    <GithubIcon />
                  </a>
                )}
                {p.live && (
                  <a
                    href={p.live}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.iconBtn}
                    aria-label="Live site"
                    title="Live site"
                  >
                    <ArrowIcon />
                  </a>
                )}
                {!p.github && !p.live && (
                  <span className={styles.ndaTag}>NDA</span>
                )}
              </div>
            </div>

            <p className={styles.itemDesc}>{p.desc}</p>

            <div className={styles.itemFoot}>
              <div className={styles.techList}>
                {p.tech.map(t => (
                  <span key={t} className={styles.techTag}>{t}</span>
                ))}
              </div>
              <span className={styles.itemPeriod}>{p.period}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
