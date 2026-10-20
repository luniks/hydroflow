import { describe, expect, it } from 'vitest'
import { TEST_EXPLOIT } from '@/test/exploitFixture'
import { EXPLOIT_DEFAULTS } from './constants'
import { inferTurbineState, outlookForState, turbineOutlook } from './turbineOutlook'
import type { ExploitConfig, SeriesPoint } from './types'

const NOW = Date.parse('2026-01-01T12:00:00Z')

/** Serie a partir de couples [minutes ecoulees, debit], du plus ancien au plus recent. */
const pts = (...pairs: [number, number][]): SeriesPoint[] =>
  pairs.map(([ago, y]) => ({ t: new Date(NOW - ago * 60_000).toISOString(), y }))

const flat = (y: number): SeriesPoint[] => pts([120, y], [60, y], [0, y])

// minFlow 5.5 · startFlow 8 · optimal 10–19 · maxFlow 23.5 · propagation 30 min · marge de vigilance 1,8 m³/s
const c: ExploitConfig = { ...TEST_EXPLOIT }

describe('turbineOutlook · cas sans prévision', () => {
  it('attend une mesure', () => {
    const o = turbineOutlook([], c, NOW)
    expect(o).toMatchObject({ kind: 'unknown', stability: null, turbine: null, inMinutes: null })
    expect(o.headline).toBe('En attente de mesure…')
  })

  it('refuse de prévoir à partir d’une mesure trop ancienne', () => {
    const o = turbineOutlook(pts([180, 10], [170, 10]), c, NOW)
    expect(o).toMatchObject({ kind: 'stale', tone: 'warn', turbine: null })
    expect(o.headline).toBe('Aucune prévision · dernière mesure il y a 2 h 50')
    expect(o.detail).toContain('plus de 2 h')
  })

  it('accepte une mesure tout juste dans la limite', () => {
    expect(turbineOutlook(pts([120, 14]), c, NOW).kind).not.toBe('stale')
    expect(turbineOutlook(pts([121, 14]), c, NOW).kind).toBe('stale')
  })
})

describe('inferTurbineState', () => {
  it('suppose la turbine en marche quand le débit permet de démarrer', () => {
    expect(inferTurbineState(flat(14), c, NOW)).toBe('run')
  })

  it('suppose la turbine à l’arrêt sous le débit de démarrage, y compris dans la zone d’hystérésis', () => {
    expect(inferTurbineState(flat(2), c, NOW)).toBe('stop')
    expect(inferTurbineState(flat(7), c, NOW)).toBe('stop')
  })

  it('suppose la turbine à l’arrêt au-dessus du débit maximum', () => {
    expect(inferTurbineState(flat(30), c, NOW)).toBe('stop')
  })

  it('démarre quand le débit atteint le seuil de démarrage', () => {
    expect(inferTurbineState(pts([120, 3], [90, 6], [60, 8]), c, NOW)).toBe('run')
  })

  it('reste à l’arrêt tant que le démarrage n’est pas atteint', () => {
    expect(inferTurbineState(pts([120, 3], [90, 6], [60, 7.9]), c, NOW)).toBe('stop')
  })

  it('conserve la marche dans la zone d’hystérésis après un démarrage', () => {
    expect(inferTurbineState(pts([150, 12], [120, 9], [90, 7], [60, 6]), c, NOW)).toBe('run')
  })

  it('s’arrête sous le débit minimal et ne redémarre pas dans la zone d’hystérésis', () => {
    expect(inferTurbineState(pts([150, 12], [120, 5], [90, 7], [60, 7.5]), c, NOW)).toBe('stop')
  })

  it('s’arrête au-dessus du débit maximum, puis redémarre quand le débit redescend', () => {
    expect(inferTurbineState(pts([150, 14], [120, 26]), c, NOW)).toBe('stop')
    expect(inferTurbineState(pts([150, 14], [120, 26], [90, 20]), c, NOW)).toBe('run')
  })

  it('ne tient pas compte des mesures qui ne sont pas encore arrivées à la turbine', () => {
    // 4 m³/s mesuré il y a 10 min n'arrive qu'à la turbine dans 20 min (délai 30).
    expect(inferTurbineState(pts([120, 14], [60, 14], [10, 4]), c, NOW)).toBe('run')
  })

  it('retombe sur la plus ancienne mesure quand aucune n’est encore arrivée', () => {
    expect(inferTurbineState(pts([20, 14], [0, 4]), c, NOW)).toBe('run')
    expect(inferTurbineState(pts([20, 4], [0, 14]), c, NOW)).toBe('stop')
  })
})

describe('turbineOutlook · état déduit de l’historique', () => {
  it('annonce un arrêt à venir pour une turbine déduite en marche', () => {
    const o = turbineOutlook(pts([120, 14], [30, 9], [0, 4]), c, NOW)
    expect(o).toMatchObject({ kind: 'stop-expected', turbine: 'run', headline: 'Arrêt prévu dans 22 min' })
  })

  it('annonce un démarrage à venir pour une turbine déduite à l’arrêt', () => {
    const o = turbineOutlook(pts([120, 3], [30, 6], [0, 12]), c, NOW)
    expect(o).toMatchObject({ kind: 'start-expected', turbine: 'stop', headline: 'Démarrage prévu dans 10 min' })
  })

  it('ne propose pas un démarrage immédiat quand la turbine tourne déjà', () => {
    expect(turbineOutlook(flat(14), c, NOW).kind).toBe('run-stable')
  })
})

describe('outlookForState · turbine en marche', () => {
  it('exige l’arrêt immédiat sous le débit minimal', () => {
    const o = outlookForState(flat(4), c, 'run', NOW)
    expect(o).toMatchObject({ kind: 'stop-now', tone: 'danger', inMinutes: 0 })
    expect(o.headline).toBe('Arrêt requis · débit sous le minimal')
    expect(o.detail).toContain('sous le débit minimal (5.5 m³/s)')
  })

  it('exige l’arrêt immédiat au-dessus du débit maximum', () => {
    const o = outlookForState(flat(30), c, 'run', NOW)
    expect(o).toMatchObject({ kind: 'stop-now', tone: 'danger', inMinutes: 0 })
    expect(o.headline).toBe('Arrêt requis · débit au-dessus du maximum')
    expect(o.detail).toContain('au-dessus du débit maximum (23.5 m³/s)')
  })

  it('juge la production stable quand rien ne bouge', () => {
    const o = outlookForState(flat(14), c, 'run', NOW)
    expect(o).toMatchObject({ kind: 'run-stable', tone: 'ok', stability: 'stable', turbine: 'run', inMinutes: null })
    expect(o.detail).toContain('aucun arrêt prévu dans les 2 h')
  })

  it('reste en marche sous le seuil de démarrage (hystérésis)', () => {
    const o = outlookForState(flat(7), c, 'run', NOW)
    expect(o.kind).not.toBe('stop-now')
    expect(o.kind).toBe('run-watch')
  })

  it('annonce un arrêt par le bas déjà visible en amont (source observée)', () => {
    // 9 → 4 m³/s sur les 30 dernières minutes : arrive à la turbine dans les 30 prochaines.
    const o = outlookForState(pts([30, 9], [0, 4]), c, 'run', NOW)
    expect(o).toMatchObject({ kind: 'stop-expected', tone: 'warn', stability: 'changing', source: 'observed' })
    expect(o.inMinutes).toBe(22)
    expect(o.headline).toBe('Arrêt prévu dans 22 min')
    expect(o.detail).toContain('passage sous le débit minimal (5.5 m³/s)')
    expect(o.detail).toContain('déjà mesuré en amont')
  })

  it('annonce un arrêt par le haut déjà visible en amont', () => {
    const o = outlookForState(pts([30, 20], [0, 27]), c, 'run', NOW)
    expect(o).toMatchObject({ kind: 'stop-expected', source: 'observed', inMinutes: 16 })
    expect(o.detail).toContain('dépassement du débit maximum (23.5 m³/s)')
  })

  it('extrapole la tendance quand l’arrêt dépasse les mesures connues (source estimée)', () => {
    const down = outlookForState(pts([90, 12], [60, 10], [30, 8], [0, 6.5]), c, 'run', NOW)
    expect(down).toMatchObject({ kind: 'stop-expected', source: 'estimated', inMinutes: 48 })
    expect(down.headline).toBe('Arrêt probable dans ~48 min')
    expect(down.detail).toContain('estimé d’après la tendance')

    const up = outlookForState(pts([60, 15], [0, 21]), c, 'run', NOW)
    expect(up).toMatchObject({ kind: 'stop-expected', source: 'estimated', inMinutes: 56 })
    expect(up.detail).toContain('dépassement du débit maximum')
  })

  it('signale une marche à surveiller près du débit minimal', () => {
    const o = outlookForState(flat(6.5), c, 'run', NOW)
    expect(o).toMatchObject({ kind: 'run-watch', tone: 'warn', stability: 'watch' })
    expect(o.detail).toContain('à 1 m³/s du débit minimal (5.5 m³/s)')
  })

  it('signale une marche à surveiller près du débit maximum', () => {
    const o = outlookForState(flat(22.5), c, 'run', NOW)
    expect(o.kind).toBe('run-watch')
    expect(o.detail).toContain('à 1 m³/s du débit maximum (23.5 m³/s)')
  })

  it('signale une marche à surveiller quand le débit dérive vers le minimal sans le franchir', () => {
    // 7,45 m³/s à la turbine maintenant (écart 1,95 > marge 1,8), mais ~5,65 m³/s en fin d'horizon.
    const o = outlookForState(pts([60, 7.9], [0, 7]), c, 'run', NOW)
    expect(o).toMatchObject({ kind: 'run-watch', stability: 'watch' })
    expect(o.detail).toContain('du débit minimal')
  })

  it('signale une marche à surveiller quand le débit dérive vers le maximum sans le franchir', () => {
    // 20,55 m³/s à la turbine maintenant (écart 2,95), mais ~22,35 m³/s en fin d'horizon.
    const o = outlookForState(pts([60, 20.1], [0, 21]), c, 'run', NOW)
    expect(o).toMatchObject({ kind: 'run-watch', stability: 'watch' })
    expect(o.detail).toContain('du débit maximum')
  })

  it('juge la production stable quand la dérive reste loin des seuils', () => {
    const o = outlookForState(pts([60, 10], [0, 9.5]), c, 'run', NOW)
    expect(o.kind).toBe('run-stable')
  })

  it('calcule à partir de la tendance quand la mesure est plus ancienne que le délai', () => {
    // dernière mesure il y a 45 min, délai 30 min : tout l’horizon est estimé, débit plat.
    const o = outlookForState(pts([105, 14], [45, 14]), c, 'run', NOW)
    expect(o.kind).toBe('run-stable')
  })

  it('borne la lecture à la plus ancienne mesure quand le délai dépasse l’historique', () => {
    const o = outlookForState(flat(14), { ...c, propagationMin: 300 }, 'run', NOW)
    expect(o.kind).toBe('run-stable')
  })

  it('sans délai de propagation, le débit mesuré est celui de la turbine', () => {
    const o = outlookForState(flat(4), { ...c, propagationMin: 0 }, 'run', NOW)
    expect(o.kind).toBe('stop-now')
  })
})

describe('outlookForState · turbine à l’arrêt', () => {
  it('autorise le démarrage quand le débit est dans la plage', () => {
    const o = outlookForState(flat(14), c, 'stop', NOW)
    expect(o).toMatchObject({ kind: 'start-now', tone: 'ok', inMinutes: 0 })
    expect(o.headline).toBe('Démarrage possible maintenant')
  })

  it('autorise le démarrage pile au débit de démarrage et pile au débit maximum', () => {
    expect(outlookForState(flat(8), c, 'stop', NOW).kind).toBe('start-now')
    expect(outlookForState(flat(23.5), c, 'stop', NOW).kind).toBe('start-now')
  })

  it('annonce un démarrage déjà visible en amont (source observée)', () => {
    const o = outlookForState(pts([30, 6], [0, 12]), c, 'stop', NOW)
    expect(o).toMatchObject({ kind: 'start-expected', tone: 'accent', source: 'observed', inMinutes: 10 })
    expect(o.headline).toBe('Démarrage prévu dans 10 min')
    expect(o.detail).toContain('atteinte du débit de démarrage (8 m³/s)')
  })

  it('estime un démarrage lointain d’après la tendance', () => {
    const o = outlookForState(pts([60, 4], [0, 6]), c, 'stop', NOW)
    expect(o).toMatchObject({ kind: 'start-expected', source: 'estimated', inMinutes: 90 })
    expect(o.headline).toBe('Démarrage probable dans ~1 h 30')
  })

  it('annonce un redémarrage quand le débit repasse sous le maximum', () => {
    const o = outlookForState(pts([30, 30], [0, 20]), c, 'stop', NOW)
    expect(o).toMatchObject({ kind: 'start-expected', source: 'observed', inMinutes: 20 })
    expect(o.headline).toBe('Redémarrage prévu dans 20 min')
    expect(o.detail).toContain('retour sous le débit maximum (23.5 m³/s)')
  })

  it('reste bloqué tant que le débit dépasse le maximum', () => {
    const o = outlookForState(flat(30), c, 'stop', NOW)
    expect(o).toMatchObject({ kind: 'stopped-blocked', tone: 'danger', stability: 'stable' })
    expect(o.detail).toContain('pas de redémarrage prévu')
  })

  it('signale un arrêt proche du seuil de démarrage', () => {
    const o = outlookForState(flat(7), c, 'stop', NOW)
    expect(o).toMatchObject({ kind: 'stopped-watch', tone: 'warn', stability: 'watch' })
    expect(o.detail).toContain('à 1 m³/s du débit de démarrage (8 m³/s)')
  })

  it('signale un arrêt à surveiller quand le débit monte vers le seuil de démarrage sans l’atteindre', () => {
    // 4,45 m³/s à la turbine maintenant (écart 3,55), mais ~6,25 m³/s en fin d'horizon (écart 1,75 < 1,8).
    const o = outlookForState(pts([60, 4], [0, 4.9]), c, 'stop', NOW)
    expect(o).toMatchObject({ kind: 'stopped-watch', stability: 'watch' })
  })

  it('juge l’arrêt stable entre débit minimal et débit de démarrage (hystérésis)', () => {
    const o = outlookForState(flat(6), c, 'stop', NOW)
    expect(o).toMatchObject({ kind: 'stopped-stable', tone: 'neutral', stability: 'stable' })
    expect(o.headline).toBe('Arrêt stable')
  })

  it('juge l’arrêt stable quand le débit est très bas', () => {
    expect(outlookForState(flat(2), c, 'stop', NOW).kind).toBe('stopped-stable')
  })
})

describe('turbineOutlook · valeurs par défaut du site', () => {
  it('juge stable une turbine qui tourne dans la plage optimale', () => {
    expect(turbineOutlook(flat(90), EXPLOIT_DEFAULTS, NOW).kind).toBe('run-stable')
  })

  it('reste à l’arrêt sous le débit de démarrage, en signalant la proximité du seuil', () => {
    // Marge de vigilance = 10 % de (150 − 20) = 13 m³/s.
    expect(turbineOutlook(flat(25), EXPLOIT_DEFAULTS, NOW).kind).toBe('stopped-watch')
    expect(turbineOutlook(flat(15), EXPLOIT_DEFAULTS, NOW).kind).toBe('stopped-stable')
  })

  it('annonce un démarrage quand le débit atteint 30 m³/s', () => {
    // 22 → 40 m³/s en 30 min : le seuil de démarrage (30) est franchi à 13,3 min, soit à la 14e minute.
    const o = turbineOutlook(pts([30, 22], [0, 40]), EXPLOIT_DEFAULTS, NOW)
    expect(o).toMatchObject({ kind: 'start-expected', source: 'observed', turbine: 'stop' })
    expect(o.headline).toBe('Démarrage prévu dans 14 min')
  })
})
