import { describe, expect, it } from 'vitest'
import {
  formatAxisTick,
  nearestPointIndex,
  rainBarOpacity,
  rainBarsGeometry,
  sparklineGeometry,
  tooltipAlignment,
} from './chartScale'
import type { SeriesPoint } from './types'

const HOUR = 3_600_000
const start = new Date('2026-10-01T00:00:00Z')
const end = new Date('2026-10-01T04:00:00Z')

const points: SeriesPoint[] = [
  { t: '2026-10-01T00:00:00Z', y: 1 },
  { t: '2026-10-01T02:00:00Z', y: 3 },
  { t: '2026-10-01T04:00:00Z', y: 2 },
]

describe('sparklineGeometry', () => {
  it('renvoie null quand il y a moins de deux points', () => {
    expect(sparklineGeometry([], { windowStart: start, windowEnd: end })).toBeNull()
    expect(sparklineGeometry([points[0]!], { windowStart: start, windowEnd: end })).toBeNull()
  })

  it('projette les points sur la zone de tracé', () => {
    const geo = sparklineGeometry(points, { windowStart: start, windowEnd: end })!
    expect(geo.width).toBe(600)
    expect(geo.height).toBe(122)
    expect(geo.plotBottom).toBe(98)
    expect(geo.min).toBe(1)
    expect(geo.max).toBe(3)
    expect(geo.range).toBe(2)
    // premier point : bord gauche de la zone, valeur minimale donc en bas
    expect(geo.coords[0]).toEqual([44, 98])
    // dernier point : bord droit
    expect(geo.coords[2]![0]).toBeCloseTo(592, 5)
    expect(geo.lastPoint).toEqual(geo.coords[2])
  })

  it('construit un chemin de ligne et une aire fermée', () => {
    const geo = sparklineGeometry(points, { windowStart: start, windowEnd: end })!
    expect(geo.pathD.startsWith('M44.0,98.0 L')).toBe(true)
    expect(geo.areaD.endsWith('L44.0,98 Z')).toBe(true)
  })

  it('évite la division par zéro quand toutes les valeurs sont égales', () => {
    const flat: SeriesPoint[] = [
      { t: '2026-10-01T00:00:00Z', y: 5 },
      { t: '2026-10-01T04:00:00Z', y: 5 },
    ]
    const geo = sparklineGeometry(flat, { windowStart: start, windowEnd: end })!
    expect(geo.range).toBe(1)
    expect(geo.coords.every(([, y]) => y === geo.plotBottom)).toBe(true)
  })

  it('réduit la hauteur et supprime la marge basse sans libellés', () => {
    const geo = sparklineGeometry(points, {
      windowStart: start,
      windowEnd: end,
      withXLabels: false,
    })!
    expect(geo.height).toBe(92)
    expect(geo.plotBottom).toBe(82)
  })

  it('accepte une largeur et une hauteur explicites', () => {
    const geo = sparklineGeometry(points, {
      windowStart: start,
      windowEnd: end,
      width: 300,
      height: 60,
    })!
    expect(geo.width).toBe(300)
    expect(geo.plotBottom).toBe(36)
  })

  it('génère cinq repères horizontaux répartis uniformément', () => {
    const geo = sparklineGeometry(points, { windowStart: start, windowEnd: end })!
    expect(geo.xTicks).toHaveLength(5)
    expect(geo.xTicks[0]!.position).toBe(44)
    expect(geo.xTicks[4]!.position).toBeCloseTo(592, 5)
  })

  it('protège contre une fenêtre de durée nulle', () => {
    const geo = sparklineGeometry(points, { windowStart: start, windowEnd: start })!
    expect(geo.windowMs).toBe(1)
  })
})

describe('formatAxisTick', () => {
  it('affiche une heure sur les fenêtres courtes', () => {
    expect(formatAxisTick(Date.UTC(2026, 9, 1, 8, 30), 24)).toMatch(/\d{2}:\d{2}/)
  })

  it('affiche une date sur les fenêtres longues', () => {
    expect(formatAxisTick(Date.UTC(2026, 9, 1), 168)).toMatch(/\d{2}\/\d{2}/)
  })
})

describe('nearestPointIndex', () => {
  it('renvoie -1 sans point', () => {
    expect(nearestPointIndex([], 0)).toBe(-1)
  })

  it('borne aux extrémités', () => {
    expect(nearestPointIndex(points, Date.parse('2025-01-01T00:00:00Z'))).toBe(0)
    expect(nearestPointIndex(points, Date.parse('2027-01-01T00:00:00Z'))).toBe(2)
  })

  it('trouve une correspondance exacte', () => {
    expect(nearestPointIndex(points, Date.parse('2026-10-01T02:00:00Z'))).toBe(1)
  })

  it('choisit le point le plus proche de part et d’autre', () => {
    expect(nearestPointIndex(points, Date.parse('2026-10-01T00:40:00Z'))).toBe(0)
    expect(nearestPointIndex(points, Date.parse('2026-10-01T01:30:00Z'))).toBe(1)
    expect(nearestPointIndex(points, Date.parse('2026-10-01T03:30:00Z'))).toBe(2)
  })
})

describe('tooltipAlignment', () => {
  it('se cale à gauche, au centre ou à droite selon la position', () => {
    expect(tooltipAlignment(10, 100)).toBe('left')
    expect(tooltipAlignment(50, 100)).toBe('center')
    expect(tooltipAlignment(90, 100)).toBe('right')
  })
})

describe('rainBarOpacity', () => {
  const now = Date.UTC(2026, 9, 1)

  it('reste pleine pour le passé et l’instant présent', () => {
    expect(rainBarOpacity(now - HOUR, now)).toBe(1)
    expect(rainBarOpacity(now, now)).toBe(1)
  })

  it('atténue la prévision jusqu’à 24 h', () => {
    expect(rainBarOpacity(now + 5 * HOUR, now)).toBe(0.85)
    expect(rainBarOpacity(now + 24 * HOUR, now)).toBe(0.85)
  })

  it('dégrade linéairement entre 24 h et 48 h sans descendre sous 0,25', () => {
    expect(rainBarOpacity(now + 36 * HOUR, now)).toBeCloseTo(0.575, 5)
    expect(rainBarOpacity(now + 48 * HOUR, now)).toBeCloseTo(0.3, 5)
    expect(rainBarOpacity(now + 96 * HOUR, now)).toBe(0.25)
  })
})

describe('rainBarsGeometry', () => {
  const windowStartMs = Date.UTC(2026, 9, 1, 0)
  const windowEndMs = Date.UTC(2026, 9, 1, 4)
  const nowMs = Date.UTC(2026, 9, 1, 2)

  const rain: SeriesPoint[] = [
    { t: '2026-10-01T00:00:00Z', y: 2 },
    { t: '2026-10-01T01:00:00Z', y: 0 },
    { t: '2026-10-01T03:00:00Z', y: 10 },
    { t: '2026-10-01T09:00:00Z', y: 20 },
  ]

  it('renvoie null quand il y a moins de deux points', () => {
    expect(rainBarsGeometry([], { windowStartMs, windowEndMs, nowMs })).toBeNull()
  })

  it('ignore les points hors fenêtre et les valeurs nulles', () => {
    const geo = rainBarsGeometry(rain, { windowStartMs, windowEndMs, nowMs })!
    expect(geo.bars).toHaveLength(2)
    expect(geo.max).toBe(10)
  })

  it('applique un plancher d’échelle de 4 mm', () => {
    const light: SeriesPoint[] = [
      { t: '2026-10-01T00:00:00Z', y: 0.5 },
      { t: '2026-10-01T01:00:00Z', y: 1 },
    ]
    const geo = rainBarsGeometry(light, { windowStartMs, windowEndMs, nowMs })!
    expect(geo.max).toBe(4)
  })

  it('distingue le passé de la prévision par la couleur', () => {
    const geo = rainBarsGeometry(rain, { windowStartMs, windowEndMs, nowMs })!
    expect(geo.bars[0]!.fill).toBe('var(--rain)')
    expect(geo.bars[0]!.opacity).toBe(1)
    expect(geo.bars[1]!.fill).toBe('var(--rain-far)')
    expect(geo.bars[1]!.opacity).toBe(0.85)
  })

  it('centre les barres sur leur horodatage avec une hauteur minimale', () => {
    const geo = rainBarsGeometry(rain, { windowStartMs, windowEndMs, nowMs })!
    const slot = ((geo.width - geo.padLeft - geo.padRight) * 3_600_000) / (4 * HOUR)
    expect(geo.bars[0]!.width).toBeCloseTo(slot * 0.7, 5)
    expect(geo.bars[0]!.x).toBeCloseTo(geo.padLeft - geo.bars[0]!.width / 2, 5)
    expect(geo.bars[1]!.height).toBeCloseTo(geo.plotBottom - geo.plotTop, 5)
    expect(geo.bars[0]!.height).toBeGreaterThanOrEqual(1.5)
  })

  it('garantit une largeur de barre minimale sur les longues fenêtres', () => {
    const geo = rainBarsGeometry(rain, {
      windowStartMs,
      windowEndMs: windowStartMs + 10_000 * HOUR,
      nowMs,
    })!
    expect(geo.bars[0]!.width).toBe(1)
  })

  it('positionne le repère « maintenant » uniquement s’il est dans la fenêtre', () => {
    const inside = rainBarsGeometry(rain, { windowStartMs, windowEndMs, nowMs })!
    expect(inside.nowX).toBeCloseTo(inside.padLeft + (inside.width - 8) / 2, 5)

    const outside = rainBarsGeometry(rain, {
      windowStartMs,
      windowEndMs,
      nowMs: windowEndMs + HOUR,
    })!
    expect(outside.nowX).toBeNull()
  })

  it('accepte des dimensions explicites et protège la fenêtre nulle', () => {
    const geo = rainBarsGeometry(rain, {
      windowStartMs,
      windowEndMs: windowStartMs,
      nowMs,
      width: 200,
      height: 40,
    })!
    expect(geo.width).toBe(200)
    expect(geo.plotBottom).toBe(36)
  })
})
