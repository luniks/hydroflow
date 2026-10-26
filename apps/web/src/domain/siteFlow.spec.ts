import { describe, expect, it } from 'vitest'
import { DEFAULT_TURBINE_MODEL as M } from './constants'
import { calibrateSite, lagMinutes, siteFlowSeries } from './siteFlow'
import type { SeriesPoint, SiteCalibration } from './types'

const NOW = Date.parse('2026-10-26T12:00:00Z')
const MIN = 60_000

describe('lagMinutes', () => {
  it('est constant au-dessus du débit de référence', () => {
    expect(lagMinutes(20, M.lag)).toBe(91)
    expect(lagMinutes(60, M.lag)).toBe(91)
  })

  it('augmente quand le débit baisse (onde plus lente)', () => {
    expect(lagMinutes(12, M.lag)).toBeGreaterThan(lagMinutes(20, M.lag))
    expect(lagMinutes(12, M.lag)).toBeGreaterThan(110)
    expect(lagMinutes(12, M.lag)).toBeLessThan(125)
  })

  it('est plafonné et gère un débit nul', () => {
    expect(lagMinutes(0.1, M.lag)).toBe(M.lag.maxMin)
    expect(lagMinutes(0, M.lag)).toBe(M.lag.maxMin)
    expect(lagMinutes(Number.NaN, M.lag)).toBe(M.lag.maxMin)
  })
})

/** Débit amont sinusoïdal (21–29 m³/s, période 6 h) toutes les 10 min sur `hours` heures jusqu'à NOW. */
function refSeries(hours: number): SeriesPoint[] {
  const out: SeriesPoint[] = []
  for (let t = NOW - hours * 60 * MIN; t <= NOW; t += 10 * MIN) {
    out.push({ t: new Date(t).toISOString(), y: 25 + 4 * Math.sin((2 * Math.PI * t) / (6 * 60 * MIN)) })
  }
  return out
}

/** Débit aval synthétique : gain * amont décalé de 105 min (délai nominal jusqu'à l'aval) + décalage. */
function downSeries(gain: number, offset: number): SeriesPoint[] {
  const lag = lagMinutes(25, M.lag) * M.downLagRatio * MIN
  const out: SeriesPoint[] = []
  for (let t = NOW - 70 * 60 * MIN; t <= NOW; t += 10 * MIN) {
    const ref = 25 + 4 * Math.sin((2 * Math.PI * (t - lag)) / (6 * 60 * MIN))
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

  it('retrouve le gain et le décalage d’une relation connue', () => {
    const c = calibrateSite(refSeries(80), downSeries(0.5, 2), M, NOW)
    expect(c.fitted).toBe(true)
    expect(c.gain).toBeCloseTo(0.5, 1)
    expect(c.offset).toBeCloseTo(2, 0)
    expect(c.sigma).toBeLessThan(1)
  })

  it('suit un changement de rapport entre les stations (travaux)', () => {
    const a = calibrateSite(refSeries(80), downSeries(0.5, 2), M, NOW)
    const b = calibrateSite(refSeries(80), downSeries(0.3, 5), M, NOW)
    expect(b.gain).toBeLessThan(a.gain)
  })

  it('garde le gain par défaut si le débit de référence ne varie presque pas', () => {
    const flat: SeriesPoint[] = []
    for (let t = NOW - 80 * 60 * MIN; t <= NOW; t += 10 * MIN) flat.push({ t: new Date(t).toISOString(), y: 25 })
    const down = flat.map((p) => ({ t: p.t, y: 12 }))
    const c = calibrateSite(flat, down, M, NOW)
    expect(c.fitted).toBe(true)
    expect(c.gain).toBe(M.defaultGain)
    expect(c.gain * 25 + c.offset).toBeCloseTo(12, 1)
  })
})

describe('siteFlowSeries', () => {
  const cal: SiteCalibration = { gain: 0.5, offset: 1, sigma: 1, pairs: 100, fitted: true }
  const pt = (minAgo: number, y: number): SeriesPoint => ({ t: new Date(NOW - minAgo * MIN).toISOString(), y })

  it('convertit puis décale chaque mesure de son propre délai', () => {
    const [p] = siteFlowSeries([pt(0, 30)], cal, M)
    expect(p!.y).toBeCloseTo(16, 6)
    expect(Date.parse(p!.t)).toBe(NOW + 91 * MIN)
  })

  it('décale davantage les faibles débits', () => {
    const [hi] = siteFlowSeries([pt(0, 30)], cal, M)
    const [lo] = siteFlowSeries([pt(0, 10)], cal, M)
    expect(Date.parse(lo!.t) - NOW).toBeGreaterThan(Date.parse(hi!.t) - NOW)
  })

  it('écarte les mesures dont l’arrivée précède la précédente', () => {
    // 10 m³/s (délai long) suivi, 5 min plus tard, de 30 m³/s (délai court) qui arriverait avant.
    const out = siteFlowSeries([pt(10, 10), pt(5, 30)], cal, M)
    expect(out).toHaveLength(1)
  })

  it('ne produit jamais de débit négatif', () => {
    const [p] = siteFlowSeries([pt(0, 1)], { ...cal, offset: -5 }, M)
    expect(p!.y).toBe(0)
  })
})
