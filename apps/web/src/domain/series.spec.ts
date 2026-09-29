import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computeWindow,
  downsample,
  litresToCubicMetres,
  mean,
  mmToMetres,
  rangeStatus,
} from './series'
import type { SeriesPoint } from './types'

const series = (n: number): SeriesPoint[] =>
  Array.from({ length: n }, (_, i) => ({ t: new Date(i * 60_000).toISOString(), y: i }))

describe('computeWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('retourne dateFin null en mode direct', () => {
    const { dateDebut, dateFin } = computeWindow(24, 0)
    expect(dateFin).toBeNull()
    expect(dateDebut.toISOString()).toBe('2025-12-31T12:00:00.000Z')
  })

  it('décale la fenêtre vers le passé par pas de la durée choisie', () => {
    const { dateDebut, dateFin } = computeWindow(24, 2)
    expect(dateFin?.toISOString()).toBe('2025-12-30T12:00:00.000Z')
    expect(dateDebut.toISOString()).toBe('2025-12-29T12:00:00.000Z')
  })

  it('conserve une durée de fenêtre égale au paramètre heures', () => {
    const { dateDebut, dateFin } = computeWindow(3, 5)
    expect(dateFin!.getTime() - dateDebut.getTime()).toBe(3 * 3_600_000)
  })

  it('traite un offset négatif comme le mode direct', () => {
    expect(computeWindow(1, -1).dateFin).toBeNull()
  })
})

describe('downsample', () => {
  it('retourne la série inchangée sous la limite', () => {
    const points = series(10)
    expect(downsample(points, 10)).toBe(points)
    expect(downsample(points, 50)).toBe(points)
  })

  it('compresse au-dessus de la limite', () => {
    expect(downsample(series(1000), 100).length).toBeLessThanOrEqual(101)
  })

  it('préserve toujours le dernier point', () => {
    const points = series(1000)
    const out = downsample(points, 100)
    expect(out[out.length - 1]).toBe(points[999])
  })

  it('utilise MAX_CHART_POINTS par défaut', () => {
    expect(downsample(series(2000)).length).toBeLessThanOrEqual(801)
  })

  it('conserve l’ordre chronologique', () => {
    const out = downsample(series(500), 50)
    const times = out.map((p) => Date.parse(p.t))
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })
})

describe('rangeStatus', () => {
  const range = { low: 0.5, high: 2.5 }

  it('retourne null sans valeur ou sans plage', () => {
    expect(rangeStatus(null, range)).toBeNull()
    expect(rangeStatus(undefined, range)).toBeNull()
    expect(rangeStatus(1, null)).toBeNull()
    expect(rangeStatus(1, undefined)).toBeNull()
  })

  it('classe sous / dans / au-dessus de la plage', () => {
    expect(rangeStatus(0.4, range)).toBe('low')
    expect(rangeStatus(1.5, range)).toBe('ok')
    expect(rangeStatus(2.6, range)).toBe('high')
  })

  it('considère les bornes exactes comme ok', () => {
    expect(rangeStatus(0.5, range)).toBe('ok')
    expect(rangeStatus(2.5, range)).toBe('ok')
  })

  it('gère la valeur zéro sans la confondre avec une absence de valeur', () => {
    expect(rangeStatus(0, range)).toBe('low')
  })
})

describe('conversions', () => {
  it('convertit les hauteurs mm en mètres', () => {
    expect(mmToMetres(1234)).toBeCloseTo(1.234)
    expect(mmToMetres(0)).toBe(0)
  })

  it('convertit les débits l/s en m³/s', () => {
    expect(litresToCubicMetres(5500)).toBeCloseTo(5.5)
  })
})

describe('mean', () => {
  it('retourne null sur une liste vide', () => {
    expect(mean([])).toBeNull()
  })

  it('calcule la moyenne', () => {
    expect(mean([1, 2, 3])).toBeCloseTo(2)
  })
})
