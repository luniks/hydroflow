import { OUTLOOK_HORIZON_MIN } from './constants'
import { fmtDuration } from './format'
import { minutesToReach } from './trend'
import type { ExploitConfig, Range, SeriesAnalysis } from './types'

/** Zone dans laquelle on entre en franchissant un seuil dans un sens, et si c'est une bonne nouvelle pour la production. */
export interface Crossing {
  name: string
  good: boolean
}

export interface TrendBand {
  value: number
  /** Franchissement vers le haut. */
  up?: Crossing
  /** Franchissement vers le bas. */
  down?: Crossing
}

/** Au-dela de cet age (min), la derniere mesure n'est plus « maintenant » et l'indicateur le dit. */
export const TREND_STALE_MIN = 15

/** Seuils d'une station ordinaire : sortir de la plage est a surveiller, y revenir est une bonne nouvelle. */
export function stationBands(range: Range): TrendBand[] {
  return [
    { value: range.low, up: { name: 'Retour', good: true }, down: { name: 'Bas', good: false } },
    { value: range.high, up: { name: 'Haut', good: false }, down: { name: 'Retour', good: true } },
  ]
}

/** Seuils d'exploitation de la station de reference : les noms sont ceux des zones de la jauge. */
export function exploitBands(c: ExploitConfig): TrendBand[] {
  return [
    { value: c.minFlow, up: { name: 'Marche', good: true }, down: { name: 'Arrêt', good: false } },
    { value: c.startFlow, up: { name: 'Démarrage', good: true } },
    { value: c.optMin, up: { name: 'Optimale', good: true }, down: { name: 'Marche', good: false } },
    { value: c.optMax, up: { name: 'Limite', good: false }, down: { name: 'Optimale', good: true } },
    { value: c.maxFlow, up: { name: 'Arrêt', good: false }, down: { name: 'Limite', good: true } },
  ]
}

export interface StationLine {
  arrow: '▲' | '▼' | '▬'
  /** Une ligne courte (18 caracteres environ sur mobile), fleche comprise. */
  text: string
  /** Phrase complete, pour l'infobulle. */
  title: string
  tone: 'neutral' | 'ok' | 'warn'
}

interface LineOptions {
  bands: TrendBand[]
  /** Met en forme une pente par heure dans l'unite de la serie (ex. « +3.20 m³/s/h »). */
  formatRate: (ratePerHour: number) => string
  /** Age (min) de la derniere mesure, `null` quand il n'a pas de sens (periode passee). */
  ageMin: number | null
}

/**
 * Resume une serie en une ligne : prochain seuil franchi (avec delai) si elle y va, sinon palier, sinon pente.
 * Le temps est celui de la station : le delai de propagation vers la turbine n'intervient pas ici.
 */
export function stationLine(analysis: SeriesAnalysis, lastY: number, opts: LineOptions): StationLine {
  let best: { name: string; good: boolean; minutes: number; arrow: '▲' | '▼' } | null = null
  for (const band of opts.bands) {
    const minutes = minutesToReach(analysis, lastY, band.value, OUTLOOK_HORIZON_MIN)
    if (minutes === null || minutes === 0) continue
    const goingUp = lastY < band.value
    const crossing = goingUp ? band.up : band.down
    if (crossing && (best === null || minutes < best.minutes)) {
      best = { ...crossing, minutes, arrow: goingUp ? '▲' : '▼' }
    }
  }

  let line: StationLine
  if (best) {
    line = {
      arrow: best.arrow,
      text: `${best.arrow} ${best.name} ~${fmtDuration(best.minutes)}`,
      title: `${best.name} dans ~${fmtDuration(best.minutes)} à ce rythme (à la station)`,
      tone: best.good ? 'ok' : 'warn',
    }
  } else if (analysis.dir === 'flat') {
    const since = analysis.stableMin === null ? '' : ` ${fmtDuration(analysis.stableMin)}`
    line = {
      arrow: '▬',
      text: analysis.stableMin === null ? '▬ sans tendance' : `▬ stable${since}`,
      title:
        analysis.stableMin === null
          ? 'Aucune tendance significative sur la dernière heure'
          : `Stable depuis ${fmtDuration(analysis.stableMin)}`,
      tone: 'neutral',
    }
  } else {
    const arrow = analysis.dir === 'up' ? '▲' : '▼'
    const rate = opts.formatRate(analysis.ratePerHour)
    line = {
      arrow,
      text: `${arrow} ${rate}`,
      title: analysis.windowMin === null ? rate : `${rate}, mesuré sur ${analysis.windowMin} min`,
      tone: 'neutral',
    }
  }

  if (opts.ageMin !== null && opts.ageMin > TREND_STALE_MIN) {
    const age = fmtDuration(opts.ageMin)
    return { ...line, text: `${line.text} · ${age}`, title: `${line.title}. Dernière mesure il y a ${age}` }
  }
  return line
}
