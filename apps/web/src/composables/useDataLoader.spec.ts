import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { config } from '@/config/env'
import { server } from '@/test/msw/server'
import { useApiHealth } from './useApiHealth'
import { useDataLoader } from './useDataLoader'
import { useTimeRange } from './useTimeRange'
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

  describe('appels pendant un chargement', () => {
    /** Intercepte Hub'Eau : enregistre l'age de la fenetre demandee et attend `gate` avant de repondre. */
    function holdObservations() {
      const windows: number[] = []
      let release!: () => void
      const gate = new Promise<void>((r) => (release = r))
      server.use(
        http.get(`${config.hubeauUrl}/observations_tr`, async ({ request }) => {
          const from = new URL(request.url).searchParams.get('date_debut_obs')!
          windows.push(Math.round((Date.now() - Date.parse(from)) / 3_600_000))
          await gate
          return HttpResponse.json(observation())
        }),
      )
      return { windows, release }
    }
    const tick = () => new Promise((r) => setTimeout(r, 20))

    it('ne perd pas un changement de période demandé pendant un chargement', async () => {
      const range = useTimeRange()
      range.hours.value = 24
      const { windows, release } = holdObservations()

      const first = loader.loadAll()
      await tick()
      range.hours.value = 72 // le watch de App.vue relance un chargement
      const second = loader.loadAll()
      release()
      await Promise.all([first, second])

      expect(windows.filter((w) => w >= 70).length).toBeGreaterThan(0)
      range.hours.value = 24
    })

    it('regroupe plusieurs appels en un seul rechargement', async () => {
      const { windows, release } = holdObservations()
      const first = loader.loadAll()
      await tick()
      const rest = [loader.loadAll(), loader.loadAll(), loader.loadAll()]
      release()
      await Promise.all([first, ...rest])
      // 3 stations x (chargement initial + 1 seul rechargement)
      expect(windows).toHaveLength(stations.stations.value.length * 2)
    })

    it('reste en chargement tant que le rechargement n’est pas terminé', async () => {
      const { windows, release } = holdObservations()
      const first = loader.loadAll()
      await tick()
      const second = loader.loadAll()
      expect(loader.loading.value).toBe(true)

      release()
      await Promise.all([first, second]) // les deux appels se resolvent une fois tout termine
      expect(loader.loading.value).toBe(false)
      expect(windows).toHaveLength(stations.stations.value.length * 2)
    })

    it('un chargement isolé ne se répète pas', async () => {
      const { windows, release } = holdObservations()
      release()
      await loader.loadAll()
      expect(windows).toHaveLength(stations.stations.value.length)
    })
  })

  describe('dernière mise à jour', () => {
    const failAll = () =>
      server.use(
        http.get(`${config.hubeauUrl}/observations_tr`, () => new HttpResponse(null, { status: 503 })),
        http.get(config.openMeteoForecastUrl, () => new HttpResponse(null, { status: 503 })),
        http.get(config.vigicruesProxyUrl, () => new HttpResponse(null, { status: 503 })),
      )

    it('n’avance pas quand aucune source ne répond', async () => {
      await loader.loadAll()
      const before = loader.lastUpdate.value!.getTime()
      await new Promise((r) => setTimeout(r, 15))

      failAll()
      await loader.loadAll()
      expect(api.overall.value).toBe('err')
      expect(loader.lastUpdate.value!.getTime()).toBe(before)
    })

    it('avance dès qu’une source répond, même si les autres échouent', async () => {
      await loader.loadAll()
      const before = loader.lastUpdate.value!.getTime()
      await new Promise((r) => setTimeout(r, 15))

      failAll()
      server.use(http.get(`${config.hubeauUrl}/observations_tr`, () => HttpResponse.json(observation())))
      await loader.loadAll()
      expect(api.health.hubeau.state).toBe('ok')
      expect(api.health.meteo.state).toBe('err')
      expect(loader.lastUpdate.value!.getTime()).toBeGreaterThan(before)
    })
  })
})
