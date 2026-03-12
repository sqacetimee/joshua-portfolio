import { Link } from 'react-router-dom'
import styles from './NotFound.module.css'

export default function NotFound() {
  return (
    <div className={styles.wrap}>
      <span className={styles.code}>404</span>
      <p className={styles.msg}>this page doesn't exist</p>
      <Link to="/" className={styles.back}>← home</Link>
    </div>
  )
}
