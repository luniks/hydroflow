import { describe, expect, it } from 'vitest'
import { needsRefresh } from './refresh'
import type { SeriesPoint } from './types'

const NOW = Date.parse('2026-01-01T12:00:00Z')
const pt = (agoMin: number): SeriesPoint => ({ t: new Date(NOW - agoMin * 60_000).toISOString(), y: 1 })

describe('needsRefresh', () => {
  it('ne recharge jamais quand le rafraîchissement automatique est désactivé', () => {
    expect(needsRefresh(null, 0, NOW)).toBe(false)
    expect(needsRefresh(NOW - 3_600_000, 0, NOW)).toBe(false)
  })

  it('recharge quand rien n’a encore pu être chargé', () => {
    expect(needsRefresh(null, 10, NOW)).toBe(true)
  })

  it('recharge quand les données ont au moins l’âge d’un intervalle', () => {
    expect(needsRefresh(NOW - 10 * 60_000, 10, NOW)).toBe(true)
    expect(needsRefresh(NOW - 45 * 60_000, 10, NOW)).toBe(true)
  })

  it('ne recharge pas des données plus récentes que l’intervalle', () => {
    expect(needsRefresh(NOW - 9 * 60_000, 10, NOW)).toBe(false)
    expect(needsRefresh(NOW, 5, NOW)).toBe(false)
  })
})
