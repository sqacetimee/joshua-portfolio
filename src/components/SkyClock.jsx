import { useEffect, useRef } from 'react'
import { WATERLOO, localSiderealDeg } from '../lib/astro'
import { getSkyShown, subscribeSkyShown } from '../lib/skyTime'
import styles from './SkyClock.module.css'

const TZ = 'America/Toronto'
const liveFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' })
const shiftedFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' })
const pad = (n) => String(n).padStart(2, '0')

// The point straight overhead always sits at declination = latitude; its right ascension
// equals local sidereal time, so it turns with the sky (a full circle every 23h 56m).
const latMinutes = Math.round(WATERLOO.lat * 60)
const DEC = `+${Math.floor(latMinutes / 60)}° ${pad(latMinutes % 60)}′`

function formatRA(deg) {
  const totalSeconds = Math.floor((deg / 15) * 3600)
  const h = Math.floor(totalSeconds / 3600) % 24
  const m = Math.floor(totalSeconds / 60) % 60
  const s = totalSeconds % 60
  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`
}

/* Location, time and the sky coordinates overhead. Written straight to the DOM so it can
   follow the backdrop's glide frame by frame without re-rendering the page. */
export default function SkyClock() {
  const timeRef = useRef(null)
  const raRef = useRef(null)

  useEffect(() => {
    let lastTime = ''
    let lastRA = ''
    const render = () => {
      const hours = getSkyShown()
      const date = new Date(Date.now() + hours * 3600000)
      const time = Math.abs(hours) < 0.01 ? liveFmt.format(date) : shiftedFmt.format(date).replace(',', '')
      const ra = formatRA(localSiderealDeg(date))
      if (time !== lastTime) timeRef.current.textContent = lastTime = time
      if (ra !== lastRA) raRef.current.textContent = lastRA = ra
    }
    render()
    const unsubscribe = subscribeSkyShown(render)
    const id = setInterval(render, 1000)
    return () => {
      unsubscribe()
      clearInterval(id)
    }
  }, [])

  return (
    <>
      <span className={styles.group}>
        {WATERLOO.lat.toFixed(2)}° N · {Math.abs(WATERLOO.lon).toFixed(2)}° W · <span ref={timeRef} className={styles.value} />
      </span>
      <span className={styles.group} title="Sky coordinates of the point directly overhead">
        overhead · RA <span ref={raRef} className={styles.value} /> · Dec {DEC}
      </span>
    </>
  )
}
