import { ref } from 'vue'
import { errorMessage } from '@/api/http'
import { fetchVigicrues, type VigicruesInfo } from '@/api/vigicrues'
import { pluralize } from '@/domain/format'
import { partialState, useApiHealth } from './useApiHealth'
import { useRain } from './useRain'
import { useStations } from './useStations'
import { useTimeRange } from './useTimeRange'

const loading = ref(false)
const lastUpdate = ref<Date | null>(null)
const vigicrues = ref<VigicruesInfo | null>(null)

export function useDataLoader() {
  const { stations, states, syncStates, loadStation } = useStations()
  const rain = useRain()
  const { hours, offsetSteps } = useTimeRange()
  const api = useApiHealth()

  async function loadVigicrues() {
    try {
      const info = await fetchVigicrues()
      vigicrues.value = info
      api.set(
        'vigicrues',
        'ok',
        `Tronçon ${info.name} récupéré${info.stale ? ' (cache du proxy)' : ''}.`,
      )
    } catch (e) {
      vigicrues.value = null
      api.set('vigicrues', 'err', `Proxy ou service indisponible (${errorMessage(e)}).`)
    }
  }

  async function loadRain() {
    rain.syncStates()
    await rain.load()
    const points = rain.visiblePoints.value
    const ko = points.filter((p) => rain.states[p.key]?.error)
    api.set(
      'meteo',
      partialState(points.length - ko.length, points.length),
      !points.length
        ? 'Aucun point de pluviométrie affiché.'
        : ko.length
          ? `${ko.length} ${pluralize(ko.length, 'point')} en erreur : ${ko.map((p) => p.name).join(', ')}`
          : `${points.length} ${pluralize(points.length, 'point')} à jour.`,
    )
  }

  async function loadAll() {
    if (loading.value) return
    loading.value = true
    syncStates()
    try {
      await Promise.all([
        ...stations.value.map((s) => loadStation(s, hours.value, offsetSteps.value)),
        loadRain(),
        loadVigicrues(),
      ])

      const ko = stations.value.filter((s) => states[s.code]?.error)
      api.set(
        'hubeau',
        partialState(stations.value.length - ko.length, stations.value.length),
        !stations.value.length
          ? 'Aucune station suivie.'
          : ko.length
            ? `${ko.length} ${pluralize(ko.length, 'station')} en erreur : ${ko
                .map((s) => states[s.code]?.name || s.fallbackName)
                .join(', ')}`
            : `${stations.value.length} ${pluralize(stations.value.length, 'station')} à jour.`,
      )
      lastUpdate.value = new Date()
    } finally {
      loading.value = false
    }
  }

  return { loading, lastUpdate, vigicrues, loadAll, loadRain, loadVigicrues }
}
