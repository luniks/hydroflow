import { flowAnalyzeOptions, OUTLOOK_HORIZON_MIN } from './constants'
import { calibrateSite, rideThrough, siteFlowSeries } from './siteFlow'
import { exploitConfigFromModel, grossHead, powerKw, startFlowOf, stopFlowOf } from './turbineModel'
import { turbineOutlook, valueAt } from './turbineOutlook'
import { analyzeSeries, projectSeries } from './trend'
import type {
  ForecastStep,
  SeriesPoint,
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
/** Marge minimale (m³/s) de « a surveiller » avant un seuil. */
const MIN_WATCH_MARGIN = 1.5
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
  const site = rideThrough(siteFlowSeries(ref, calibration, m), stopFlowOf(m), m.stopHoldMin)
  // La marge de surveillance suit l'incertitude du calage : la plage [minimal ; maximum] est ici tres large (crue).
  const cfg = exploitConfigFromModel(m, Math.max(MIN_WATCH_MARGIN, calibration.sigma))
  // La peremption se juge sur la date de la mesure, pas sur son arrivee au barrage (decalee du delai de propagation).
  const measuredAtMs = ref.length ? Date.parse(ref[ref.length - 1]!.t) : undefined
  const outlook = turbineOutlook(site, cfg, nowMs, measuredAtMs)
  const empty: TurbineForecast = {
    outlook,
    calibration,
    siteFlow: null,
    powerKw: null,
    steps: [],
    siteSeries: site,
    energyKwh: 0,
    pRun: null,
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
  // La turbine suit le niveau amont : elle monte et descend progressivement. On part de ce que la montee
  // en cours permet d'avoir atteint depuis le demarrage, puis la puissance suit la cible a vitesse limitee.
  const maxDelta = m.rampKwPerMin > 0 ? m.rampKwPerMin * FORECAST_STEP_MIN : Infinity
  let power = 0

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
    let target = state === 'run' ? powerKw(flow, m) : 0
    if (state === 'stop' && reducedLeft > 0) {
      target = m.reducedPowerKw
      reducedLeft -= FORECAST_STEP_MIN
    }
    if (minute === 0) {
      power = state === 'run' ? Math.min(target, m.rampKwPerMin > 0 ? m.rampKwPerMin * runningMin(site, nowMs, stop) : target) : 0
    } else {
      power += Math.max(-maxDelta, Math.min(maxDelta, target - power))
      energy += (power * FORECAST_STEP_MIN) / 60
    }
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
  }
}

/**
 * Duree (min) pendant laquelle le debit au barrage est reste au-dessus du debit d'arret jusqu'a `nowMs`,
 * c'est-a-dire depuis combien de temps la turbine tourne si elle tourne.
 */
export function runningMin(site: SeriesPoint[], nowMs: number, stopFlow: number): number {
  let startMs: number | null = null
  for (let i = site.length - 1; i >= 0; i--) {
    const p = site[i]!
    const t = Date.parse(p.t)
    if (t > nowMs) continue
    if (p.y < stopFlow) break
    startMs = t
  }
  return startMs === null ? 0 : Math.max(0, (nowMs - startMs) / MINUTE_MS)
}
