import { describe, expect, it } from 'vitest'
import {
  defaultRainAlert,
  effectiveAlertThreshold,
  forecastHorizon,
  rainAggregate,
  rainLevel,
  rainTotals,
  rainWindow,
  sumRainRange,
} from './rain'
import type { RainOrigin, RainPoint, RainState } from './types'

const NOW = Date.parse('2026-01-01T12:00:00Z')
const HOUR = 3_600_000

/** Serie horaire de -24 h a +48 h, `mm` mm a chaque heure. */
function hourly(mm: number): Pick<RainState, 'times' | 'values'> {
  const times: string[] = []
  const values: number[] = []
  for (let h = -24; h <= 48; h++) {
    times.push(new Date(NOW + h * HOUR).toISOString())
    values.push(mm)
  }
  return { times, values }
}

const point = (key: string, origin: RainOrigin): RainPoint => ({
  key,
  origin,
  name: key,
  label: 'Amont',
  context: '',
  lat: 0,
  lon: 0,
  storagePrefix: `rain_${key}_`,
  defaultThreshold: origin === 'external' ? 30 : 35,
})

const state = (over: Partial<RainState> = {}): RainState => ({
  times: [],
  values: [],
  threshold: 30,
  alertThreshold: 45,
  error: null,
  fetching: false,
  ...over,
})

describe('sumRainRange', () => {
  it('retourne 0 sur une série vide', () => {
    expect(sumRainRange([], [], NOW - HOUR, NOW)).toBe(0)
  })

  it('exclut la borne basse et inclut la borne haute', () => {
    const times = [NOW - HOUR, NOW, NOW + HOUR].map((t) => new Date(t).toISOString())
    expect(sumRainRange(times, [1, 2, 4], NOW - HOUR, NOW)).toBe(2)
  })

  it('traite les valeurs manquantes comme zéro', () => {
    const times = [NOW, NOW + HOUR].map((t) => new Date(t).toISOString())
    expect(sumRainRange(times, [1], NOW - HOUR, NOW + HOUR)).toBe(1)
  })
})

describe('forecastHorizon', () => {
  it('donne 48 h en amont du bassin et 24 h sur les stations', () => {
    expect(forecastHorizon('external')).toBe(48)
    expect(forecastHorizon('station')).toBe(24)
  })
})

describe('defaultRainAlert', () => {
  it('applique 1,5 × le seuil arrondi à 5 mm', () => {
    expect(defaultRainAlert(30)).toBe(45)
    expect(defaultRainAlert(35)).toBe(55)
    expect(defaultRainAlert(0)).toBe(0)
  })
})

describe('rainLevel', () => {
  it('remonte alerte au-dessus du seuil d’alerte', () => {
    expect(rainLevel(45, state())).toBe('alert')
    expect(rainLevel(100, state())).toBe('alert')
  })

  it('remonte vigilance entre les deux seuils', () => {
    expect(rainLevel(30, state())).toBe('warn')
    expect(rainLevel(44.9, state())).toBe('warn')
  })

  it('ne remonte rien sous le seuil de vigilance', () => {
    expect(rainLevel(29.9, state())).toBeNull()
  })

  it('empêche une alerte sous la vigilance', () => {
    const st = state({ threshold: 50, alertThreshold: 10 })
    expect(effectiveAlertThreshold(st)).toBe(50)
    expect(rainLevel(50, st)).toBe('alert')
    expect(rainLevel(49, st)).toBeNull()
  })
})

describe('rainWindow', () => {
  it('aligne la fenêtre sur l’heure pleine', () => {
    const w = rainWindow('station', NOW + 42 * 60_000)
    expect(w.startMs).toBe(NOW - 24 * HOUR)
    expect(w.endMs).toBe(NOW + 24 * HOUR)
  })

  it('étend la fenêtre à 48 h pour les points amont', () => {
    expect(rainWindow('external', NOW).endMs).toBe(NOW + 48 * HOUR)
  })
})

describe('rainTotals', () => {
  it('somme le tombé 24 h et le prévu sur l’horizon de la station', () => {
    const t = rainTotals(hourly(1), 'station', NOW)
    expect(t.tombe).toBe(24)
    expect(t.prevu).toBe(24)
    expect(t.total).toBe(48)
    expect(t.horizon).toBe(24)
  })

  it('utilise un horizon de 48 h en amont du bassin', () => {
    const t = rainTotals(hourly(1), 'external', NOW)
    expect(t.prevu).toBe(48)
    expect(t.total).toBe(72)
  })
})

describe('rainAggregate', () => {
  it('retourne null sans point de cette origine', () => {
    expect(rainAggregate([], {}, 'external', NOW)).toBeNull()
  })

  it('ignore les points sans données', () => {
    const points = [point('a', 'external')]
    expect(rainAggregate(points, { a: state() }, 'external', NOW)).toBeNull()
  })

  it('moyenne les points et filtre sur l’origine', () => {
    const points = [point('a', 'external'), point('b', 'external'), point('c', 'station')]
    const states = {
      a: state(hourly(1)),
      b: state(hourly(0)),
      c: state(hourly(5)),
    }
    const agg = rainAggregate(points, states, 'external', NOW)!
    expect(agg.rows).toHaveLength(2)
    expect(agg.horizon).toBe(48)
    expect(agg.total).toBeCloseTo(36)
    expect(agg.tombe).toBeCloseTo(12)
    expect(agg.prevu).toBeCloseTo(24)
  })

  it('retient le niveau le plus élevé parmi les points', () => {
    const points = [point('a', 'external'), point('b', 'external')]
    const calm = state({ ...hourly(0), threshold: 30, alertThreshold: 45 })
    const warn = state({ ...hourly(0.5), threshold: 30, alertThreshold: 45 })
    const alert = state({ ...hourly(1), threshold: 30, alertThreshold: 45 })

    expect(rainAggregate(points, { a: calm, b: calm }, 'external', NOW)!.level).toBeNull()
    expect(rainAggregate(points, { a: calm, b: warn }, 'external', NOW)!.level).toBe('warn')
    expect(rainAggregate(points, { a: warn, b: alert }, 'external', NOW)!.level).toBe('alert')
  })
})
