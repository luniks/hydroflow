import { powerKw } from './turbineModel'
import type { SeriesPoint, TurbineModel } from './types'

const MINUTE_MS = 60_000
/** Au-dela, l'ecart entre deux mesures est un trou de donnees : il n'est compte nulle part. */
const MAX_GAP_MIN = 15

export interface PeriodAverages {
  /** Puissance moyenne (kW), ponderee par la duree. */
  avgPowerKw: number
  peakPowerKw: number
  /** Debit moyen, minimal et maximal au barrage (m³/s). */
  avgFlow: number
  minFlow: number
  maxFlow: number
  /** Energie produite sur la periode couverte (kWh). */
  energyKwh: number
  /** Duree (min) effectivement couverte par des mesures. */
  coverageMin: number
}

/**
 * Moyennes de la periode a partir du debit au barrage (`site`, deja decale a l'heure d'arrivee a la turbine).
 * Seules les mesures arrivees (`untilMs`) comptent ; chaque mesure vaut jusqu'a la suivante.
 * `null` sans duree couverte (moins de deux mesures, ou seulement des trous).
 */
export function periodAverages(site: SeriesPoint[], m: TurbineModel, untilMs: number): PeriodAverages | null {
  const arrived = site.filter((p) => Date.parse(p.t) <= untilMs)
  let covered = 0
  let flowSum = 0
  let powerSum = 0
  let peak = 0
  let minFlow = Infinity
  let maxFlow = -Infinity

  for (let i = 0; i < arrived.length - 1; i++) {
    const p = arrived[i]!
    const dt = (Date.parse(arrived[i + 1]!.t) - Date.parse(p.t)) / MINUTE_MS
    if (dt > MAX_GAP_MIN) continue
    const kw = powerKw(p.y, m)
    covered += dt
    flowSum += p.y * dt
    powerSum += kw * dt
    peak = Math.max(peak, kw)
    minFlow = Math.min(minFlow, p.y)
    maxFlow = Math.max(maxFlow, p.y)
  }
  if (covered === 0) return null
  return {
    avgPowerKw: powerSum / covered,
    peakPowerKw: peak,
    avgFlow: flowSum / covered,
    minFlow,
    maxFlow,
    energyKwh: powerSum / 60,
    coverageMin: covered,
  }
}
