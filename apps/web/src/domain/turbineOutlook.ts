import {
  flowAnalyzeOptions,
  OUTLOOK_HORIZON_MIN,
  OUTLOOK_STALE_MIN,
  OUTLOOK_WATCH_RATIO,
} from './constants'
import { fmtDuration, fmtQ } from './format'
import { analyzeSeries, projectSeries } from './trend'
import type {
  ExploitConfig,
  OutlookKind,
  OutlookSource,
  OutlookStability,
  SeriesPoint,
  TurbineOutlook,
  TurbineState,
} from './types'

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000

/** Valeur de la serie a l'instant `t` (interpolation lineaire, bornee aux extremites). */
function valueAt(points: SeriesPoint[], times: number[], t: number): number {
  const last = points.length - 1
  if (t <= times[0]!) return points[0]!.y
  if (t >= times[last]!) return points[last]!.y
  let i = 1
  while (times[i]! < t) i++
  const t0 = times[i - 1]!
  const t1 = times[i]!
  const y0 = points[i - 1]!.y
  const y1 = points[i]!.y
  return y0 + ((y1 - y0) * (t - t0)) / (t1 - t0)
}

interface Hit {
  minutes: number
  source: OutlookSource
}

/** La turbine peut demarrer (ou continuer a tourner a plein regime) entre le debit de demarrage et le maximum. */
const canStart = (v: number, c: ExploitConfig): boolean => v >= c.startFlow && v <= c.maxFlow

/**
 * Etat suppose de la turbine, deduit de l'historique du debit : on rejoue les mesures deja arrivees
 * a la turbine (mesure + delai de propagation <= maintenant) avec les regles d'exploitation,
 * en supposant que la turbine demarre des que c'est possible.
 *
 * - arret -> marche : debit de demarrage <= q <= debit maximum ;
 * - marche -> arret : q < debit minimal ou q > debit maximum ;
 * - entre minimal et demarrage, l'etat precedent est conserve (hysteresis).
 *
 * L'etat initial (premiere mesure de l'historique) est « marche » si le debit permet de demarrer,
 * « arret » sinon : plus l'historique affiche est court, plus cette hypothese pese.
 * `points` ne doit pas etre vide.
 */
/** Rejoue des debits successifs : etat final de la turbine et nombre d'arrets / demarrages rencontres. */
export function replayTurbine(
  flows: number[],
  c: ExploitConfig,
): { state: TurbineState; stops: number; starts: number } {
  let state: TurbineState = canStart(flows[0]!, c) ? 'run' : 'stop'
  let stops = 0
  let starts = 0
  for (const y of flows) {
    if (state === 'stop' && canStart(y, c)) {
      state = 'run'
      starts++
    } else if (state === 'run' && (y < c.minFlow || y > c.maxFlow)) {
      state = 'stop'
      stops++
    }
  }
  return { state, stops, starts }
}

export function inferTurbineState(points: SeriesPoint[], c: ExploitConfig, nowMs: number): TurbineState {
  const arrivedBefore = nowMs - c.propagationMin * MINUTE_MS
  const arrived = points.filter((p) => Date.parse(p.t) <= arrivedBefore)
  const seen = arrived.length ? arrived : [points[0]!]

  return replayTurbine(
    seen.map((p) => p.y),
    c,
  ).state
}

/**
 * Anticipe le demarrage ou l'arret de la turbine a partir du debit observe a la station de reference.
 * L'etat de la turbine (marche / arret) est deduit par `inferTurbineState`.
 */
export function turbineOutlook(points: SeriesPoint[], c: ExploitConfig, nowMs: number): TurbineOutlook {
  if (!points.length) return base('unknown', 'neutral', null, null, 'En attente de mesure…')

  const ageMin = (nowMs - Date.parse(points[points.length - 1]!.t)) / MINUTE_MS
  if (ageMin > OUTLOOK_STALE_MIN) {
    return {
      ...base('stale', 'warn', null, null, `Aucune prévision · dernière mesure il y a ${fmtDuration(ageMin)}`),
      detail: `La dernière mesure date de plus de ${fmtDuration(OUTLOOK_STALE_MIN)} : aucune prévision fiable.`,
    }
  }
  return outlookForState(points, c, inferTurbineState(points, c, nowMs), nowMs)
}

/**
 * Prevision pour un etat de turbine donne. Principe : le debit mesure a la station de reference
 * arrive a la turbine apres `propagationMin`.
 * - jusqu'a (derniere mesure + delai), le debit a la turbine est deja connu (source `observed`) ;
 * - au-dela, on prolonge la tendance de la serie (pente significative, courbure si elle est reelle ;
 *   voir `analyzeSeries`, source `estimated`), jusqu'a `OUTLOOK_HORIZON_MIN` minutes.
 *
 * Regles :
 * - en marche, la turbine s'arrete si q < debit minimal ou q > debit maximum ;
 * - a l'arret, elle ne peut demarrer que si debit de demarrage <= q <= debit maximum ;
 * - entre minimal et demarrage, l'etat courant est conserve (hysteresis) ;
 * - « stable » = aucun changement prevu sur l'horizon et marge suffisante vis-a-vis du seuil le plus proche.
 */
export function outlookForState(
  points: SeriesPoint[],
  c: ExploitConfig,
  turbine: TurbineState,
  nowMs: number,
): TurbineOutlook {
  const times = points.map((p) => Date.parse(p.t))
  const lastIdx = points.length - 1
  const lastT = times[lastIdx]!
  const lastY = points[lastIdx]!.y
  const mk = (kind: OutlookKind, tone: TurbineOutlook['tone'], stability: OutlookStability, headline: string) => ({
    ...base(kind, tone, stability, turbine, headline),
    arrival: { atMs: lastT + delayMs, flow: lastY },
  })

  const delayMs = c.propagationMin * MINUTE_MS
  const knownUntil = lastT + delayMs
  const analysis = analyzeSeries(points, flowAnalyzeOptions(lastY))

  /** Debit a la turbine a l'instant `t` : mesure decalee du delai, puis tendance extrapolee. */
  const flowAt = (t: number): number =>
    t <= knownUntil
      ? valueAt(points, times, t - delayMs)
      : projectSeries(analysis, lastY, (t - knownUntil) / HOUR_MS)

  const sourceAt = (t: number): OutlookSource => (t <= knownUntil ? 'observed' : 'estimated')
  const q = flowAt(nowMs)
  const watchMargin = OUTLOOK_WATCH_RATIO * (c.maxFlow - c.minFlow)
  const horizon = fmtDuration(OUTLOOK_HORIZON_MIN)
  const here = `Débit à la turbine ≈ ${fmtQ(q)} m³/s`

  /** Premier instant (a la minute pres) ou `test` devient vrai sur l'horizon. */
  const firstHit = (test: (v: number) => boolean): Hit | null => {
    for (let m = 1; m <= OUTLOOK_HORIZON_MIN; m++) {
      const t = nowMs + m * MINUTE_MS
      if (test(flowAt(t))) return { minutes: m, source: sourceAt(t) }
    }
    return null
  }

  /** Plus petit / plus grand debit attendu sur l'horizon (instant courant inclus). */
  const extremes = () => {
    let lo = q
    let hi = q
    for (let m = 1; m <= OUTLOOK_HORIZON_MIN; m++) {
      const v = flowAt(nowMs + m * MINUTE_MS)
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    return { lo, hi }
  }

  const how = (s: OutlookSource) => (s === 'observed' ? 'débit déjà mesuré en amont' : 'estimé d’après la tendance')
  const wording = (s: OutlookSource, verb: string, minutes: number) =>
    s === 'observed'
      ? `${verb} prévu dans ${fmtDuration(minutes)}`
      : `${verb} probable dans ~${fmtDuration(minutes)}`

  if (turbine === 'run') {
    if (q < c.minFlow) {
      return {
        ...mk('stop-now', 'danger', 'changing', 'Arrêt requis · débit sous le minimal'),
        inMinutes: 0,
        detail: `${here}, sous le débit minimal (${fmtQ(c.minFlow)} m³/s).`,
      }
    }
    if (q > c.maxFlow) {
      return {
        ...mk('stop-now', 'danger', 'changing', 'Arrêt requis · débit au-dessus du maximum'),
        inMinutes: 0,
        detail: `${here}, au-dessus du débit maximum (${fmtQ(c.maxFlow)} m³/s).`,
      }
    }

    const stop = firstHit((v) => v < c.minFlow || v > c.maxFlow)
    if (stop) {
      const low = flowAt(nowMs + stop.minutes * MINUTE_MS) < c.minFlow
      return {
        ...mk('stop-expected', 'warn', 'changing', wording(stop.source, 'Arrêt', stop.minutes)),
        inMinutes: stop.minutes,
        source: stop.source,
        detail: `${here} · ${
          low ? `passage sous le débit minimal (${fmtQ(c.minFlow)} m³/s)` : `dépassement du débit maximum (${fmtQ(c.maxFlow)} m³/s)`
        } · ${how(stop.source)}.`,
      }
    }

    // Objectif de production : rester dans la zone optimale. Un franchissement proche est plus utile que la marge restante.
    const inOptimal = (v: number) => v >= c.optMin && v <= c.optMax
    const timing = (hit: Hit, noun: string) =>
      hit.source === 'observed'
        ? `${noun} prévue dans ${fmtDuration(hit.minutes)}`
        : `${noun} probable dans ~${fmtDuration(hit.minutes)}`
    if (inOptimal(q)) {
      const exit = firstHit((v) => !inOptimal(v))
      if (exit) {
        const edge = flowAt(nowMs + exit.minutes * MINUTE_MS) < c.optMin ? c.optMin : c.optMax
        return {
          ...mk('opt-exit-expected', 'warn', 'changing', timing(exit, 'Sortie de zone optimale')),
          inMinutes: exit.minutes,
          source: exit.source,
          detail: `${here} · sortie de la zone optimale (${fmtQ(edge)} m³/s) · ${how(exit.source)}.`,
        }
      }
    } else {
      const entry = firstHit(inOptimal)
      if (entry) {
        const edge = q < c.optMin ? c.optMin : c.optMax
        return {
          ...mk('opt-entry-expected', 'ok', 'changing', timing(entry, 'Zone optimale')),
          inMinutes: entry.minutes,
          source: entry.source,
          detail: `${here} · entrée dans la zone optimale (${fmtQ(edge)} m³/s) · ${how(entry.source)}.`,
        }
      }
    }

    const { lo, hi } = extremes()
    const gapLow = lo - c.minFlow
    const gapHigh = c.maxFlow - hi
    if (Math.min(gapLow, gapHigh) < watchMargin) {
      const nearLow = gapLow <= gapHigh
      return {
        ...mk('run-watch', 'warn', 'watch', 'En marche · à surveiller'),
        detail: `${here} · reste à ${fmtQ(Math.min(gapLow, gapHigh))} m³/s du débit ${
          nearLow ? `minimal (${fmtQ(c.minFlow)}` : `maximum (${fmtQ(c.maxFlow)}`
        } m³/s) dans les ${horizon}.`,
      }
    }
    return {
      ...mk('run-stable', 'ok', 'stable', 'Production stable'),
      detail: `${here} · aucun arrêt prévu dans les ${horizon}.`,
    }
  }

  // Turbine a l'arret
  if (canStart(q, c)) {
    return {
      ...mk('start-now', 'ok', 'changing', 'Démarrage possible maintenant'),
      inMinutes: 0,
      detail: `${here}, dans la plage de démarrage (${fmtQ(c.startFlow)} à ${fmtQ(c.maxFlow)} m³/s).`,
    }
  }

  const start = firstHit((v) => canStart(v, c))
  if (start) {
    const afterFlood = q > c.maxFlow
    return {
      ...mk(
        'start-expected',
        'accent',
        'changing',
        wording(start.source, afterFlood ? 'Redémarrage' : 'Démarrage', start.minutes),
      ),
      inMinutes: start.minutes,
      source: start.source,
      detail: `${here} · ${
        afterFlood
          ? `retour sous le débit maximum (${fmtQ(c.maxFlow)} m³/s)`
          : `atteinte du débit de démarrage (${fmtQ(c.startFlow)} m³/s)`
      } · ${how(start.source)}.`,
    }
  }

  if (q > c.maxFlow) {
    return {
      ...mk('stopped-blocked', 'danger', 'stable', 'Arrêt · débit trop élevé'),
      detail: `${here}, au-dessus du débit maximum (${fmtQ(c.maxFlow)} m³/s) · pas de redémarrage prévu dans les ${horizon}.`,
    }
  }

  const gapStart = c.startFlow - extremes().hi
  if (gapStart < watchMargin) {
    return {
      ...mk('stopped-watch', 'warn', 'watch', 'Arrêt · proche du seuil de démarrage'),
      detail: `${here} · à ${fmtQ(gapStart)} m³/s du débit de démarrage (${fmtQ(c.startFlow)} m³/s).`,
    }
  }
  return {
    ...mk('stopped-stable', 'neutral', 'stable', 'Arrêt stable'),
    detail: `${here} · en attente du débit de démarrage (${fmtQ(c.startFlow)} m³/s), aucun démarrage prévu dans les ${horizon}.`,
  }
}

function base(
  kind: OutlookKind,
  tone: TurbineOutlook['tone'],
  stability: OutlookStability | null,
  turbine: TurbineState | null,
  headline: string,
): TurbineOutlook {
  return {
    kind,
    tone,
    stability,
    turbine,
    arrival: null,
    inMinutes: null,
    source: null,
    headline,
    detail: null,
  }
}
