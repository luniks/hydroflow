import { describe, expect, it } from 'vitest'
import { DEFAULT_TURBINE_MODEL as M } from './constants'
import { calibrateSite, dropFrozen, lagMinutes, rideThrough, siteFlowSeries } from './siteFlow'
import type { SeriesPoint, SiteCalibration } from './types'

const NOW = Date.parse('2026-10-26T12:00:00Z')
const MIN = 60_000

describe('lagMinutes', () => {
  it('est constant au-dessus du débit de référence', () => {
    expect(lagMinutes(30, M.lag)).toBe(90)
    expect(lagMinutes(60, M.lag)).toBe(90)
  })

  it('augmente quand le débit baisse (onde plus lente)', () => {
    expect(lagMinutes(24, M.lag)).toBeGreaterThan(95)
    expect(lagMinutes(24, M.lag)).toBeLessThan(105)
    expect(lagMinutes(12, M.lag)).toBeGreaterThan(lagMinutes(24, M.lag))
    expect(lagMinutes(12, M.lag)).toBeCloseTo(142.3, 0)
  })

  it('est plafonné et gère un débit nul', () => {
    expect(lagMinutes(0.1, M.lag)).toBe(M.lag.maxMin)
    expect(lagMinutes(0, M.lag)).toBe(M.lag.maxMin)
    expect(lagMinutes(Number.NaN, M.lag)).toBe(M.lag.maxMin)
  })
})

/** Débit amont sinusoïdal (33–41 m³/s, période 6 h) toutes les 10 min sur `hours` heures jusqu'à NOW. */
function refSeries(hours: number): SeriesPoint[] {
  const out: SeriesPoint[] = []
  for (let t = NOW - hours * 60 * MIN; t <= NOW; t += 10 * MIN) {
    out.push({ t: new Date(t).toISOString(), y: 37 + 4 * Math.sin((2 * Math.PI * t) / (6 * 60 * MIN)) })
  }
  return out
}

/** Débit aval synthétique : gain * amont décalé de 105 min (délai nominal jusqu'à l'aval) + décalage. */
function downSeries(gain: number, offset: number): SeriesPoint[] {
  const lag = lagMinutes(37, M.lag) * M.downLagRatio * MIN
  const out: SeriesPoint[] = []
  for (let t = NOW - 70 * 60 * MIN; t <= NOW; t += 10 * MIN) {
    const ref = 37 + 4 * Math.sin((2 * Math.PI * (t - lag)) / (6 * 60 * MIN))
    out.push({ t: new Date(t).toISOString(), y: gain * ref + offset })
  }
  return out
}

describe('calibrateSite', () => {
  it('retombe sur les valeurs par défaut sans mesures aval', () => {
    const c = calibrateSite(refSeries(80), [], M, NOW)
    expect(c).toMatchObject({ gain: M.defaultGain, offset: M.defaultOffset, fitted: false, pairs: 0 })
  })

  it('retombe sur les valeurs par défaut avec trop peu de couples', () => {
    const few = downSeries(0.5, 2).slice(-10)
    expect(calibrateSite(refSeries(80), few, M, NOW).fitted).toBe(false)
  })

  const FULL = { ...M, fitGain: true, calibrationWeight: 1 }

  it('retrouve le gain et le décalage d’une relation connue', () => {
    const c = calibrateSite(refSeries(80), downSeries(0.5, 2), FULL, NOW)
    expect(c.fitted).toBe(true)
    expect(c.gain).toBeCloseTo(0.5, 1)
    expect(c.offset).toBeCloseTo(2, 0)
    expect(c.sigma).toBeLessThan(1)
  })

  it('suit un changement de rapport entre les stations (travaux)', () => {
    const a = calibrateSite(refSeries(80), downSeries(0.5, 2), FULL, NOW)
    const b = calibrateSite(refSeries(80), downSeries(0.4, 5), FULL, NOW)
    expect(b.gain).toBeLessThan(a.gain)
  })

  it('garde le gain par défaut si le débit de référence ne varie presque pas', () => {
    const flat: SeriesPoint[] = []
    for (let t = NOW - 80 * 60 * MIN; t <= NOW; t += 10 * MIN) flat.push({ t: new Date(t).toISOString(), y: 25 })
    const down = flat.map((p, i) => ({ t: p.t, y: i % 2 ? 12.1 : 12 }))
    const c = calibrateSite(flat, down, FULL, NOW)
    expect(c.fitted).toBe(true)
    expect(c.gain).toBe(M.defaultGain)
    expect(c.gain * 25 + c.offset).toBeCloseTo(12.05, 1)
  })

  it('ne suit le calage aval qu’en partie par défaut (gain fixe, décalage à moitié)', () => {
    const down = downSeries(0.5, 2)
    const part = calibrateSite(refSeries(80), down, M, NOW)
    const full = calibrateSite(refSeries(80), down, { ...M, calibrationWeight: 1 }, NOW)
    const none = calibrateSite(refSeries(80), down, { ...M, calibrationWeight: 0 }, NOW)
    expect(part.gain).toBe(M.defaultGain)
    expect(none.offset).toBe(M.defaultOffset)
    expect(part.offset).toBeCloseTo((full.offset + M.defaultOffset) / 2, 6)
  })
})

describe('siteFlowSeries', () => {
  const cal: SiteCalibration = { gain: 0.5, offset: 1, sigma: 1, pairs: 100, fitted: true }
  const pt = (minAgo: number, y: number): SeriesPoint => ({ t: new Date(NOW - minAgo * MIN).toISOString(), y })

  it('convertit puis décale chaque mesure de son propre délai', () => {
    const [p] = siteFlowSeries([pt(0, 30)], cal, M)
    expect(p!.y).toBeCloseTo(16, 6)
    expect(Date.parse(p!.t)).toBe(NOW + 90 * MIN)
  })

  it('décale davantage les faibles débits', () => {
    const [hi] = siteFlowSeries([pt(0, 30)], cal, M)
    const [lo] = siteFlowSeries([pt(0, 10)], cal, M)
    expect(Date.parse(lo!.t) - NOW).toBeGreaterThan(Date.parse(hi!.t) - NOW)
  })

  it('ramène à une minute après la précédente une arrivée qui la devancerait (front raide)', () => {
    // 10 m³/s (délai long) suivi, 5 min plus tard, de 30 m³/s (délai court) qui arriverait avant.
    const out = siteFlowSeries([pt(10, 10), pt(5, 30)], cal, M)
    expect(out).toHaveLength(2)
    expect(Date.parse(out[1]!.t) - Date.parse(out[0]!.t)).toBe(MIN)
    expect(out[1]!.y).toBeCloseTo(16, 6)
  })

  it('ne produit jamais de débit négatif', () => {
    const [p] = siteFlowSeries([pt(0, 1)], { ...cal, offset: -5 }, M)
    expect(p!.y).toBe(0)
  })
})

describe('dropFrozen', () => {
  const at = (min: number, y: number): SeriesPoint => ({ t: new Date(NOW + min * MIN).toISOString(), y })

  it('écarte une valeur identique répétée pendant au moins 90 min', () => {
    const pts = [at(0, 5), at(5, 6.44), ...Array.from({ length: 20 }, (_, i) => at(10 + 5 * i, 6.44)), at(110, 6.7)]
    expect(dropFrozen(pts).map((p) => p.y)).toEqual([5, 6.7])
  })

  it('garde une valeur stable plus courte (étiage, pas de capteur figé)', () => {
    const pts = Array.from({ length: 10 }, (_, i) => at(5 * i, 6.44))
    expect(dropFrozen(pts)).toHaveLength(10)
  })

  it('est sans effet sur une série qui varie', () => {
    const pts = Array.from({ length: 30 }, (_, i) => at(5 * i, 6 + (i % 3) * 0.1))
    expect(dropFrozen(pts)).toHaveLength(30)
  })

  it('ne retient pas, au calage, un aval figé', () => {
    const frozen: SeriesPoint[] = []
    const ref: SeriesPoint[] = []
    for (let t = NOW - 80 * 60 * MIN; t <= NOW; t += 10 * MIN) {
      ref.push({ t: new Date(t).toISOString(), y: 37 + 4 * Math.sin((2 * Math.PI * t) / (6 * 60 * MIN)) })
      frozen.push({ t: new Date(t).toISOString(), y: 6.44 })
    }
    expect(calibrateSite(ref, frozen, M, NOW).fitted).toBe(false)
  })
})

describe('rideThrough', () => {
  const at = (min: number, y: number): SeriesPoint => ({ t: new Date(NOW + min * MIN).toISOString(), y })
  const series = (lowMinutes: number): SeriesPoint[] => {
    const out: SeriesPoint[] = []
    for (let m = 0; m <= 120; m += 5) out.push(at(m, m >= 30 && m < 30 + lowMinutes ? 8 : 15))
    return out
  }

  it('traverse un creux plus court que la durée de maintien', () => {
    expect(rideThrough(series(15), 12.55, 20).every((p) => p.y >= 12.55)).toBe(true)
  })

  it('un creux plus long ne coupe la turbine qu’après la durée de maintien', () => {
    const out = rideThrough(series(60), 12.55, 20)
    const idx = (min: number) => out.findIndex((p) => Date.parse(p.t) === NOW + min * MIN)
    expect(out[idx(45)]!.y).toBe(12.55)
    expect(out[idx(50)]!.y).toBe(8)
  })

  it('un nouveau creux relance le décompte', () => {
    const pts = [at(0, 15), at(5, 8), at(10, 15), at(15, 8), at(35, 8), at(40, 8)]
    expect(rideThrough(pts, 12.55, 20).map((p) => p.y)).toEqual([15, 12.55, 15, 12.55, 8, 8])
  })

  it('sans durée de maintien, la série est inchangée', () => {
    const s = series(60)
    expect(rideThrough(s, 12.55, 0)).toBe(s)
  })
})
