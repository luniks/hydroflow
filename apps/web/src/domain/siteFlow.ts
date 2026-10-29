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
/** Bornes du gain : le rapport entre les deux stations varie (travaux, repartition des apports), pas de facon extreme. */
const GAIN_BOUNDS = [0.35, 0.9] as const
/**
 * Duree (min) a partir de laquelle une valeur strictement identique est consideree figee (capteur bloque, valeur
 * de remplacement) : sur un cours d'eau qui bouge, la meme valeur plus de 90 min est suspecte.
 */
export const FROZEN_MIN = 90

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

/**
 * Ecarte les series de valeurs strictement identiques couvrant au moins `minMin` minutes (capteur fige).
 * Une telle serie fausserait le calage : le debit aval parait ne plus suivre l'amont.
 */
export function dropFrozen(points: SeriesPoint[], minMin: number = FROZEN_MIN): SeriesPoint[] {
  const out: SeriesPoint[] = []
  let i = 0
  while (i < points.length) {
    let j = i
    while (j + 1 < points.length && points[j + 1]!.y === points[i]!.y) j++
    const span = (Date.parse(points[j]!.t) - Date.parse(points[i]!.t)) / MINUTE_MS
    if (span < minMin) out.push(...points.slice(i, j + 1))
    i = j + 1
  }
  return out
}

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
  const pairs = pairUp(ref, dropFrozen(down), m, nowMs)
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
  let gain = m.fitGain && spread >= MIN_GAIN_SPREAD ? sxy / sxx : m.defaultGain
  gain = Math.min(GAIN_BOUNDS[1], Math.max(GAIN_BOUNDS[0], gain))
  let offset = my - gain * mx

  const recent = pairs.filter((p) => p.t >= nowMs - CALIBRATION_BIAS_H * HOUR_MS)
  if (recent.length >= 6) {
    offset += recent.reduce((a, p) => a + (p.y - (gain * p.x + offset)), 0) / recent.length
  }

  // Le calage est bruite : on ne le suit qu'en partie, le reste restant sur les valeurs par defaut.
  const w = Math.min(1, Math.max(0, m.calibrationWeight))
  gain = (1 - w) * m.defaultGain + w * gain
  offset = (1 - w) * m.defaultOffset + w * offset

  const sse = pairs.reduce((a, p) => a + (p.y - (gain * p.x + offset)) ** 2, 0)
  const sigma = Math.max(MIN_SIGMA, Math.sqrt(sse / n))
  return { gain, offset, sigma, pairs: n, fitted: true }
}

/**
 * Serie du debit au barrage, a l'heure ou il y arrive : chaque mesure de la station de reference est convertie
 * (gain, decalage) puis decalee de son propre delai de propagation.
 *
 * Quand le delai diminue avec le debit, une montee rattrape les valeurs qui la precedent : la crue arrive d'un
 * bloc, comme un front raide. Les arrivees sont alors ramenees a une minute apres la precedente, pour que la serie
 * reste croissante en temps sans perdre la valeur la plus haute.
 */
export function siteFlowSeries(ref: SeriesPoint[], cal: SiteCalibration, m: TurbineModel): SeriesPoint[] {
  const out: SeriesPoint[] = []
  let last = -Infinity
  for (const p of ref) {
    const arrival = Math.max(Date.parse(p.t) + lagMinutes(p.y, m.lag) * MINUTE_MS, last + MINUTE_MS)
    last = arrival
    out.push({ t: new Date(arrival).toISOString(), y: Math.max(0, cal.gain * p.y + cal.offset) })
  }
  return out
}

/**
 * Tient compte de l'inertie de la retenue : un creux de debit sous `stopFlow` ne coupe la turbine qu'apres `holdMin`
 * minutes (le niveau amont redescend d'abord vers son seuil). Pendant ce delai, le debit est releve au seuil d'arret ;
 * un creux plus court est ainsi traverse sans arret, un creux plus long arrete la turbine `holdMin` minutes apres son debut.
 */
export function rideThrough(site: SeriesPoint[], stopFlow: number, holdMin: number): SeriesPoint[] {
  if (!(holdMin > 0)) return site
  let dipStart: number | null = null
  return site.map((p) => {
    const t = Date.parse(p.t)
    if (p.y >= stopFlow) {
      dipStart = null
      return p
    }
    dipStart ??= t
    return t - dipStart < holdMin * MINUTE_MS ? { t: p.t, y: stopFlow } : p
  })
}
