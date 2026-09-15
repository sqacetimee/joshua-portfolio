import { useEffect, useState } from 'react'

// Hourly cloud cover and wind for Waterloo from Open-Meteo (free, no key, CC BY 4.0).
// Two days back and three ahead so the ±24h time slider always has real data.
const ENDPOINT = 'https://api.open-meteo.com/v1/forecast?latitude=43.4723&longitude=-80.5449'
  + '&hourly=cloud_cover,wind_speed_10m,wind_direction_10m&past_days=2&forecast_days=3&timezone=GMT&timeformat=unixtime'
const CACHE_KEY = 'jj-weather-v1'
const CACHE_MS = 30 * 60 * 1000

let request = null

/* Resolves to the hourly series, or null if the weather can't be loaded */
export function getWeather() {
  if (request) return request
  request = (async () => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY))
      if (cached && Date.now() - cached.fetched < CACHE_MS) return cached
    } catch { /* storage unavailable */ }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(ENDPOINT, { signal: controller.signal })
      if (!res.ok) return null
      const json = await res.json()
      const h = json.hourly
      const data = {
        fetched: Date.now(),
        times: h.time.map((s) => s * 1000),
        cover: h.cloud_cover.map((v) => v ?? 0),
        speed: h.wind_speed_10m.map((v) => v ?? 0),
        from: h.wind_direction_10m.map((v) => v ?? 270),
      }
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* storage full or blocked */ }
      return data
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  })()
  return request
}

/* Weather at a moment, interpolated between the hourly values */
export function weatherAt(data, ms) {
  if (!data || data.times.length < 2) return null
  const { times } = data
  const i = Math.max(0, Math.min(times.length - 2, Math.floor((ms - times[0]) / 3600000)))
  const t = Math.max(0, Math.min(1, (ms - times[i]) / 3600000))
  const lerp = (arr) => arr[i] + (arr[i + 1] - arr[i]) * t
  // Wind direction is an angle, so interpolate it as a vector
  const a = (data.from[i] * Math.PI) / 180
  const b = (data.from[i + 1] * Math.PI) / 180
  const x = Math.cos(a) * (1 - t) + Math.cos(b) * t
  const y = Math.sin(a) * (1 - t) + Math.sin(b) * t
  return {
    cover: lerp(data.cover),
    speed: lerp(data.speed),
    from: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
  }
}

const POINTS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']
export const compass = (deg) => POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]

/* undefined while loading, null if unavailable, otherwise the hourly series */
export function useWeather() {
  const [data, setData] = useState(undefined)
  useEffect(() => {
    let alive = true
    getWeather().then((d) => { if (alive) setData(d) })
    return () => { alive = false }
  }, [])
  return data
}
