import { describe, expect, it } from 'vitest'
import { DEFAULT_TURBINE_MODEL as M } from './constants'
import { periodAverages } from './periodAverages'
import { powerKw } from './turbineModel'
import type { SeriesPoint } from './types'

const NOW = Date.parse('2026-10-26T12:00:00Z')
const MIN = 60_000
const at = (minAgo: number, y: number): SeriesPoint => ({ t: new Date(NOW - minAgo * MIN).toISOString(), y })

describe('periodAverages', () => {
  it('ne rend rien sans durée couverte', () => {
    expect(periodAverages([], M, NOW)).toBeNull()
    expect(periodAverages([at(0, 40)], M, NOW)).toBeNull()
    expect(periodAverages([at(120, 40), at(0, 40)], M, NOW)).toBeNull()
  })

  it('pondère les moyennes par la durée et calcule l’énergie', () => {
    // Une mesure toutes les 10 min (sous le seuil de trou de 15 min) ; la derniere (20 m³/s) ne vaut que par sa fin.
    const site = [60, 50, 40, 30, 20, 10].map((a) => at(a, 40)).concat(at(0, 20))
    const r = periodAverages(site, M, NOW)!
    expect(r.coverageMin).toBe(60)
    expect(r.avgFlow).toBe(40)
    expect(r.minFlow).toBe(40)
    expect(r.maxFlow).toBe(40)
    expect(r.avgPowerKw).toBeCloseTo(powerKw(40, M), 6)
    expect(r.peakPowerKw).toBeCloseTo(powerKw(40, M), 6)
    expect(r.energyKwh).toBeCloseTo(powerKw(40, M), 6)
  })

  it('ignore les mesures pas encore arrivées et les trous de données', () => {
    const site = [at(90, 40), at(80, 40), at(10, 40), at(5, 40), at(0, 40), at(-10, 5)]
    const r = periodAverages(site, M, NOW)!
    expect(r.coverageMin).toBe(10 + 5 + 5)
    expect(r.minFlow).toBe(40)
  })
})
