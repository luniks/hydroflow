import { valueAt } from './turbineOutlook'
import type { LagLaw, SeriesPoint, SiteCalibration, TurbineModel } from './types'

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000

/** Fenetre de calage (h) et fenetre du biais recent (h). */
export const CALIBRATION_WINDOW_H = 72
export const CALIBRATION_BIAS_H = 3
/** Nombre minimal de couples (reference, aval) pour caler ; en dessous, valeurs par defaut. */
export const CALIBRATION_MIN_PAIRS = 24
/** Dispersion minimale (ecart-type, m³/s) du debit de reference pour caler le gain ; en dessous, seul le decalage est ajuste. */
const MIN_GAIN_SPREAD = 2
const DEFAULT_SIGMA = 2.5
const MIN_SIGMA = 0.5
const GAIN_BOUNDS = [0.2, 1.2] as const

/**
 * Delai de propagation (min) de la station de reference a la turbine pour un debit de reference `q` :
 * constant au-dessus de `refFlow`, croissant quand le debit baisse (l'onde se propage plus lentement).
 */
export function lagMinutes(q: number, law: LagLaw): number {
  if (!(q > 0)) return law.maxMin
  const slow = Math.max(1, law.refFlow / q)
  return Math.min(law.maxMin, law.refMin * Math.pow(slow, law.exponent))
}

const toTimes = (points: SeriesPoint[]): number[] => points.map((p) => Date.parse(p.t))

interface Pair {
  t: number
  x: number
  y: number
}

/** Couples (debit de reference decale, debit aval mesure) sur la fenetre de calage. */
function pairUp(ref: SeriesPoint[], down: SeriesPoint[], m: TurbineModel, nowMs: number): Pair[] {
  if (!ref.length || !down.length) return []
  const rt = toTimes(ref)
  const out: Pair[] = []
  for (const d of down) {
    const t = Date.parse(d.t)
    if (t < nowMs - CALIBRATION_WINDOW_H * HOUR_MS || t > nowMs) continue
    // Delai estime en deux temps : debit de reference a delai nominal, puis delai propre a ce debit.
    const first = valueAt(ref, rt, t - m.lag.refMin * m.downLagRatio * MINUTE_MS)
    const lag = lagMinutes(first, m.lag) * m.downLagRatio * MINUTE_MS
    if (t - lag < rt[0]!) continue
    out.push({ t, x: valueAt(ref, rt, t - lag), y: d.y })
  }
  return out
}

/**
 * Cale le passage debit de reference -> debit au barrage par regression sur les 72 dernieres heures,
 * puis corrige le decalage avec le biais des 3 dernieres heures. Les travaux en amont changent le rapport entre
 * les deux stations : un calage glissant l'absorbe sans reglage manuel.
 */
export function calibrateSite(
  ref: SeriesPoint[],
  down: SeriesPoint[],
  m: TurbineModel,
  nowMs: number,
): SiteCalibration {
  const pairs = pairUp(ref, down, m, nowMs)
  const fallback: SiteCalibration = {
    gain: m.defaultGain,
    offset: m.defaultOffset,
    sigma: DEFAULT_SIGMA,
    pairs: pairs.length,
    fitted: false,
  }
  if (pairs.length < CALIBRATION_MIN_PAIRS) return fallback

  const n = pairs.length
  const mx = pairs.reduce((a, p) => a + p.x, 0) / n
  const my = pairs.reduce((a, p) => a + p.y, 0) / n
  let sxx = 0
  let sxy = 0
  for (const p of pairs) {
    sxx += (p.x - mx) ** 2
    sxy += (p.x - mx) * (p.y - my)
  }
  const spread = Math.sqrt(sxx / n)
  let gain = spread >= MIN_GAIN_SPREAD ? sxy / sxx : m.defaultGain
  gain = Math.min(GAIN_BOUNDS[1], Math.max(GAIN_BOUNDS[0], gain))
  let offset = my - gain * mx

  const recent = pairs.filter((p) => p.t >= nowMs - CALIBRATION_BIAS_H * HOUR_MS)
  if (recent.length >= 6) {
    offset += recent.reduce((a, p) => a + (p.y - (gain * p.x + offset)), 0) / recent.length
  }

  const sse = pairs.reduce((a, p) => a + (p.y - (gain * p.x + offset)) ** 2, 0)
  const sigma = Math.max(MIN_SIGMA, Math.sqrt(sse / n))
  return { gain, offset, sigma, pairs: n, fitted: true }
}

/**
 * Serie du debit au barrage, a l'heure ou il y arrive : chaque mesure de la station de reference est convertie
 * (gain, decalage) puis decalee de son propre delai de propagation. Les mesures dont l'arrivee ne suit pas celle de
 * la precedente (inversion due a un delai qui varie) sont ecartees : la serie reste strictement croissante en temps.
 */
export function siteFlowSeries(ref: SeriesPoint[], cal: SiteCalibration, m: TurbineModel): SeriesPoint[] {
  const out: SeriesPoint[] = []
  let lastArrival = -Infinity
  for (const p of ref) {
    const arrival = Date.parse(p.t) + lagMinutes(p.y, m.lag) * MINUTE_MS
    if (!(arrival > lastArrival)) continue
    lastArrival = arrival
    out.push({ t: new Date(arrival).toISOString(), y: Math.max(0, cal.gain * p.y + cal.offset) })
  }
  return out
}
