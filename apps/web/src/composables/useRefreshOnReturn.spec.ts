import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, type EffectScope } from 'vue'
import { config } from '@/config/env'
import { server } from '@/test/msw/server'
import { useAutoRefreshSetting } from './useAutoRefresh'
import { useDataLoader } from './useDataLoader'
import { useRain } from './useRain'
import { useRefreshOnReturn } from './useRefreshOnReturn'
import { useStations } from './useStations'

const stations = useStations()
const rain = useRain()
const loader = useDataLoader()
const autoRefresh = useAutoRefreshSetting()

let observationRequests = 0
let scope: EffectScope

const setVisibility = (state: 'visible' | 'hidden') =>
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
const returnToTab = () => {
  setVisibility('visible')
  document.dispatchEvent(new Event('visibilitychange'))
}
const settle = () => new Promise((r) => setTimeout(r, 30))

beforeEach(async () => {
  stations.reset()
  rain.resetExternal()
  rain.hiddenKeys.value = []
  await nextTick()
  rain.syncStates()
  observationRequests = 0
  server.use(
    http.get(`${config.hubeauUrl}/observations_tr`, () => {
      observationRequests++
      return HttpResponse.json({
        data: [{ date_obs: new Date().toISOString(), grandeur_hydro: 'Q', resultat_obs: 14000 }],
        next: null,
      })
    }),
  )
  autoRefresh.set(10)
  await loader.loadAll() // etat de depart : donnees chargees a l'instant
  observationRequests = 0
  scope = effectScope()
  scope.run(() => useRefreshOnReturn())
})

afterEach(() => {
  scope.stop()
  vi.useRealTimers()
  setVisibility('visible')
})

describe('useRefreshOnReturn', () => {
  const ageData = (minutes: number) => {
    loader.lastUpdate.value = new Date(Date.now() - minutes * 60_000)
  }

  it('recharge au retour sur l’onglet quand les données sont plus vieilles que l’intervalle', async () => {
    ageData(25)
    returnToTab()
    await settle()
    expect(observationRequests).toBe(stations.stations.value.length)
    expect(Date.now() - loader.lastUpdate.value!.getTime()).toBeLessThan(5_000)
  })

  it('ne recharge pas quand les données sont encore fraîches', async () => {
    ageData(3)
    returnToTab()
    await settle()
    expect(observationRequests).toBe(0)
  })

  it('ne recharge pas quand l’onglet passe en arrière-plan', async () => {
    ageData(25)
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(observationRequests).toBe(0)
  })

  it('ne recharge pas quand le rafraîchissement automatique est désactivé', async () => {
    autoRefresh.set(0)
    ageData(600)
    returnToTab()
    await settle()
    expect(observationRequests).toBe(0)
  })

  it('ne relance pas un chargement déjà en cours', async () => {
    ageData(25)
    const running = loader.loadAll()
    returnToTab()
    await running
    await settle()
    // un seul passage : celui deja en cours, pas de rechargement supplementaire
    expect(observationRequests).toBe(stations.stations.value.length)
  })

  it('recharge aussi quand le réseau revient', async () => {
    ageData(25)
    window.dispatchEvent(new Event('online'))
    await settle()
    expect(observationRequests).toBe(stations.stations.value.length)
  })

  it('recharge quand rien n’a jamais pu être chargé', async () => {
    loader.lastUpdate.value = null
    returnToTab()
    await settle()
    expect(observationRequests).toBe(stations.stations.value.length)
  })

  it('cesse d’écouter quand son scope est détruit', async () => {
    scope.stop()
    ageData(25)
    returnToTab()
    window.dispatchEvent(new Event('online'))
    await settle()
    expect(observationRequests).toBe(0)
  })
})
