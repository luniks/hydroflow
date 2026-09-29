import type { SeriesPoint, Trend } from './types'

const ONE_HOUR_MS = 3_600_000

/**
 * Tendance sur ~1 h : compare la derniere mesure au point le plus recent anterieur
 * a `last - 1h` (a defaut, le point le plus ancien disponible).
 */
export function computeTrend(points: SeriesPoint[], flatThreshold: number): Trend {
  if (points.length < 2) return { dir: 'flat', ratePerHour: 0 }

  const last = points[points.length - 1]!
  const targetTime = new Date(last.t).getTime() - ONE_HOUR_MS

  let ref = points[0]!
  for (let i = points.length - 2; i >= 0; i--) {
    ref = points[i]!
    if (new Date(ref.t).getTime() <= targetTime) break
  }

  const delta = last.y - ref.y
  const deltaH = Math.max(
    (new Date(last.t).getTime() - new Date(ref.t).getTime()) / ONE_HOUR_MS,
    0.01,
  )
  const ratePerHour = delta / deltaH

  let dir: Trend['dir'] = 'flat'
  if (ratePerHour > flatThreshold) dir = 'up'
  else if (ratePerHour < -flatThreshold) dir = 'down'

  return { dir, ratePerHour }
}
