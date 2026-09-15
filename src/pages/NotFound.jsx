import { Link } from 'react-router-dom'
import styles from './Lost.module.css'
import { Page, Reveal } from '../components/Motion'
import Letters from '../components/Letters'

export default function NotFound() {
  return (
    <Page className={styles.wrap}>
      <Reveal as="p" className={styles.code}>404</Reveal>
      <Reveal as="h1" className={styles.msg} delay={0.08} aria-label="this page doesn't exist"><Letters text="this page doesn't exist" /></Reveal>
      <Reveal delay={0.16}>
        <Link to="/" className={styles.back}>back to home</Link>
      </Reveal>
    </Page>
  )
}
