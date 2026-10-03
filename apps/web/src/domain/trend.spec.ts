import { describe, expect, it } from 'vitest'
import { flowFlatThreshold, LEVEL_FLAT_THRESHOLD } from './constants'
import { computeTrend } from './trend'
import type { SeriesPoint } from './types'

const BASE = Date.parse('2026-01-01T12:00:00Z')
const at = (minutesAgo: number, y: number): SeriesPoint => ({
  t: new Date(BASE - minutesAgo * 60_000).toISOString(),
  y,
})

describe('computeTrend', () => {
  it('retourne plat sur une série vide', () => {
    expect(computeTrend([], LEVEL_FLAT_THRESHOLD)).toEqual({ dir: 'flat', ratePerHour: 0 })
  })

  it('retourne plat sur un point unique', () => {
    expect(computeTrend([at(0, 1.2)], LEVEL_FLAT_THRESHOLD)).toEqual({ dir: 'flat', ratePerHour: 0 })
  })

  it('détecte une hausse via le point à 1 h', () => {
    const points = [at(120, 1.0), at(60, 1.0), at(30, 1.1), at(0, 1.2)]
    const trend = computeTrend(points, LEVEL_FLAT_THRESHOLD)
    expect(trend.dir).toBe('up')
    expect(trend.ratePerHour).toBeCloseTo(0.2)
  })

  it('détecte une baisse', () => {
    const points = [at(60, 2.0), at(0, 1.5)]
    const trend = computeTrend(points, LEVEL_FLAT_THRESHOLD)
    expect(trend.dir).toBe('down')
    expect(trend.ratePerHour).toBeCloseTo(-0.5)
  })

  it('reste plat sous la tolérance', () => {
    const points = [at(60, 1.0), at(0, 1.004)]
    expect(computeTrend(points, LEVEL_FLAT_THRESHOLD).dir).toBe('flat')
  })

  it('reste plat exactement à la tolérance', () => {
    const points = [at(60, 1.0), at(0, 1 + LEVEL_FLAT_THRESHOLD)]
    expect(computeTrend(points, LEVEL_FLAT_THRESHOLD).dir).toBe('flat')
  })

  it("retombe sur le point le plus ancien quand l'historique est plus court qu'une heure", () => {
    const points = [at(30, 1.0), at(15, 1.1), at(0, 1.2)]
    const trend = computeTrend(points, LEVEL_FLAT_THRESHOLD)
    expect(trend.ratePerHour).toBeCloseTo(0.4)
  })

  it('choisit le point le plus récent antérieur à 1 h sur une série éparse', () => {
    const points = [at(300, 0), at(180, 5), at(90, 1.0), at(0, 1.3)]
    const trend = computeTrend(points, LEVEL_FLAT_THRESHOLD)
    expect(trend.ratePerHour).toBeCloseTo(0.2)
  })

  it('plafonne le pas de temps à 0,01 h pour éviter une division par zéro', () => {
    const points = [at(0, 1.0), at(0, 1.1)]
    expect(computeTrend(points, LEVEL_FLAT_THRESHOLD).ratePerHour).toBeCloseTo(10)
  })

  it('applique la tolérance relative du débit', () => {
    expect(flowFlatThreshold(10)).toBeCloseTo(0.2)
    expect(flowFlatThreshold(0)).toBeCloseTo(0.05)
    expect(flowFlatThreshold(-10)).toBeCloseTo(0.2)
    const points = [at(60, 10), at(0, 10.1)]
    expect(computeTrend(points, flowFlatThreshold(10)).dir).toBe('flat')
    expect(computeTrend(points, flowFlatThreshold(1)).dir).toBe('up')
  })
})
