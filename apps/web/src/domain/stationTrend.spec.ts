import { describe, expect, it } from 'vitest'
import { GIROUSSENS, LAVAUR_3H, VIELMUR_NIVEAU } from '@/test/realSeries'
import { flowAnalyzeOptions, LEVEL_ANALYZE_OPTIONS } from './constants'
import { fmtTrend } from './format'
import { stationBands, stationLine, TREND_STALE_MIN, turbineBands, type TrendBand } from './stationTrend'
import { analyzeSeries } from './trend'
import type { SeriesAnalysis, SeriesPoint } from './types'

const flowRate = (r: number) => fmtTrend(r, 'm³/s/h')
const moving = (ratePerHour: number, over: Partial<SeriesAnalysis> = {}): SeriesAnalysis => ({
  dir: ratePerHour > 0 ? 'up' : 'down',
  ratePerHour,
  windowMin: 30,
  stableMin: null,
  curve: null,
  method: 'regression',
  ...over,
})
const flatAnalysis = (stableMin: number | null): SeriesAnalysis => ({
  dir: 'flat',
  ratePerHour: 0,
  windowMin: null,
  stableMin,
  curve: null,
  method: 'regression',
})
const upTo = (points: SeriesPoint[], hhmm: string) =>
  points.filter((p) => Date.parse(p.t) <= Date.parse(`2026-10-21T${hhmm}:00Z`))
const lastOf = (p: SeriesPoint[]) => p[p.length - 1]!.y
const opts = (bands: TrendBand[], ageMin: number | null = null) => ({ bands, formatRate: flowRate, ageMin })
/** Cinq seuils (arret 20 · demarrage 30 · optimal 45-135 · crue 150) : de quoi tester le moteur sur plusieurs franchissements. */
const EXPLOIT: TrendBand[] = [
  { value: 20, up: { name: 'Marche', good: true }, down: { name: 'Arrêt', good: false } },
  { value: 30, up: { name: 'Démarrage', good: true } },
  { value: 45, up: { name: 'Optimale', good: true }, down: { name: 'Marche', good: false } },
  { value: 135, up: { name: 'Limite', good: false }, down: { name: 'Optimale', good: true } },
  { value: 150, up: { name: 'Arrêt', good: false }, down: { name: 'Limite', good: true } },
]

describe('bandes de seuils', () => {
  it('une station ordinaire : sortir de la plage est à surveiller, y revenir est bon', () => {
    const [low, high] = stationBands({ low: 5, high: 20 })
    expect(low).toMatchObject({ value: 5, down: { name: 'Bas', good: false }, up: { name: 'Retour', good: true } })
    expect(high).toMatchObject({ value: 20, up: { name: 'Haut', good: false }, down: { name: 'Retour', good: true } })
  })
})

describe('stationLine · mesures réelles', () => {
  it('Lavaur à 14:30 : annonce la sortie de la zone optimale, alors que le débit vient de culminer', () => {
    const pts = upTo(LAVAUR_3H, '14:30')
    const line = stationLine(analyzeSeries(pts, flowAnalyzeOptions(lastOf(pts))), lastOf(pts), opts(EXPLOIT))
    expect(line.arrow).toBe('▼')
    expect(line.tone).toBe('warn')
    expect(line.text).toMatch(/^▼ Marche ~(1\d) min$/) // réel : 16 min
    expect(line.title).toContain('à la station')
  })

  it('Lavaur à 14:00 : en montée, sans seuil proche, la ligne donne la pente', () => {
    const pts = upTo(LAVAUR_3H, '14:00')
    const line = stationLine(analyzeSeries(pts, flowAnalyzeOptions(lastOf(pts))), lastOf(pts), opts(EXPLOIT))
    expect(line.text).toMatch(/^▲ \+\d+\.\d\d m³\/s\/h$/)
    expect(line.title).toContain('mesuré sur 30 min')
    expect(line.tone).toBe('neutral')
  })

  it('Giroussens : le palier est annoncé comme tel (et non la chute de la dernière heure)', () => {
    const line = stationLine(analyzeSeries(GIROUSSENS, flowAnalyzeOptions(7.49)), 7.49, opts(stationBands({ low: 5, high: 20 })))
    expect(line.text).toMatch(/^▬ stable \d+ min$/)
    expect(line.title).toMatch(/^Stable depuis \d+ min$/)
  })

  it('Vielmur : la remontée est donnée en cm/h, avec l’âge de la dernière mesure quand il est ancien', () => {
    const a = analyzeSeries(VIELMUR_NIVEAU, LEVEL_ANALYZE_OPTIONS)
    const line = stationLine(a, lastOf(VIELMUR_NIVEAU), {
      bands: [],
      formatRate: (r) => fmtTrend(r * 100, 'cm/h'),
      ageMin: 79,
    })
    expect(line.text).toMatch(/^▲ \+4\.\d\d cm\/h · 1 h 19$/)
    expect(line.title).toContain('Dernière mesure il y a 1 h 19')
  })
})

describe('stationLine · franchissement du prochain seuil', () => {
  it('entrée en zone optimale : bonne nouvelle', () => {
    const line = stationLine(moving(10), 40, opts(EXPLOIT))
    expect(line).toMatchObject({ arrow: '▲', text: '▲ Optimale ~30 min', tone: 'ok' })
  })

  it('démarrage possible', () => {
    expect(stationLine(moving(10), 25, opts(EXPLOIT)).text).toBe('▲ Démarrage ~30 min')
  })

  it('un seuil sans événement vers le bas est ignoré : on retient l’arrêt, plus loin', () => {
    // 35 m³/s à -10 m³/s/h : le seuil de démarrage (30) ne compte pas, le débit minimal (20) est atteint dans 1 h 30
    const line = stationLine(moving(-10), 35, opts(EXPLOIT))
    expect(line).toMatchObject({ arrow: '▼', text: '▼ Arrêt ~1 h 30', tone: 'warn' })
  })

  it('retient le seuil le plus proche, quel que soit l’ordre des bandes', () => {
    const near: TrendBand = { value: 30, up: { name: 'Proche', good: true } }
    const far: TrendBand = { value: 45, up: { name: 'Loin', good: true } }
    expect(stationLine(moving(10), 25, opts([near, far])).text).toBe('▲ Proche ~30 min')
    expect(stationLine(moving(10), 25, opts([far, near])).text).toBe('▲ Proche ~30 min')
  })

  it('station ordinaire : sortie de plage à surveiller, retour dans la plage bon', () => {
    const bands = stationBands({ low: 5, high: 20 })
    expect(stationLine(moving(2), 18, opts(bands))).toMatchObject({ text: '▲ Haut ~1 h', tone: 'warn' })
    expect(stationLine(moving(-3), 22, opts(bands))).toMatchObject({ text: '▼ Retour ~40 min', tone: 'ok' })
    expect(stationLine(moving(-1), 6, opts(bands))).toMatchObject({ text: '▼ Bas ~1 h', tone: 'warn' })
  })

  it('ignore un seuil déjà atteint', () => {
    expect(stationLine(moving(2), 20, opts(stationBands({ low: 5, high: 20 }))).text).toBe('▲ +2.00 m³/s/h')
  })

  it('ignore un seuil trop lointain', () => {
    expect(stationLine(moving(1), 10, opts(stationBands({ low: 5, high: 20 }))).text).toBe('▲ +1.00 m³/s/h')
  })
})

describe('stationLine · sans seuil proche', () => {
  const bands = stationBands({ low: 5, high: 20 })

  it('palier avec sa durée', () => {
    expect(stationLine(flatAnalysis(95), 10, opts(bands)).text).toBe('▬ stable 1 h 35')
  })

  it('aucune tendance significative', () => {
    const line = stationLine(flatAnalysis(null), 10, opts(bands))
    expect(line.text).toBe('▬ sans tendance')
    expect(line.title).toMatch(/Aucune tendance significative/)
  })

  it('pente en baisse, sans fenêtre (repli sur la pente 2 points)', () => {
    const line = stationLine(moving(-1.5, { windowMin: null, method: 'legacy' }), 10, opts(bands))
    expect(line.text).toBe('▼ -1.50 m³/s/h')
    expect(line.title).toBe('-1.50 m³/s/h')
  })
})

describe('stationLine · fraîcheur', () => {
  const bands = stationBands({ low: 5, high: 20 })

  it('signale une dernière mesure ancienne', () => {
    const line = stationLine(flatAnalysis(30), 10, opts(bands, 80))
    expect(line.text).toBe('▬ stable 30 min · 1 h 20')
    expect(line.title).toBe('Stable depuis 30 min. Dernière mesure il y a 1 h 20')
  })

  it('ne dit rien d’une mesure récente, ni quand l’âge n’a pas de sens', () => {
    expect(stationLine(flatAnalysis(30), 10, opts(bands, TREND_STALE_MIN)).text).toBe('▬ stable 30 min')
    expect(stationLine(flatAnalysis(30), 10, opts(bands, null)).text).toBe('▬ stable 30 min')
  })
})

describe('turbineBands', () => {
  const c = { refCode: 'X', minFlow: 20, startFlow: 30, maxFlow: 150, optMin: 45, optMax: 135, propagationMin: 90 }

  it('donne l’arrêt, le démarrage et la crue, sans zone optimale', () => {
    expect(turbineBands(c).map((b) => b.value)).toEqual([20, 30, 150])
    expect(turbineBands(c).flatMap((b) => [b.up?.name, b.down?.name]).join()).not.toContain('Optimale')
  })

  it('fusionne arrêt et démarrage quand ils sont au même débit', () => {
    expect(turbineBands({ ...c, startFlow: 20 }).map((b) => b.value)).toEqual([20, 150])
  })

  it('annonce le démarrage puis la crue', () => {
    expect(stationLine(moving(10), 25, opts(turbineBands(c))).text).toBe('▲ Démarrage ~30 min')
    expect(stationLine(moving(10), 145, opts(turbineBands(c))).text).toBe('▲ Crue ~30 min')
  })
})
