import { describe, expect, it } from 'vitest'
import { DEFAULT_THRESHOLDS, flowFlatThreshold, normThresholds } from './constants'

describe('normThresholds', () => {
  it('retombe sur les seuils par défaut sans argument', () => {
    expect(normThresholds()).toEqual(DEFAULT_THRESHOLDS)
    expect(normThresholds(null)).toEqual(DEFAULT_THRESHOLDS)
    expect(normThresholds({})).toEqual(DEFAULT_THRESHOLDS)
  })

  it('retombe sur les seuils par défaut si une borne est non numérique', () => {
    expect(normThresholds({ level: { low: Number.NaN, high: 2 } })).toEqual(DEFAULT_THRESHOLDS)
    expect(normThresholds({ level: { low: 1, high: Number.NaN } })).toEqual(DEFAULT_THRESHOLDS)
  })

  it('conserve des seuils valides', () => {
    expect(normThresholds({ level: { low: 1, high: 3 } })).toEqual({
      level: { low: 1, high: 3 },
      flow: DEFAULT_THRESHOLDS.flow,
    })
  })

  it('ne partage pas la référence des seuils par défaut', () => {
    const a = normThresholds()
    a.level.low = 99
    expect(normThresholds().level.low).toBe(DEFAULT_THRESHOLDS.level.low)
  })
})

describe('flowFlatThreshold', () => {
  it('applique 2 % du débit avec un plancher à 0,05', () => {
    expect(flowFlatThreshold(100)).toBeCloseTo(2)
    expect(flowFlatThreshold(1)).toBeCloseTo(0.05)
  })
})
