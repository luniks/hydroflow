import { describe, expect, it } from 'vitest'
import { flowFlatThreshold, LEVEL_FLAT_THRESHOLD } from './constants'
import { GIROUSSENS, LAVAUR_3H, LAVAUR_BRUYANT, VIELMUR_NIVEAU, series } from '@/test/realSeries'
import { analyzeSeries, computeTrend, minutesToReach, projectSeries } from './trend'
import type { AnalyzeOptions, SeriesPoint } from './types'

const BASE = Date.parse('2026-01-01T12:00:00Z')
const at = (minutesAgo: number, y: number): SeriesPoint => ({
  t: new Date(BASE - minutesAgo * 60_000).toISOString(),
  y,
})

describe('computeTrend', () => {
  it('retourne plat sur une série vide', () => {
    expect(computeTrend([], LEVEL_FLAT_THRESHOLD)).toEqual({ dir: 'flat', ratePerHour: 0 })
  })

  it('retourne plat sur un point unique', () => {
    expect(computeTrend([at(0, 1.2)], LEVEL_FLAT_THRESHOLD)).toEqual({ dir: 'flat', ratePerHour: 0 })
  })

  it('détecte une hausse via le point à 1 h', () => {
    const points = [at(120, 1.0), at(60, 1.0), at(30, 1.1), at(0, 1.2)]
    const trend = computeTrend(points, LEVEL_FLAT_THRESHOLD)
    expect(trend.dir).toBe('up')
    expect(trend.ratePerHour).toBeCloseTo(0.2)
  })

  it('détecte une baisse', () => {
    const points = [at(60, 2.0), at(0, 1.5)]
    const trend = computeTrend(points, LEVEL_FLAT_THRESHOLD)
    expect(trend.dir).toBe('down')
    expect(trend.ratePerHour).toBeCloseTo(-0.5)
  })

  it('reste plat sous la tolérance', () => {
    const points = [at(60, 1.0), at(0, 1.004)]
    expect(computeTrend(points, LEVEL_FLAT_THRESHOLD).dir).toBe('flat')
  })

  it('reste plat exactement à la tolérance', () => {
    const points = [at(60, 1.0), at(0, 1 + LEVEL_FLAT_THRESHOLD)]
    expect(computeTrend(points, LEVEL_FLAT_THRESHOLD).dir).toBe('flat')
  })

  it("retombe sur le point le plus ancien quand l'historique est plus court qu'une heure", () => {
    const points = [at(30, 1.0), at(15, 1.1), at(0, 1.2)]
    const trend = computeTrend(points, LEVEL_FLAT_THRESHOLD)
    expect(trend.ratePerHour).toBeCloseTo(0.4)
  })

  it('choisit le point le plus récent antérieur à 1 h sur une série éparse', () => {
    const points = [at(300, 0), at(180, 5), at(90, 1.0), at(0, 1.3)]
    const trend = computeTrend(points, LEVEL_FLAT_THRESHOLD)
    expect(trend.ratePerHour).toBeCloseTo(0.2)
  })

  it('plafonne le pas de temps à 0,01 h pour éviter une division par zéro', () => {
    const points = [at(0, 1.0), at(0, 1.1)]
    expect(computeTrend(points, LEVEL_FLAT_THRESHOLD).ratePerHour).toBeCloseTo(10)
  })

  it('applique la tolérance relative du débit', () => {
    expect(flowFlatThreshold(10)).toBeCloseTo(0.2)
    expect(flowFlatThreshold(0)).toBeCloseTo(0.05)
    expect(flowFlatThreshold(-10)).toBeCloseTo(0.2)
    const points = [at(60, 10), at(0, 10.1)]
    expect(computeTrend(points, flowFlatThreshold(10)).dir).toBe('flat')
    expect(computeTrend(points, flowFlatThreshold(1)).dir).toBe('up')
  })
})

// ---------------------------------------------------------------------------
// Analyse par regression
// ---------------------------------------------------------------------------

const FLOW: AnalyzeOptions = { relFloor: 0.01, absFloor: 0.05, legacyFlat: 0.35 }
const LEVEL: AnalyzeOptions = { relFloor: 0, absFloor: 0.005, legacyFlat: 0.005 }
const upTo = (points: SeriesPoint[], hhmm: string) =>
  points.filter((p) => Date.parse(p.t) <= Date.parse(`2026-10-21T${hhmm}:00Z`))
const last = (points: SeriesPoint[]) => points[points.length - 1]!.y
/** Serie synthetique : une mesure toutes les `stepMin` minutes, valeur = f(heures ecoulees). */
const synth = (n: number, stepMin: number, f: (hours: number, i: number) => number) =>
  series('2026-01-01T00:00:00Z', Array.from({ length: n }, (_, i) => f((i * stepMin) / 60, i)), stepMin)

describe('analyzeSeries · mesures reelles', () => {
  it('Giroussens : la chute s’est arrêtée, la série est un palier (et non « ▼ -1,47 m³/s/h »)', () => {
    const a = analyzeSeries(GIROUSSENS, FLOW)
    expect(a).toMatchObject({ dir: 'flat', ratePerHour: 0, method: 'regression' })
    expect(a.stableMin).toBeGreaterThanOrEqual(15)
    // l'indicateur precedent affichait encore la chute de la derniere heure
    expect(computeTrend(GIROUSSENS, FLOW.legacyFlat)).toMatchObject({ dir: 'down' })
  })

  it('Lavaur bruité : aucune fausse flèche sur un débit réellement stable', () => {
    const verdicts = new Set<string>()
    for (let n = 7; n <= LAVAUR_BRUYANT.length; n++) {
      verdicts.add(analyzeSeries(LAVAUR_BRUYANT.slice(0, n), FLOW).dir)
    }
    expect([...verdicts]).toEqual(['flat'])
  })

  it('Lavaur : annonce la baisse dès 14:30 alors que l’ancien calcul affiche encore une hausse', () => {
    const at = upTo(LAVAUR_3H, '14:30')
    expect(analyzeSeries(at, FLOW)).toMatchObject({ dir: 'down', windowMin: 30 })
    expect(computeTrend(at, FLOW.legacyFlat).dir).toBe('up')
  })

  it('Lavaur : suit la montée, le palier puis la chute finale', () => {
    expect(analyzeSeries(upTo(LAVAUR_3H, '14:00'), FLOW)).toMatchObject({ dir: 'up' })
    expect(analyzeSeries(upTo(LAVAUR_3H, '16:00'), FLOW)).toMatchObject({ dir: 'flat' })
    const fall = analyzeSeries(LAVAUR_3H, FLOW)
    expect(fall.dir).toBe('down')
    expect(fall.ratePerHour).toBeLessThan(-15)
  })

  it('Vielmur : la remontée de 08:45 est détectée malgré le trou de 30 min', () => {
    const a = analyzeSeries(VIELMUR_NIVEAU, LEVEL)
    expect(a.dir).toBe('up')
    expect(a.ratePerHour).toBeGreaterThan(0.03) // m/h, soit > 3 cm/h
    expect(a.ratePerHour).toBeLessThan(0.05)
  })

  it('Vielmur : un niveau qui oscille reste lisible (ni toujours plat, ni toujours en mouvement)', () => {
    const verdicts: Record<string, number> = { up: 0, down: 0, flat: 0 }
    for (let n = 8; n <= VIELMUR_NIVEAU.length; n++) verdicts[analyzeSeries(VIELMUR_NIVEAU.slice(0, n), LEVEL).dir]!++
    expect(verdicts.flat).toBeGreaterThan(0)
    expect(verdicts.up).toBeGreaterThan(0)
    expect(verdicts.down).toBeGreaterThan(0)
  })
})

describe('analyzeSeries · repli et cas limites', () => {
  it('retombe sur la pente 2 points quand il y a trop peu de mesures', () => {
    const points = series('2026-01-01T00:00:00Z', [10, 12], 60)
    expect(analyzeSeries(points, FLOW)).toMatchObject({ method: 'legacy', dir: 'up', ratePerHour: 2, windowMin: null })
    expect(analyzeSeries(series('2026-01-01T00:00:00Z', [10, 10], 60), FLOW)).toMatchObject({ dir: 'flat', ratePerHour: 0 })
  })

  it('retombe aussi sur la pente 2 points quand la dernière heure compte trop peu de mesures', () => {
    // une mesure toutes les 15 min = 5 mesures sur la derniere heure (suffisant) ; toutes les 20 min = 4 (trop peu)
    expect(analyzeSeries(synth(8, 15, (h) => 10 + h), FLOW).method).toBe('regression')
    expect(analyzeSeries(synth(8, 20, (h) => 10 + h), FLOW).method).toBe('legacy')
  })

  it('détecte un palier et en donne la durée', () => {
    const flat = synth(12, 5, () => 10)
    expect(analyzeSeries(flat, FLOW)).toMatchObject({ dir: 'flat', ratePerHour: 0, windowMin: null, stableMin: 55 })
  })

  it('tolère le bruit mesuré avant de parler de mouvement', () => {
    const jitter = synth(14, 5, (_, i) => 10 + (i % 2 ? 0.2 : -0.2))
    expect(analyzeSeries(jitter, FLOW).dir).toBe('flat')
  })

  it('choisit la fenêtre de 30 min quand la pente y est significative', () => {
    const a = analyzeSeries(synth(14, 5, (h) => 10 + 6 * h), FLOW)
    expect(a).toMatchObject({ dir: 'up', windowMin: 30, stableMin: null })
    expect(a.ratePerHour).toBeCloseTo(6, 5)
  })

  it('passe à la fenêtre de 60 min quand 30 min comptent trop peu de mesures', () => {
    const a = analyzeSeries(synth(10, 10, (h) => 10 - 6 * h), FLOW)
    expect(a).toMatchObject({ dir: 'down', windowMin: 60 })
  })

  it('n’utilise que la fenêtre de 60 min quand la série est très bruitée', () => {
    const noisy = synth(14, 5, (h, i) => 10 + 20 * h + (i % 2 ? 0.3 : -0.3))
    expect(analyzeSeries(noisy, FLOW)).toMatchObject({ dir: 'up', windowMin: 60 })
  })

  it('ne retient aucune tendance quand aucune fenêtre n’est significative', () => {
    const a = analyzeSeries(synth(12, 5, (_, i) => (i === 11 ? 10.5 : 10)), { ...FLOW, relFloor: 0, absFloor: 0 })
    expect(a).toMatchObject({ dir: 'flat', ratePerHour: 0, windowMin: null, stableMin: null })
  })

  it('ne retient pas un saut isolé en fin de série : une seule mesure peut être du bruit', () => {
    const spike = synth(12, 5, (_, i) => (i === 11 ? 30 : 10))
    expect(analyzeSeries(spike, { ...FLOW, relFloor: 0, absFloor: 0 }).dir).toBe('flat')
  })

  it('ne lisse pas la dernière mesure : la remontée de Vielmur reste détectée à pleine vitesse', () => {
    // lissée par la médiane de ses voisins, cette dernière mesure ne donnerait que +0,021 m/h
    expect(analyzeSeries(VIELMUR_NIVEAU, LEVEL).ratePerHour).toBeGreaterThan(0.035)
  })
})

describe('analyzeSeries · courbure', () => {
  it('retient la courbure d’une courbe qui accélère', () => {
    const a = analyzeSeries(upTo(LAVAUR_3H, '14:30'), FLOW)
    expect(a.curve).not.toBeNull()
    expect(a.curve!.a).toBeLessThan(-8)
  })

  it('ignore une courbure trop faible pour compter', () => {
    const gentle = synth(14, 5, (h) => 10 + 6 * h + 0.5 * h * h)
    expect(analyzeSeries(gentle, FLOW).curve).toBeNull()
  })

  it('ignore la courbure quand la fenêtre compte trop peu de mesures', () => {
    const a = analyzeSeries(synth(10, 10, (h) => 10 + 5 * h + 40 * h * h), FLOW)
    expect(a.method).toBe('regression')
    expect(a.curve).toBeNull()
  })

  it('n’en cherche pas pendant un palier', () => {
    expect(analyzeSeries(synth(12, 5, () => 10), FLOW).curve).toBeNull()
  })
})

describe('projectSeries', () => {
  const linear = { dir: 'up', ratePerHour: 6, windowMin: 30, stableMin: null, curve: null, method: 'regression' } as const
  const curved = { ...linear, ratePerHour: -10, curve: { b: -4, a: -12 } }

  it('ne bouge pas à l’instant de la dernière mesure ni avant', () => {
    expect(projectSeries(linear, 20, 0)).toBe(20)
    expect(projectSeries(linear, 20, -1)).toBe(20)
  })

  it('prolonge la pente quand il n’y a pas de courbure', () => {
    expect(projectSeries(linear, 20, 0.5)).toBeCloseTo(23, 10)
  })

  it('applique la courbure sur 30 min puis reprend la pente', () => {
    expect(projectSeries(curved, 50, 0.25)).toBeCloseTo(50 - 4 * 0.25 - 12 * 0.0625, 10)
    const atHorizon = 50 - 4 * 0.5 - 12 * 0.25
    expect(projectSeries(curved, 50, 1)).toBeCloseTo(atHorizon - 10 * 0.5, 10)
  })

  it('ne descend jamais sous zéro', () => {
    expect(projectSeries({ ...linear, ratePerHour: -100 }, 5, 1)).toBe(0)
    expect(projectSeries({ ...curved, curve: { b: -100, a: -100 } }, 5, 0.4)).toBe(0)
  })
})

describe('minutesToReach · backtest sur la sortie de zone optimale de Lavaur (45 m³/s, franchi à 14:45:37)', () => {
  // [heure, minutes restantes réelles] : 45,1 m³/s à 14:45 puis 44,3 à 14:50, soit 14:45:37
  const cases: [string, number][] = [['14:20', 26], ['14:30', 16], ['14:35', 11], ['14:40', 6], ['14:45', 1]]

  it.each(cases)('à %s, l’ETA est proche des %i min réelles', (hhmm, real) => {
    const pts = upTo(LAVAUR_3H, hhmm)
    const eta = minutesToReach(analyzeSeries(pts, FLOW), last(pts), 45, 120)
    expect(eta).not.toBeNull()
    expect(Math.abs(eta! - real)).toBeLessThanOrEqual(5)
  })

  it('une extrapolation linéaire aurait été trop tardive de plus de 20 min à 14:30', () => {
    const pts = upTo(LAVAUR_3H, '14:30')
    const linearOnly = { ...analyzeSeries(pts, FLOW), curve: null }
    expect(minutesToReach(linearOnly, last(pts), 45, 120)! - 16).toBeGreaterThan(20)
  })

  it('anticipe la chute finale (30,1 m³/s, seuil de 20 m³/s)', () => {
    const eta = minutesToReach(analyzeSeries(LAVAUR_3H, FLOW), last(LAVAUR_3H), 20, 120)
    expect(eta).toBeGreaterThanOrEqual(8)
    expect(eta).toBeLessThanOrEqual(25)
  })

  it('retourne 0 quand la valeur est déjà sur le seuil, et null hors horizon', () => {
    const a = analyzeSeries(LAVAUR_3H, FLOW)
    expect(minutesToReach(a, 20, 20, 120)).toBe(0)
    expect(minutesToReach(analyzeSeries(GIROUSSENS, FLOW), 7.49, 20, 120)).toBeNull()
  })
})
