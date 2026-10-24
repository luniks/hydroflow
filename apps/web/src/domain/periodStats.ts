import { replayTurbine } from './turbineOutlook'
import type { ExploitConfig, SeriesPoint } from './types'

const MINUTE_MS = 60_000
/** Au-dela, l'ecart entre deux mesures est un trou de donnees : il n'est compte ni au numerateur ni au denominateur. */
const MAX_GAP_MIN = 15

export interface PeriodStats {
  /** Duree (min) effectivement couverte par des mesures. */
  coverageMin: number
  /** Part du temps couvert passee dans la zone optimale (0-100). */
  optimalPct: number
  stops: number
  starts: number
}

/**
 * Bilan de production sur la periode affichee, vu de la turbine : les mesures de la station sont decalees du
 * delai de propagation, et seules celles deja arrivees a la turbine (`untilMs`) comptent. Chaque mesure vaut
 * jusqu'a la suivante. Arrets et demarrages sont rejoues avec les regles d'exploitation (hysteresis comprise).
 * `null` s'il n'y a pas de duree couverte (moins de deux mesures arrivees, ou seulement des trous).
 */
export function periodStats(points: SeriesPoint[], c: ExploitConfig, untilMs: number): PeriodStats | null {
  const arrived = points.filter((p) => Date.parse(p.t) + c.propagationMin * MINUTE_MS <= untilMs)
  if (arrived.length < 2) return null

  let covered = 0
  let optimal = 0
  for (let i = 0; i < arrived.length - 1; i++) {
    const dt = (Date.parse(arrived[i + 1]!.t) - Date.parse(arrived[i]!.t)) / MINUTE_MS
    if (dt > MAX_GAP_MIN) continue
    covered += dt
    if (arrived[i]!.y >= c.optMin && arrived[i]!.y <= c.optMax) optimal += dt
  }
  if (covered === 0) return null
  const { stops, starts } = replayTurbine(
    arrived.map((p) => p.y),
    c,
  )
  return { coverageMin: covered, optimalPct: (100 * optimal) / covered, stops, starts }
}
