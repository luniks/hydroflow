import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { config } from '@/config/env'
import { DEFAULT_STATIONS, STORAGE_KEYS } from '@/domain/constants'
import { server } from '@/test/msw/server'
import { makeStation, useStations } from './useStations'

const api = useStations()

beforeEach(async () => {
  api.reset()
  await nextTick()
})

describe('useStations', () => {
  it('démarre sur les stations par défaut', () => {
    expect(api.codes.value).toEqual(DEFAULT_STATIONS.map((s) => s.code))
  })

  it('persiste la liste sous la clé legacy', async () => {
    api.remove('O460251001')
    await nextTick()
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.stations)!)
    expect(saved.map((s: { code: string }) => s.code)).toEqual(['O469251003', 'O480252002'])
  })

  it('autorise une liste vide', async () => {
    for (const code of [...api.codes.value]) api.remove(code)
    await nextTick()
    expect(api.stations.value).toEqual([])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.stations)!)).toEqual([])
  })

  it('refuse d’ajouter un code en doublon', () => {
    expect(api.add(makeStation('O460251001', 'Amont', {}))).toBe(false)
    expect(api.add(makeStation('O999999999', 'Aval', { name: 'Neuve' }))).toBe(true)
    expect(api.codes.value).toHaveLength(4)
  })

  it('réordonne la liste', () => {
    api.reorder(0, 2)
    expect(api.codes.value).toEqual(['O469251003', 'O480252002', 'O460251001'])
  })

  it('ignore un réordonnancement hors bornes', () => {
    const before = [...api.codes.value]
    api.reorder(99, 0)
    expect(api.codes.value).toEqual(before)
  })

  it('change le libellé d’une station', () => {
    api.setLabel('O460251001', 'Aval')
    expect(api.stations.value[0]!.label).toBe('Aval')
  })

  it('purge l’état des stations retirées', () => {
    api.syncStates()
    expect(Object.keys(api.states)).toHaveLength(3)
    api.remove('O460251001')
    expect(Object.keys(api.states)).toEqual(['O469251003', 'O480252002'])
  })

  it('charge les observations et renseigne le nom de la station', async () => {
    server.use(
      http.get(`${config.hubeauUrl}/observations_tr`, () =>
        HttpResponse.json({
          data: [{ date_obs: new Date().toISOString(), grandeur_hydro: 'H', resultat_obs: 1500 }],
          next: null,
        }),
      ),
    )
    const station = api.stations.value[0]!
    await api.loadStation(station, 24, 0)
    const state = api.stateOf(station.code)
    expect(state.error).toBeNull()
    expect(state.name).toBe('Station de test')
    expect(state.points).toHaveLength(1)
    expect(api.displayName(station)).toBe('Station de test')
  })

  it('mémorise l’erreur sans vider la station', async () => {
    server.use(
      http.get(`${config.hubeauUrl}/observations_tr`, () => new HttpResponse(null, { status: 500 })),
    )
    const station = api.stations.value[0]!
    await api.loadStation(station, 24, 0)
    expect(api.stateOf(station.code).error).toMatch(/500/)
    expect(api.stateOf(station.code).fetching).toBe(false)
  })
})

describe('makeStation', () => {
  it('construit une station à partir des infos Hub’Eau', () => {
    const s = makeStation('O123456789', 'Aval', { name: 'Test', river: 'Le Tarn', lat: 43, lon: 1 })
    expect(s).toMatchObject({
      code: 'O123456789',
      fallbackName: 'Test',
      fallbackRiver: 'Le Tarn',
      label: 'Aval',
      lat: 43,
      lon: 1,
    })
    expect(s.url).toContain('O123456789')
  })

  it('retombe sur le code quand le nom est inconnu', () => {
    expect(makeStation('X', 'Amont', {}).fallbackName).toBe('X')
  })
})
