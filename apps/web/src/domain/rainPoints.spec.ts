import { describe, expect, it } from 'vitest'
import type { RainPointDef } from './types'
import {
  externalRainKey,
  findNearbyRainPoint,
  makeExternalRainDef,
  roundCoord,
  validateManualRainPoint,
} from './rainPoints'

const castres: RainPointDef = { key: 'castres', name: 'Castres', context: '', lat: 43.6047, lon: 2.2417 }

function many(n: number): RainPointDef[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `p${i}`,
    name: `P${i}`,
    context: '',
    lat: 10 + i,
    lon: 10 + i,
  }))
}

describe('externalRainKey', () => {
  it('derive la clé des coordonnées au millième', () => {
    expect(externalRainKey(43.642, 2.242)).toBe('ext_43642_2242')
  })

  it('gère les coordonnées négatives', () => {
    expect(externalRainKey(-1.2345, -0.5)).toBe('ext_-1234_-500')
  })
})

describe('roundCoord', () => {
  it('arrondit à quatre décimales', () => {
    expect(roundCoord(43.60471234)).toBe(43.6047)
  })
})

describe('findNearbyRainPoint', () => {
  it('retourne le point proche', () => {
    expect(findNearbyRainPoint(43.605, 2.242, [castres])).toBe(castres)
  })

  it('retourne null au-delà du seuil', () => {
    expect(findNearbyRainPoint(44, 3, [castres])).toBeNull()
  })
})

describe('validateManualRainPoint', () => {
  it('refuse un nom vide', () => {
    expect(validateManualRainPoint({ name: '  ', lat: 43, lon: 2 }, [])).toBe('Indiquez un nom.')
  })

  it('refuse une latitude absente ou hors bornes', () => {
    expect(validateManualRainPoint({ name: 'X', lat: null, lon: 2 }, [])).toBe(
      'Latitude invalide (entre -90 et 90).',
    )
    expect(validateManualRainPoint({ name: 'X', lat: 91, lon: 2 }, [])).toBe(
      'Latitude invalide (entre -90 et 90).',
    )
    expect(validateManualRainPoint({ name: 'X', lat: -91, lon: 2 }, [])).toBe(
      'Latitude invalide (entre -90 et 90).',
    )
  })

  it('refuse une longitude absente ou hors bornes', () => {
    expect(validateManualRainPoint({ name: 'X', lat: 43, lon: null }, [])).toBe(
      'Longitude invalide (entre -180 et 180).',
    )
    expect(validateManualRainPoint({ name: 'X', lat: 43, lon: 181 }, [])).toBe(
      'Longitude invalide (entre -180 et 180).',
    )
    expect(validateManualRainPoint({ name: 'X', lat: 43, lon: -181 }, [])).toBe(
      'Longitude invalide (entre -180 et 180).',
    )
  })

  it('refuse au-delà du maximum de points amont', () => {
    expect(validateManualRainPoint({ name: 'X', lat: 43, lon: 2 }, many(8))).toBe(
      'Maximum 8 points amont.',
    )
  })

  it('refuse un lieu déjà présent', () => {
    expect(validateManualRainPoint({ name: 'Castres bis', lat: 43.605, lon: 2.2418 }, [castres])).toBe(
      'Ce lieu est déjà dans la liste (« Castres »).',
    )
  })

  it('accepte une saisie valide', () => {
    expect(validateManualRainPoint({ name: 'Brassac', lat: 43.63, lon: 2.49 }, [castres])).toBeNull()
  })
})

describe('makeExternalRainDef', () => {
  it('normalise les coordonnées et génère la clé', () => {
    const def = makeExternalRainDef(' Brassac ', 43.6299999, 2.4900001, 'Tarn')
    expect(def).toEqual({ key: 'ext_43630_2490', name: 'Brassac', context: 'Tarn', lat: 43.63, lon: 2.49 })
  })

  it('utilise un contexte vide par défaut', () => {
    expect(makeExternalRainDef('X', 1, 2).context).toBe('')
  })
})
