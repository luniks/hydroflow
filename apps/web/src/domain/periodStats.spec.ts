import { describe, expect, it } from 'vitest'
import { LAVAUR_3H, series } from '@/test/realSeries'
import { TEST_EXPLOIT, SITE_EXPLOIT } from '@/test/exploitFixture'
import { periodStats } from './periodStats'

const end = Date.parse('2026-10-21T16:20:00Z')

describe('periodStats · Lavaur sur 3 h', () => {
  it('sans délai : 15 mesures sur 35 intervalles en zone optimale', () => {
    // 45,4 m³/s à 13:35 ... 45,1 à 14:45 : 15 mesures de 5 min = 75 min sur 175 min
    const s = periodStats(LAVAUR_3H, { ...SITE_EXPLOIT, propagationMin: 0 }, end)!
    expect(s.coverageMin).toBe(175)
    expect(s.optimalPct).toBeCloseTo(42.857, 2)
    expect(s).toMatchObject({ stops: 0, starts: 0 })
  })

  it('avec le délai de 80 min : seules les mesures déjà arrivées à la turbine comptent', () => {
    // arrivées avant 16:20 : celles de 15:00 et avant, soit 95 min couvertes dont 75 en zone optimale
    const s = periodStats(LAVAUR_3H, SITE_EXPLOIT, end)!
    expect(s.coverageMin).toBe(95)
    expect(s.optimalPct).toBeCloseTo(78.947, 2)
  })
})

describe('periodStats · cas limites', () => {
  const c = { ...TEST_EXPLOIT, propagationMin: 0 }
  const at = Date.parse('2026-01-01T03:00:00Z')

  it('retourne null avec moins de deux mesures arrivées', () => {
    expect(periodStats([], c, at)).toBeNull()
    expect(periodStats(series('2026-01-01T00:00:00Z', [12]), c, at)).toBeNull()
    // une seule mesure est arrivée à la turbine
    expect(periodStats(series('2026-01-01T00:00:00Z', [12, 12, 12], 60), { ...c, propagationMin: 150 }, at)).toBeNull()
  })

  it('retourne null quand il n’y a que des trous de données', () => {
    expect(periodStats(series('2026-01-01T00:00:00Z', [12, 12, 12], 30), c, at)).toBeNull()
  })

  it('ne compte pas un trou de données', () => {
    // 3 mesures, trou de 30 min, 2 mesures : 5 min + 5 min + 5 min couverts, trou ignoré
    const s = periodStats(series('2026-01-01T00:00:00Z', [12, 12, 12, null, null, null, null, null, null, 12, 12]), c, at)!
    expect(s.coverageMin).toBe(15)
    expect(s.optimalPct).toBe(100)
  })

  it('compte les arrêts et les démarrages, hystérésis comprise', () => {
    // en marche à 12, arrêt sous 5,5, puis démarrage à 9 (>= 8), puis 7 (hystérésis : reste en marche), puis arrêt à 4
    const s = periodStats(series('2026-01-01T00:00:00Z', [12, 4, 4, 9, 7, 4]), c, at)!
    expect(s).toMatchObject({ stops: 2, starts: 1 })
  })

  it('mesure la part passée hors de la zone optimale', () => {
    const s = periodStats(series('2026-01-01T00:00:00Z', [12, 12, 6, 6]), c, at)!
    // chaque mesure vaut jusqu'a la suivante : 12 -> 12 et 12 -> 6 sont en zone optimale (10 min), 6 -> 6 non (5 min)
    expect(s.optimalPct).toBeCloseTo(66.667, 2)
  })
})
