import { flowAnalyzeOptions, OUTLOOK_HORIZON_MIN } from './constants'
import { calibrateSite, siteFlowSeries } from './siteFlow'
import { exploitConfigFromModel, grossHead, powerKw, startFlowOf, stopFlowOf } from './turbineModel'
import { turbineOutlook, valueAt } from './turbineOutlook'
import { analyzeSeries, projectSeries } from './trend'
import type {
  ForecastConfidence,
  ForecastStep,
  SeriesPoint,
  SiteCalibration,
  TurbineForecast,
  TurbineModel,
  TurbineState,
} from './types'

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
/** Pas de la prevision (min). */
export const FORECAST_STEP_MIN = 5
/**
 * Croissance de l'incertitude (m³/s par heure) au-dela du dernier debit deja mesure en amont :
 * la tendance extrapolee est bien moins fiable qu'un debit deja observe.
 */
export const FORECAST_SIGMA_GROWTH = 3
/** Seuils de certitude (probabilite moyenne de l'etat prevu, sur tout l'horizon). */
const HIGH_CERTAINTY = 0.9
const MEDIUM_CERTAINTY = 0.75
/** Marge minimale (m³/s) de « a surveiller » avant un seuil. */
const MIN_WATCH_MARGIN = 1.5
/** Au-dela, le calage est juge peu fiable et la confiance baisse d'un cran. */
const POOR_SIGMA = 3.5

/** Fonction de repartition de la loi normale centree reduite (approximation d'Abramowitz-Stegun, erreur < 1e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  const erf = 1 - poly * Math.exp(-x * x)
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf)
}

/** Probabilite que le debit reel soit dans [low ; high] quand on en attend `mean` avec un ecart-type `sigma`. */
export function probabilityIn(mean: number, sigma: number, low: number, high: number): number {
  if (sigma <= 0) return mean >= low && mean <= high ? 1 : 0
  return normalCdf((high - mean) / sigma) - normalCdf((low - mean) / sigma)
}

function confidenceOf(steps: ForecastStep[], cal: SiteCalibration): ForecastConfidence | null {
  if (!steps.length) return null
  // Moyenne et non minimum : un franchissement de seuil attendu donne par nature une probabilite proche de 0,5 a cet instant.
  const certainty = steps.reduce((a, s) => a + Math.max(s.pRun, 1 - s.pRun), 0) / steps.length
  let level = certainty >= HIGH_CERTAINTY ? 2 : certainty >= MEDIUM_CERTAINTY ? 1 : 0
  if (!cal.fitted || cal.sigma > POOR_SIGMA) level = Math.max(0, level - 1)
  return (['low', 'medium', 'high'] as const)[level]!
}

/**
 * Prevision de production de la turbine.
 *
 * 1. Le debit de la station de reference est converti en debit au barrage (calage glissant sur la station aval)
 *    et decale de son delai de propagation, qui depend du debit.
 * 2. Le debit deja mesure en amont donne le debit au barrage jusqu'a (derniere mesure + delai) ; au-dela, la
 *    tendance est extrapolee avec une incertitude croissante.
 * 3. Le modele turbine en deduit, pas a pas, l'etat (marche / arret), la puissance et la probabilite de marche.
 *
 * `outlook` reprend les cas de `turbineOutlook` (demarrage, arret, stabilite...) mais en debit au barrage.
 */
export function turbineForecast(
  ref: SeriesPoint[],
  down: SeriesPoint[],
  m: TurbineModel,
  nowMs: number,
): TurbineForecast {
  const calibration = calibrateSite(ref, down, m, nowMs)
  const site = siteFlowSeries(ref, calibration, m)
  // La marge de surveillance suit l'incertitude du calage : la plage [minimal ; maximum] est ici tres large (crue).
  const cfg = exploitConfigFromModel(m, Math.max(MIN_WATCH_MARGIN, calibration.sigma))
  const outlook = turbineOutlook(site, cfg, nowMs)
  const empty: TurbineForecast = {
    outlook,
    calibration,
    siteFlow: null,
    powerKw: null,
    steps: [],
    siteSeries: site,
    energyKwh: 0,
    pRun: null,
    confidence: null,
  }
  if (outlook.turbine === null || !site.length) return empty

  const times = site.map((p) => Date.parse(p.t))
  const lastIdx = site.length - 1
  const knownUntil = times[lastIdx]!
  const lastY = site[lastIdx]!.y
  const analysis = analyzeSeries(site, flowAnalyzeOptions(lastY))
  const flowAt = (t: number): number =>
    t <= knownUntil ? valueAt(site, times, t) : projectSeries(analysis, lastY, (t - knownUntil) / HOUR_MS)

  const start = startFlowOf(m)
  const stop = stopFlowOf(m)
  const steps: ForecastStep[] = []
  let state: TurbineState = outlook.turbine
  let reducedLeft = 0
  let energy = 0

  for (let minute = 0; minute <= OUTLOOK_HORIZON_MIN; minute += FORECAST_STEP_MIN) {
    const atMs = nowMs + minute * MINUTE_MS
    const flow = flowAt(atMs)
    const extraH = Math.max(0, atMs - knownUntil) / HOUR_MS
    const sigma = Math.hypot(calibration.sigma, FORECAST_SIGMA_GROWTH * extraH)
    const headOk = grossHead(flow, m) >= m.headMin

    if (state === 'stop' && flow >= start && headOk) state = 'run'
    else if (state === 'run' && (flow < stop || !headOk)) {
      state = 'stop'
      if (flow < stop) reducedLeft = m.reducedMin
    }

    const threshold = state === 'run' ? stop : start
    const pRun = probabilityIn(flow, sigma, threshold, cfg.maxFlow)
    let power = state === 'run' ? powerKw(flow, m) : 0
    if (state === 'stop' && reducedLeft > 0) {
      power = m.reducedPowerKw
      reducedLeft -= FORECAST_STEP_MIN
    }
    if (minute > 0) energy += (power * FORECAST_STEP_MIN) / 60
    steps.push({ minute, atMs, flow, sigma, source: atMs <= knownUntil ? 'observed' : 'estimated', turbine: state, pRun, powerKw: power })
  }

  const at = (min: number): number => steps.find((s) => s.minute === min)?.pRun ?? 0
  return {
    outlook,
    calibration,
    siteFlow: steps[0]!.flow,
    powerKw: steps[0]!.powerKw,
    steps,
    siteSeries: site,
    energyKwh: energy,
    pRun: { m30: at(30), m60: at(60), m120: at(120) },
    confidence: confidenceOf(steps, calibration),
  }
}
