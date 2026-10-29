import { describe, expect, it } from 'vitest'
import { DEFAULT_TURBINE_MODEL as M } from './constants'
import {
  cloneTurbineModel,
  efficiencyAt,
  exploitConfigFromModel,
  grossHead,
  headAtLowFlow,
  maxSiteFlow,
  normTurbineModel,
  optimalRange,
  powerKw,
  startFlowOf,
  stopFlowOf,
  turbinedFlow,
} from './turbineModel'

describe('turbineModel · débits', () => {
  it('le débit de réserve s’ajoute au débit turbiné : démarrage à 5,5 + 30 % de 23,5', () => {
    expect(startFlowOf(M)).toBeCloseTo(12.55, 2)
    expect(stopFlowOf(M)).toBeCloseTo(12.55, 2)
  })

  it('préleve la réserve en premier et plafonne à la capacité', () => {
    expect(turbinedFlow(3, M)).toBe(0)
    expect(turbinedFlow(15.5, M)).toBeCloseTo(10, 6)
    expect(turbinedFlow(80, M)).toBe(23.5)
  })
})

describe('turbineModel · chute', () => {
  it('vaut 3,5 m à débit faible (-30 cm amont, -380 cm aval)', () => {
    expect(headAtLowFlow(M)).toBeCloseTo(3.5, 6)
    expect(grossHead(5, M)).toBeLessThanOrEqual(3.5)
    expect(grossHead(5, M)).toBeGreaterThan(3.4)
  })

  it('diminue quand le débit augmente (le niveau aval monte)', () => {
    expect(grossHead(20, M)).toBeGreaterThan(grossHead(40, M))
    expect(grossHead(40, M)).toBeGreaterThan(grossHead(80, M))
  })

  it('applique la correction de chute', () => {
    expect(grossHead(20, { ...M, headCorrection: 0.1 })).toBeCloseTo(grossHead(20, M) - 0.1, 6)
  })

  it('le débit maximum est celui où la chute atteint le minimum', () => {
    const q = maxSiteFlow(M)
    expect(grossHead(q, M)).toBeCloseTo(M.headMin, 2)
    expect(q).toBeGreaterThan(80)
    expect(q).toBeLessThan(120)
  })
})

describe('turbineModel · puissance', () => {
  it('est nulle sous le débit de démarrage', () => {
    expect(powerKw(10, M)).toBe(0)
  })

  it('croît avec le débit puis plafonne à la puissance nominale', () => {
    expect(powerKw(15, M)).toBeGreaterThan(powerKw(13, M))
    expect(powerKw(29, M)).toBe(450)
    expect(powerKw(40, M)).toBeLessThanOrEqual(450)
  })

  it('retrouve ~200 kW pour ~9,7 m³/s turbinés (événement du 26/10)', () => {
    expect(powerKw(5.5 + 9.7, M)).toBeGreaterThan(180)
    expect(powerKw(5.5 + 9.7, M)).toBeLessThan(230)
  })

  it('baisse en crue quand la chute s’efface, puis s’arrête sous la chute minimale', () => {
    expect(powerKw(90, M)).toBeLessThan(powerKw(40, M))
    expect(powerKw(maxSiteFlow(M) + 5, M)).toBe(0)
  })
})

describe('turbineModel · rendement', () => {
  it('interpole la courbe selon la charge et reste constant au-delà des extrémités', () => {
    expect(efficiencyAt(0.1, M)).toBe(0.5)
    expect(efficiencyAt(0.3, M)).toBeCloseTo(0.5, 6)
    expect(efficiencyAt(0.41, M)).toBeCloseTo(0.65, 6)
    expect(efficiencyAt(0.355, M)).toBeCloseTo(0.575, 6)
    expect(efficiencyAt(1, M)).toBeCloseTo(0.66, 6)
  })

  it('utilise le rendement constant sans courbe', () => {
    expect(efficiencyAt(0.5, { ...M, efficiencyCurve: [], efficiency: 0.7 })).toBe(0.7)
  })

  it('donne ~110 kW au démarrage (30 % de charge), comme l’exploitation', () => {
    expect(powerKw(startFlowOf(M), M)).toBeGreaterThan(100)
    expect(powerKw(startFlowOf(M), M)).toBeLessThan(125)
  })
})

describe('turbineModel · zone optimale', () => {
  it('est déduite : au moins 80 % de la puissance nominale', () => {
    const opt = optimalRange(M)!
    expect(opt.low).toBeGreaterThan(startFlowOf(M))
    expect(opt.high).toBeLessThan(maxSiteFlow(M))
    expect(powerKw(opt.low + 0.25, M)).toBeGreaterThanOrEqual(0.8 * 450)
    expect(powerKw(opt.high + 1, M)).toBeLessThan(0.8 * 450)
  })

  it('n’existe pas si le rendement ne permet jamais d’atteindre le seuil', () => {
    expect(optimalRange({ ...M, efficiencyCurve: [], efficiency: 0.1 })).toBeNull()
  })

  it('produit une configuration d’exploitation valide, sans délai (série déjà décalée)', () => {
    const c = exploitConfigFromModel(M)
    // seuils ordonnes : arret < demarrage < crue, zone optimale entre les deux
    expect(c.minFlow).toBeGreaterThan(0)
    expect(c.startFlow).toBeGreaterThanOrEqual(c.minFlow)
    expect(c.maxFlow).toBeGreaterThan(c.startFlow)
    expect(c.optMin).toBeGreaterThan(c.minFlow)
    expect(c.optMax).toBeGreaterThan(c.optMin)
    expect(c.optMax).toBeLessThanOrEqual(c.maxFlow)
    expect(c.propagationMin).toBe(0)
    expect(c.startFlow).toBeCloseTo(12.55, 2)
  })
})

describe('normTurbineModel', () => {
  it('rejette ce qui n’est pas un objet', () => {
    expect(normTurbineModel(null, M)).toBeNull()
    expect(normTurbineModel('x', M)).toBeNull()
  })

  it('rejette une courbe de rendement invalide ou non croissante', () => {
    expect(normTurbineModel({ efficiencyCurve: [[0.5, 0.6], [0.4, 0.7]] }, M)!.efficiencyCurve).toEqual(M.efficiencyCurve)
    expect(normTurbineModel({ efficiencyCurve: 'x' }, M)!.efficiencyCurve).toEqual(M.efficiencyCurve)
    expect(normTurbineModel({ efficiencyCurve: [[0.2, 0.4], [1, 0.7]] }, M)!.efficiencyCurve).toEqual([[0.2, 0.4], [1, 0.7]])
  })

  it('complète les valeurs manquantes ou invalides avec la configuration par défaut', () => {
    const m = normTurbineModel({ efficiency: 0.7, reserveFlow: 'x', lag: { refMin: 100 } }, M)!
    expect(m.efficiency).toBe(0.7)
    expect(m.reserveFlow).toBe(M.reserveFlow)
    expect(m.lag).toEqual({ ...M.lag, refMin: 100 })
  })
})

describe('cloneTurbineModel', () => {
  it('ne partage aucun objet imbriqué avec l’original', () => {
    const c = cloneTurbineModel(M)
    expect(c).toEqual(M)
    c.lag.refMin = 1
    c.tailRating.a = 1
    c.efficiencyCurve[0]![1] = 0.1
    expect(M.lag.refMin).toBe(90)
    expect(M.tailRating.a).toBe(0.0083)
    expect(M.efficiencyCurve[0]![1]).toBe(0.5)
  })
})
