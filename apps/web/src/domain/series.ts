import { MAX_CHART_POINTS } from './constants'
import type { Range, RangeStatus, SeriesPoint, TimeWindow } from './types'

/**
 * Fenetre temporelle [dateDebut, dateFin] pour la periode et l'offset donnes.
 * `dateFin === null` signifie « jusqu'a maintenant » (mode direct).
 */
export function computeWindow(hours: number, offsetSteps: number): TimeWindow {
  const nowMs = Date.now()
  const dateFin = offsetSteps > 0 ? new Date(nowMs - offsetSteps * hours * 3_600_000) : null
  const dateDebut = new Date((dateFin ? dateFin.getTime() : nowMs) - hours * 3_600_000)
  return { dateDebut, dateFin }
}

/** Sous-echantillonnage lineaire, en conservant toujours la mesure la plus recente. */
export function downsample(points: SeriesPoint[], maxPoints = MAX_CHART_POINTS): SeriesPoint[] {
  if (points.length <= maxPoints) return points
  const step = points.length / maxPoints
  const out: SeriesPoint[] = []
  for (let i = 0; i < maxPoints; i++) out.push(points[Math.floor(i * step)]!)
  const last = points[points.length - 1]!
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

/** `low` sous le seuil bas, `high` au-dessus du seuil haut, `ok` entre les deux. */
export function rangeStatus(
  value: number | null | undefined,
  range: Range | null | undefined,
): RangeStatus | null {
  if (value === null || value === undefined || !range) return null
  if (value < range.low) return 'low'
  if (value > range.high) return 'high'
  return 'ok'
}

/** Hub'Eau renvoie les hauteurs en mm et les debits en l/s. */
export const mmToMetres = (mm: number): number => mm / 1000
export const litresToCubicMetres = (ls: number): number => ls / 1000

export function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}
