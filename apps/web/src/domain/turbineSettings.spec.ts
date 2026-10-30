import { describe, expect, it } from 'vitest'
import { DEFAULT_TURBINE_MODEL } from './constants'
import { getSetting, refSpaceConfig, setSetting, toRefFlow, TURBINE_FIELDS, turbinePreview, validateTurbineModel } from './turbineSettings'
import type { TurbineModel } from './types'

const fresh = (): TurbineModel => structuredClone(DEFAULT_TURBINE_MODEL)

describe('TURBINE_FIELDS', () => {
  it('chaque réglage pointe vers un nombre du modèle par défaut', () => {
    for (const f of TURBINE_FIELDS) expect(Number.isFinite(getSetting(DEFAULT_TURBINE_MODEL, f.path))).toBe(true)
  })

  it('les chemins sont uniques et les bornes cohérentes', () => {
    expect(new Set(TURBINE_FIELDS.map((f) => f.path)).size).toBe(TURBINE_FIELDS.length)
    for (const f of TURBINE_FIELDS) {
      if (f.min !== undefined && f.max !== undefined) expect(f.min).toBeLessThan(f.max)
      expect(f.step).toBeGreaterThan(0)
    }
  })

  it('les valeurs par défaut respectent les bornes', () => {
    for (const f of TURBINE_FIELDS) {
      const v = getSetting(DEFAULT_TURBINE_MODEL, f.path)
      if (f.min !== undefined) expect(v).toBeGreaterThanOrEqual(f.min)
      if (f.max !== undefined) expect(v).toBeLessThanOrEqual(f.max)
    }
  })
})

describe('getSetting / setSetting', () => {
  it('lit et écrit un réglage imbriqué', () => {
    const m = fresh()
    setSetting(m, 'lag.refMin', 77)
    expect(getSetting(m, 'lag.refMin')).toBe(77)
    expect(m.lag.refMin).toBe(77)
    setSetting(m, 'reserveFlow', 4)
    expect(m.reserveFlow).toBe(4)
  })

  it('n’altère pas le modèle par défaut', () => {
    setSetting(fresh(), 'reserveFlow', 99)
    expect(DEFAULT_TURBINE_MODEL.reserveFlow).toBe(5.5)
  })
})

describe('validateTurbineModel', () => {
  it('accepte les valeurs par défaut', () => {
    expect(validateTurbineModel(fresh())).toBeNull()
  })

  it('exige une station de référence', () => {
    expect(validateTurbineModel({ ...fresh(), refCode: '' })).toMatch(/station amont/)
  })

  it('la station aval est facultative', () => {
    expect(validateTurbineModel({ ...fresh(), downCode: '' })).toBeNull()
  })

  it('rejette un champ vide (NaN)', () => {
    const m = fresh()
    setSetting(m, 'reserveFlow', Number.NaN)
    expect(validateTurbineModel(m)).toBe('« Débit réservé » doit être un nombre.')
  })

  it('rejette une valeur hors bornes', () => {
    const m = fresh()
    setSetting(m, 'startRatio', 1.5)
    expect(validateTurbineModel(m)).toBe('« Débit de démarrage » doit être au plus 1.')
    const n = fresh()
    setSetting(n, 'reserveFlow', -1)
    expect(validateTurbineModel(n)).toBe('« Débit réservé » doit être au moins 0.')
  })

  it.each([
    ['stopRatio', 0.5, /débit d’arrêt/],
    ['headMax', 1, /chute maximale/],
    ['poolLowCm', -400, /niveau amont/],
    ['reducedPowerKw', 900, /régime réduit/],
    ['lag.maxMin', 10, /délai maximal/],
    ['maxTurbineFlow', 0, /capacité/],
  ])('rejette une incohérence sur %s', (path, value, message) => {
    const m = fresh()
    setSetting(m, path, value as number)
    expect(validateTurbineModel(m)).toMatch(message as RegExp)
  })

  it('valide la courbe de rendement', () => {
    expect(validateTurbineModel({ ...fresh(), efficiencyCurve: [[0.5, 0.6], [0.4, 0.7]] })).toMatch(/croissantes/)
    expect(validateTurbineModel({ ...fresh(), efficiencyCurve: [[0.5, 1.4]] })).toMatch(/entre 0 et 1/)
    expect(validateTurbineModel({ ...fresh(), efficiencyCurve: [] })).toBeNull()
    expect(validateTurbineModel({ ...fresh(), efficiencyCurve: [], efficiency: 0 })).toMatch(/rendement/)
  })

  it('rejette une chute à débit faible inférieure à la chute minimale', () => {
    const m = fresh()
    m.tailLowCm = -100
    expect(validateTurbineModel(m)).toMatch(/chute à débit faible/)
  })
})

describe('turbinePreview', () => {
  it('résume le démarrage, le débit de crue et la puissance à pleine capacité', () => {
    const p = turbinePreview(fresh())
    expect(p.startFlow).toBeCloseTo(12.55, 2)
    expect(p.stopFlow).toBeCloseTo(12.55, 2)
    expect(p.maxFlow).toBeGreaterThan(80)
    expect(p.maxFlow).toBeLessThan(120)
    expect(p.fullPowerKw).toBeGreaterThan(400)
    expect(p.fullPowerKw).toBeLessThanOrEqual(450)
  })

  it('suit les réglages', () => {
    const m = fresh()
    m.reserveFlow = 4
    expect(turbinePreview(m).startFlow).toBeCloseTo(11.05, 2)
  })
})

describe('station de référence : équivalence des débits', () => {
  it('inverse le passage gain / décalage', () => {
    const m = fresh()
    expect(toRefFlow(m.defaultGain * 30 + m.defaultOffset, m)).toBeCloseTo(30, 6)
  })

  it('exprime les seuils du modèle en débit de la station de référence', () => {
    const c = refSpaceConfig(fresh())
    expect(c.refCode).toBe('O469251003')
    expect(c.startFlow).toBeCloseTo(25.34, 1)
    expect(c.minFlow).toBeLessThanOrEqual(c.startFlow)
    expect(c.maxFlow).toBeGreaterThan(c.startFlow)
    expect(c.propagationMin).toBe(65)
  })
})
