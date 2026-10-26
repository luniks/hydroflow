import { describe, expect, it } from 'vitest'
import { DEFAULT_TURBINE_MODEL as M } from './constants'
import { normalCdf, probabilityIn, turbineForecast } from './turbineForecast'
import type { SeriesPoint } from './types'

const NOW = Date.parse('2026-10-26T12:00:00Z')
const MIN = 60_000

/** Série de débit amont (m³/s) toutes les 5 min, définie par `f(minutes écoulées)` sur les `hours` dernières heures. */
function series(hours: number, f: (minAgo: number) => number): SeriesPoint[] {
  const out: SeriesPoint[] = []
  for (let a = hours * 60; a >= 0; a -= 5) out.push({ t: new Date(NOW - a * MIN).toISOString(), y: f(a) })
  return out
}

// Sans mesures aval, le calage retombe sur les valeurs par défaut : gain 0,572 et décalage -1,3.
const site = (ref: number): number => M.defaultGain * ref + M.defaultOffset

describe('normalCdf / probabilityIn', () => {
  it('vaut 0,5 en 0 et suit la loi normale', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6)
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3)
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3)
  })

  it('probabilité d’être dans un intervalle', () => {
    expect(probabilityIn(10, 1, 9, 11)).toBeCloseTo(0.6827, 3)
    expect(probabilityIn(20, 1, 9, 11)).toBeLessThan(0.001)
    expect(probabilityIn(10, 0, 9, 11)).toBe(1)
    expect(probabilityIn(12, 0, 9, 11)).toBe(0)
  })
})

describe('turbineForecast · cas sans prévision', () => {
  it('attend une mesure', () => {
    const f = turbineForecast([], [], M, NOW)
    expect(f.outlook.kind).toBe('unknown')
    expect(f.steps).toHaveLength(0)
    expect(f.powerKw).toBeNull()
    expect(f.pRun).toBeNull()
    expect(f.confidence).toBeNull()
  })

  it('refuse de prévoir à partir de mesures trop anciennes', () => {
    const old = series(2, () => 30).map((p) => ({ ...p, t: new Date(Date.parse(p.t) - 8 * 3_600_000).toISOString() }))
    const f = turbineForecast(old, [], M, NOW)
    expect(f.outlook.kind).toBe('stale')
    expect(f.steps).toHaveLength(0)
  })
})

describe('turbineForecast · débit stable', () => {
  it('turbine en marche et production stable quand le débit est largement suffisant', () => {
    const f = turbineForecast(series(4, () => 40), [], M, NOW)
    expect(site(40)).toBeGreaterThan(20)
    expect(f.outlook.turbine).toBe('run')
    expect(f.outlook.kind).toBe('run-stable')
    expect(f.siteFlow).toBeCloseTo(site(40), 1)
    expect(f.powerKw!).toBeGreaterThan(300)
    expect(f.pRun!.m60).toBeGreaterThan(0.95)
    expect(f.confidence).toBe('medium')
    expect(f.energyKwh).toBeGreaterThan(500)
  })

  it('arrêt stable quand le débit reste sous le seuil de démarrage', () => {
    const f = turbineForecast(series(4, () => 15), [], M, NOW)
    expect(site(15)).toBeLessThan(10)
    expect(f.outlook.turbine).toBe('stop')
    expect(f.outlook.kind).toBe('stopped-stable')
    expect(f.powerKw).toBe(0)
    expect(f.energyKwh).toBe(0)
    expect(f.pRun!.m60).toBeLessThan(0.05)
  })
})

describe('turbineForecast · éclusée', () => {
  // Débit amont bas (15 m³/s) qui monte à 40 m³/s entre il y a 30 et il y a 10 minutes : le front arrive à la turbine dans ~1 h.
  const rise = (minAgo: number): number => (minAgo > 30 ? 15 : minAgo < 10 ? 40 : 15 + (25 * (30 - minAgo)) / 20)

  it('annonce le démarrage avant que la turbine ne tourne', () => {
    const f = turbineForecast(series(4, rise), [], M, NOW)
    expect(f.outlook.turbine).toBe('stop')
    expect(f.outlook.kind).toBe('start-expected')
    expect(f.outlook.source).toBe('observed')
    expect(f.outlook.inMinutes!).toBeGreaterThan(30)
    expect(f.outlook.inMinutes!).toBeLessThan(90)
    expect(f.powerKw).toBe(0)
    expect(f.steps.at(-1)!.turbine).toBe('run')
    expect(f.steps.at(-1)!.powerKw).toBeGreaterThan(100)
    expect(f.energyKwh).toBeGreaterThan(0)
    expect(f.pRun!.m120).toBeGreaterThan(f.pRun!.m30)
  })

  it('l’incertitude croît au-delà du dernier débit mesuré en amont', () => {
    const f = turbineForecast(series(4, rise), [], M, NOW)
    const first = f.steps[0]!
    const last = f.steps.at(-1)!
    expect(first.source).toBe('observed')
    expect(last.source).toBe('estimated')
    expect(last.sigma).toBeGreaterThan(first.sigma)
  })

  it('annonce l’arrêt à la décrue', () => {
    const fall = (minAgo: number): number => (minAgo > 30 ? 40 : minAgo < 10 ? 15 : 40 - (25 * (30 - minAgo)) / 20)
    const f = turbineForecast(series(4, fall), [], M, NOW)
    expect(f.outlook.turbine).toBe('run')
    expect(f.outlook.kind).toBe('stop-expected')
    const after = f.steps.find((s) => s.minute === 90)!
    expect(after.turbine).toBe('stop')
    expect(after.powerKw).toBe(0)
  })

  it('le régime réduit prolonge la production après la baisse sous le seuil', () => {
    const fall = (minAgo: number): number => (minAgo > 30 ? 40 : minAgo < 10 ? 15 : 40 - (25 * (30 - minAgo)) / 20)
    const base = turbineForecast(series(4, fall), [], M, NOW)
    const reduced = turbineForecast(series(4, fall), [], { ...M, reducedMin: 15 }, NOW)
    expect(reduced.energyKwh).toBeGreaterThan(base.energyKwh)
  })
})
