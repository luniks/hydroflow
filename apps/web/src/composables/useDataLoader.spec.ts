import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { config } from '@/config/env'
import { server } from '@/test/msw/server'
import { useApiHealth } from './useApiHealth'
import { useDataLoader } from './useDataLoader'
import { useRain } from './useRain'
import { useStations } from './useStations'

const stations = useStations()
const rain = useRain()
const api = useApiHealth()
const loader = useDataLoader()

const observation = () => ({
  data: [{ date_obs: new Date().toISOString(), grandeur_hydro: 'Q', resultat_obs: 14000 }],
  next: null,
})

const rainSeries = (count: number) =>
  Array.from({ length: count }, () => ({
    hourly: { time: [new Date().toISOString()], precipitation: [1] },
  }))

beforeEach(async () => {
  stations.reset()
  rain.resetExternal()
  rain.hiddenKeys.value = []
  await nextTick()
  rain.syncStates()
  server.use(http.get(`${config.hubeauUrl}/observations_tr`, () => HttpResponse.json(observation())))
  server.use(
    http.get(config.openMeteoForecastUrl, () =>
      HttpResponse.json(rainSeries(rain.visiblePoints.value.length)),
    ),
  )
})

describe('useDataLoader', () => {
  it('charge stations, pluie et vigicrues puis repasse ok', async () => {
    await loader.loadAll()
    expect(loader.loading.value).toBe(false)
    expect(loader.lastUpdate.value).toBeInstanceOf(Date)
    expect(loader.vigicrues.value?.level?.key).toBe('green')
    expect(api.health.hubeau.state).toBe('ok')
    expect(api.health.meteo.state).toBe('ok')
    expect(api.health.vigicrues.state).toBe('ok')
    expect(api.overall.value).toBe('ok')
  })

  it('remplit les séries de la station de référence', async () => {
    await loader.loadAll()
    expect(stations.stateOf('O469251003').flowPoints).toHaveLength(1)
  })

  it('passe Hub’Eau en échec quand toutes les stations échouent', async () => {
    server.use(
      http.get(`${config.hubeauUrl}/observations_tr`, () => new HttpResponse(null, { status: 500 })),
    )
    await loader.loadAll()
    expect(api.health.hubeau.state).toBe('err')
    expect(api.health.hubeau.detail).toMatch(/3 stations en erreur/)
  })

  it('signale aucune station suivie', async () => {
    for (const code of [...stations.codes.value]) stations.remove(code)
    await nextTick()
    rain.syncStates()
    await loader.loadAll()
    expect(api.health.hubeau.state).toBe('unknown')
    expect(api.health.hubeau.detail).toBe('Aucune station suivie.')
  })

  it('dégrade proprement quand le proxy Vigicrues est coupé', async () => {
    server.use(http.get(config.vigicruesProxyUrl, () => HttpResponse.error()))
    await loader.loadAll()
    expect(loader.vigicrues.value).toBeNull()
    expect(api.health.vigicrues.state).toBe('err')
    expect(api.health.hubeau.state).toBe('ok')
    expect(api.overall.value).toBe('warn')
  })

  it('passe Open-Meteo en échec quand la pluie est indisponible', async () => {
    server.use(http.get(config.openMeteoForecastUrl, () => new HttpResponse(null, { status: 503 })))
    await loader.loadAll()
    expect(api.health.meteo.state).toBe('err')
  })

  it('ignore un second chargement concurrent', async () => {
    let calls = 0
    server.use(
      http.get(`${config.hubeauUrl}/observations_tr`, () => {
        calls++
        return HttpResponse.json(observation())
      }),
    )
    await Promise.all([loader.loadAll(), loader.loadAll()])
    expect(calls).toBe(3)
  })
})
