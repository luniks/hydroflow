import { RAIN_FORECAST_HOURS, RAIN_PAST_HOURS } from './constants'
import type { RainAggregate, RainLevel, RainOrigin, RainPoint, RainRow, RainState } from './types'

const HOUR_MS = 3_600_000

/** Somme des precipitations (mm) strictement apres `fromMs` et jusqu'a `toMs` inclus. */
export function sumRainRange(
  times: string[],
  values: number[],
  fromMs: number,
  toMs: number,
): number {
  let total = 0
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]!).getTime()
    if (t > fromMs && t <= toMs) total += values[i] ?? 0
  }
  return total
}

/** Horizon de prevision : 48 h pour les bassins amont (signal precoce), 24 h pour les stations. */
export function forecastHorizon(origin: RainOrigin): number {
  return origin === 'external' ? RAIN_FORECAST_HOURS : 24
}

/** Seuil d'alerte par defaut : 1,5 x le seuil de vigilance, arrondi a 5 mm. */
export function defaultRainAlert(defaultThreshold: number): number {
  return Math.round((defaultThreshold * 1.5) / 5) * 5
}

/** L'alerte ne peut jamais passer sous la vigilance. */
export function effectiveAlertThreshold(state: Pick<RainState, 'threshold' | 'alertThreshold'>) {
  return Math.max(state.alertThreshold, state.threshold)
}

export function rainLevel(
  total: number,
  state: Pick<RainState, 'threshold' | 'alertThreshold'>,
): RainLevel {
  if (total >= effectiveAlertThreshold(state)) return 'alert'
  if (total >= state.threshold) return 'warn'
  return null
}

/** Fenetre du graphe : 24 h passees + l'horizon de prevision, alignee sur l'heure pleine. */
export function rainWindow(
  origin: RainOrigin,
  nowMs = Date.now(),
): { startMs: number; endMs: number } {
  const nowHour = Math.floor(nowMs / HOUR_MS) * HOUR_MS
  return {
    startMs: nowHour - RAIN_PAST_HOURS * HOUR_MS,
    endMs: nowHour + forecastHorizon(origin) * HOUR_MS,
  }
}

export interface RainTotals {
  tombe: number
  prevu: number
  total: number
  horizon: number
}

export function rainTotals(
  state: Pick<RainState, 'times' | 'values'>,
  origin: RainOrigin,
  nowMs = Date.now(),
): RainTotals {
  const horizon = forecastHorizon(origin)
  const tombe = sumRainRange(state.times, state.values, nowMs - 24 * HOUR_MS, nowMs)
  const prevu = sumRainRange(state.times, state.values, nowMs, nowMs + horizon * HOUR_MS)
  return { tombe, prevu, total: tombe + prevu, horizon }
}

/**
 * Synthese pluie pour l'exploitation : moyenne des points d'une origine.
 * Le niveau retenu est le plus eleve rencontre, pour ne jamais masquer une alerte.
 */
export function rainAggregate(
  points: RainPoint[],
  states: Record<string, RainState | undefined>,
  origin: RainOrigin,
  nowMs = Date.now(),
): RainAggregate | null {
  const horizon = forecastHorizon(origin)
  const rows: RainRow[] = []

  for (const p of points.filter((p) => p.origin === origin)) {
    const st = states[p.key]
    if (!st || !st.times.length) continue
    const { tombe, prevu, total } = rainTotals(st, origin, nowMs)
    rows.push({ name: p.name, tombe, prevu, total, level: rainLevel(total, st) })
  }

  if (!rows.length) return null

  const avg = (k: 'tombe' | 'prevu' | 'total') =>
    rows.reduce((a, r) => a + r[k], 0) / rows.length
  const level: RainLevel = rows.some((r) => r.level === 'alert')
    ? 'alert'
    : rows.some((r) => r.level === 'warn')
      ? 'warn'
      : null

  return { horizon, rows, level, tombe: avg('tombe'), prevu: avg('prevu'), total: avg('total') }
}
