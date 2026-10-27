import { describe, expect, it } from 'vitest'
import { DEFAULT_TURBINE_MODEL as M } from './constants'
import { normalCdf, probabilityIn, runningMin, turbineForecast } from './turbineForecast'
import { powerKw } from './turbineModel'
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

describe('turbineForecast · montée et descente progressives', () => {
  const rise = (minAgo: number): number => (minAgo > 30 ? 15 : minAgo < 10 ? 40 : 15 + (25 * (30 - minAgo)) / 20)

  it('la puissance ne varie jamais plus vite que la vitesse de rampe', () => {
    const f = turbineForecast(series(4, rise), [], M, NOW)
    const maxDelta = M.rampKwPerMin * 5
    for (let i = 1; i < f.steps.length; i++) {
      expect(Math.abs(f.steps[i]!.powerKw - f.steps[i - 1]!.powerKw)).toBeLessThanOrEqual(maxDelta + 1e-9)
    }
  })

  it('sans vitesse de rampe, la puissance saute directement à sa valeur', () => {
    const free = turbineForecast(series(4, rise), [], { ...M, rampKwPerMin: 0 }, NOW)
    const jumps = free.steps.map((s, i) => (i ? Math.abs(s.powerKw - free.steps[i - 1]!.powerKw) : 0))
    expect(Math.max(...jumps)).toBeGreaterThan(M.rampKwPerMin * 5)
  })

  it('une turbine démarrée depuis peu n’a pas encore atteint sa puissance finale', () => {
    // Le front vient d’arriver au barrage (il rattrape les eaux plus lentes qui le précèdent) : la turbine tourne, mais monte encore.
    const f = turbineForecast(series(4, (a) => (a > 150 ? 15 : 40)), [], M, NOW)
    expect(f.outlook.turbine).toBe('run')
    expect(f.powerKw!).toBeLessThan(powerKw(M.defaultGain * 40 + M.defaultOffset, M))
  })
})

describe('runningMin', () => {
  const pt = (minAgo: number, y: number): SeriesPoint => ({ t: new Date(NOW - minAgo * MIN).toISOString(), y })

  it('compte depuis quand le débit est au-dessus du seuil d’arrêt', () => {
    expect(runningMin([pt(60, 5), pt(40, 15), pt(20, 16), pt(0, 17)], NOW, 12.55)).toBe(40)
  })

  it('repart de zéro après une interruption', () => {
    expect(runningMin([pt(60, 15), pt(40, 5), pt(20, 15), pt(0, 15)], NOW, 12.55)).toBe(20)
  })

  it('vaut 0 sous le seuil, ou sans mesure', () => {
    expect(runningMin([pt(10, 5), pt(0, 6)], NOW, 12.55)).toBe(0)
    expect(runningMin([], NOW, 12.55)).toBe(0)
  })
})

describe('turbineForecast · inertie de la retenue', () => {
  // Débit amont bas pendant `lowMin` minutes au milieu de la série, sinon élevé.
  const dip = (lowMin: number) => (a: number): number => (a > 140 || a < 140 - lowMin ? 40 : 15)

  it('un creux court ne coupe pas la turbine', () => {
    const f = turbineForecast(series(4, dip(15)), [], M, NOW)
    expect(f.steps.every((s) => s.turbine === 'run')).toBe(true)
  })

  it('un creux long finit par couper la turbine, avec un délai', () => {
    const none = turbineForecast(series(4, dip(70)), [], { ...M, stopHoldMin: 0 }, NOW)
    const held = turbineForecast(series(4, dip(70)), [], { ...M, stopHoldMin: 20 }, NOW)
    const firstStop = (f: typeof none) => f.steps.find((s) => s.turbine === 'stop')?.minute
    expect(firstStop(none)).toBeDefined()
    expect(firstStop(held)).toBeDefined()
    expect(firstStop(held)!).toBeGreaterThan(firstStop(none)!)
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
    expect(f.outlook.inMinutes!).toBeLessThan(120)
    expect(f.powerKw).toBe(0)
    expect(f.steps.at(-1)!.turbine).toBe('run')
    expect(f.steps.at(-1)!.powerKw).toBeGreaterThan(50)
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
    const after = f.steps.find((s) => s.minute === 105)!
    expect(after.turbine).toBe('stop')
    // La puissance redescend progressivement au lieu de tomber à zéro.
    expect(after.powerKw).toBeGreaterThan(0)
    expect(f.steps.at(-1)!.powerKw).toBe(0)
  })

  it('le régime réduit prolonge la production après la baisse sous le seuil', () => {
    const fall = (minAgo: number): number => (minAgo > 30 ? 40 : minAgo < 10 ? 15 : 40 - (25 * (30 - minAgo)) / 20)
    const base = turbineForecast(series(4, fall), [], M, NOW)
    const reduced = turbineForecast(series(4, fall), [], { ...M, reducedMin: 15 }, NOW)
    expect(reduced.energyKwh).toBeGreaterThan(base.energyKwh)
  })
})
