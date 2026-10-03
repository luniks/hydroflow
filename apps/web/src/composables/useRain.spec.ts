import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { config } from '@/config/env'
import { DEFAULT_EXTERNAL_RAIN_DEFS, RAIN_EXTERNAL_MAX, STORAGE_KEYS } from '@/domain/constants'
import { server } from '@/test/msw/server'
import { slugifyPlaceKey, useRain } from './useRain'
import { useStations } from './useStations'

const stations = useStations()
const rain = useRain()

const hourly = (n: number, mm: number) => ({
  hourly: {
    time: Array.from({ length: n }, (_, i) => new Date(i * 3_600_000).toISOString()),
    precipitation: Array.from({ length: n }, () => mm),
  },
})

beforeEach(async () => {
  stations.reset()
  rain.resetExternal()
  rain.hiddenKeys.value = []
  await nextTick()
  rain.syncStates()
})

describe('useRain', () => {
  it('génère un point pluie par station géolocalisée', () => {
    expect(rain.stationPoints.value.map((p) => p.key)).toEqual([
      'station_O460251001',
      'station_O469251003',
      'station_O480252002',
    ])
    expect(rain.stationPoints.value[0]!.context).toContain('Station suivie')
  })

  it('ignore les stations sans coordonnées', () => {
    stations.stations.value[0]!.lat = undefined
    expect(rain.stationPoints.value).toHaveLength(2)
  })

  it('crée l’état dès qu’un point apparaît, sans attendre un chargement', () => {
    stations.stations.value[0]!.lat = undefined
    expect(rain.states['station_O460251001']).toBeUndefined()

    stations.stations.value[0]!.lat = 43.6192
    // Les cartes se rendent immédiatement : l'état doit exister sans appel explicite.
    expect(rain.states['station_O460251001']).toBeDefined()
  })

  it('expose les points amont par défaut', () => {
    expect(rain.externalPoints.value.map((p) => p.key)).toEqual(
      DEFAULT_EXTERNAL_RAIN_DEFS.map((d) => d.key),
    )
    expect(rain.isExternalDefault.value).toBe(true)
  })

  it('masque un point et purge son état', async () => {
    rain.setHidden('station_O460251001', true)
    await nextTick()
    expect(rain.isHidden('station_O460251001')).toBe(true)
    expect(rain.visiblePoints.value).toHaveLength(5)
    expect(rain.states['station_O460251001']).toBeUndefined()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.rainHidden)!)).toEqual([
      'station_O460251001',
    ])
  })

  it('réaffiche un point masqué', async () => {
    rain.setHidden('castres', true)
    rain.setHidden('castres', false)
    await nextTick()
    expect(rain.states['castres']).toBeDefined()
  })

  it('ajoute et retire un point amont', async () => {
    expect(rain.addExternal({ key: 'albi', name: 'Albi', lat: 43.9, lon: 2.1 })).toBe(true)
    await nextTick()
    expect(rain.isExternalDefault.value).toBe(false)
    rain.removeExternal('albi')
    await nextTick()
    expect(rain.externalDefs.value.map((d) => d.key)).not.toContain('albi')
  })

  it('refuse un doublon ou un dépassement de la limite', () => {
    expect(rain.addExternal({ key: 'castres', name: 'Castres', lat: 1, lon: 1 })).toBe(false)
    for (let i = 0; i < RAIN_EXTERNAL_MAX; i++)
      rain.addExternal({ key: `p${i}`, name: `P${i}`, lat: 1, lon: 1 })
    expect(rain.externalDefs.value).toHaveLength(RAIN_EXTERNAL_MAX)
    expect(rain.addExternal({ key: 'trop', name: 'Trop', lat: 1, lon: 1 })).toBe(false)
  })

  it('charge les précipitations de tous les points visibles', async () => {
    server.use(
      http.get(config.openMeteoForecastUrl, () =>
        HttpResponse.json(rain.visiblePoints.value.map(() => hourly(3, 2))),
      ),
    )
    await rain.load()
    const st = rain.states['castres']!
    expect(st.fetching).toBe(false)
    expect(st.values).toEqual([2, 2, 2])
    expect(st.error).toBeNull()
  })

  it('marque chaque point en erreur si la requête échoue', async () => {
    server.use(http.get(config.openMeteoForecastUrl, () => new HttpResponse(null, { status: 500 })))
    await rain.load()
    expect(rain.states['castres']!.error).toMatch(/Impossible de récupérer la pluviométrie/)
    expect(rain.states['castres']!.fetching).toBe(false)
  })

  it('signale un point sans série exploitable', async () => {
    server.use(
      http.get(config.openMeteoForecastUrl, () =>
        HttpResponse.json(rain.visiblePoints.value.map(() => ({}))),
      ),
    )
    await rain.load()
    expect(rain.states['castres']!.error).toMatch(/indisponibles/)
  })

  it('persiste les seuils sous les clés legacy', () => {
    const point = rain.externalPoints.value[0]!
    rain.setThreshold(point, 40)
    expect(localStorage.getItem('rain_castres_threshold')).toBe('40')
    expect(rain.states[point.key]!.threshold).toBe(40)
  })

  it('remonte le seuil d’alerte avec le seuil de vigilance', () => {
    const point = rain.externalPoints.value[0]!
    rain.setAlertThreshold(point, 32)
    rain.setThreshold(point, 50)
    expect(rain.states[point.key]!.alertThreshold).toBe(50)
  })

  it('empêche un seuil d’alerte sous la vigilance', () => {
    const point = rain.externalPoints.value[0]!
    rain.setThreshold(point, 40)
    rain.setAlertThreshold(point, 10)
    expect(rain.states[point.key]!.alertThreshold).toBe(40)
  })

  it('réinitialise les seuils d’un point', () => {
    const point = rain.externalPoints.value[0]!
    rain.setThreshold(point, 99)
    rain.resetThresholds(point)
    expect(rain.states[point.key]!.threshold).toBe(30)
    expect(rain.states[point.key]!.alertThreshold).toBe(45)
  })

  it('bascule le repli d’un groupe', async () => {
    rain.toggleGroup('external')
    await nextTick()
    expect(rain.groupsCollapsed.value.external).toBe(true)
    rain.toggleGroup('external')
    expect(rain.groupsCollapsed.value.external).toBe(false)
  })
})

describe('slugifyPlaceKey', () => {
  it('normalise les accents et la ponctuation', () => {
    expect(slugifyPlaceKey('Saint-Jean-de-Rives')).toBe('saint-jean-de-rives')
    expect(slugifyPlaceKey('Béziers (Hérault)')).toBe('beziers-herault')
  })
})
