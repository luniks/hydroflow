import { computed, reactive } from 'vue'
import { fetchObservations, fetchStationInfo } from '@/api/hubeau'
import { errorMessage } from '@/api/http'
import { DEFAULT_STATIONS, MAX_CHART_POINTS, normThresholds, STORAGE_KEYS } from '@/domain/constants'
import { downsample } from '@/domain/series'
import type { Station, StationLabel, StationState, Thresholds } from '@/domain/types'
import { useLocalStorage } from './useLocalStorage'

const stations = useLocalStorage<Station[]>(
  STORAGE_KEYS.stations,
  DEFAULT_STATIONS.map((s) => ({ ...s, thresholds: { ...s.thresholds } })),
  // Une liste vide est legitime : l'utilisateur peut avoir retire toutes ses stations.
  { parse: (raw) => (Array.isArray(raw) ? (raw as Station[]) : null) },
)

const states = reactive<Record<string, StationState>>({})

function emptyState(): StationState {
  return { points: [], flowPoints: [], name: null, river: null, error: null, fetching: false }
}

function ensureState(code: string): StationState {
  return (states[code] ??= emptyState())
}

function thresholdsKey(station: Station) {
  return `${station.storagePrefix}thresholds_v2`
}

export function loadStationThresholds(station: Station): Thresholds {
  try {
    const raw = localStorage.getItem(thresholdsKey(station))
    if (raw) return normThresholds(JSON.parse(raw))
  } catch {
    // seuils corrompus : on repart sur les valeurs par defaut
  }
  return normThresholds(station.thresholds)
}

export function saveStationThresholds(station: Station, thresholds: Thresholds): void {
  try {
    localStorage.setItem(thresholdsKey(station), JSON.stringify(thresholds))
  } catch {
    // ignore
  }
}

export function useStations() {
  const codes = computed(() => stations.value.map((s) => s.code))

  function syncStates() {
    for (const code of Object.keys(states)) if (!codes.value.includes(code)) delete states[code]
    for (const code of codes.value) ensureState(code)
  }

  async function loadStation(station: Station, hours: number, offsetSteps: number) {
    const state = ensureState(station.code)
    state.fetching = true
    try {
      if (!state.name) {
        const info = await fetchStationInfo(station.code)
        if (info) {
          state.name = info.name
          state.river = info.river
          if (info.lat !== null && info.lon !== null) {
            station.lat = info.lat
            station.lon = info.lon
          }
        }
      }
      const { heightPoints, flowPoints } = await fetchObservations(station.code, hours, offsetSteps)
      state.points = downsample(heightPoints, MAX_CHART_POINTS)
      state.flowPoints = downsample(flowPoints, MAX_CHART_POINTS)
      state.error = null
    } catch (e) {
      state.error = errorMessage(e)
    } finally {
      state.fetching = false
    }
  }

  return {
    stations,
    states,
    codes,
    syncStates,
    loadStation,
    stateOf: (code: string) => ensureState(code),
    displayName: (station: Station) => states[station.code]?.name || station.fallbackName,

    add(station: Station) {
      if (stations.value.some((s) => s.code === station.code)) return false
      stations.value = [...stations.value, station]
      syncStates()
      return true
    },

    remove(code: string) {
      stations.value = stations.value.filter((s) => s.code !== code)
      syncStates()
    },

    reorder(from: number, to: number) {
      const next = [...stations.value]
      const [moved] = next.splice(from, 1)
      if (!moved) return
      next.splice(to, 0, moved)
      stations.value = next
    },

    setLabel(code: string, label: StationLabel) {
      const station = stations.value.find((s) => s.code === code)
      if (station) station.label = label
    },

    reset() {
      stations.value = DEFAULT_STATIONS.map((s) => ({ ...s, thresholds: { ...s.thresholds } }))
      syncStates()
    },
  }
}

export function makeStation(
  code: string,
  label: StationLabel,
  info: { name?: string | null; river?: string | null; lat?: number | null; lon?: number | null },
): Station {
  return {
    code,
    fallbackName: info.name || code,
    fallbackRiver: info.river || '',
    label,
    lat: info.lat ?? undefined,
    lon: info.lon ?? undefined,
    url: `https://hydro.eaufrance.fr/stationhydro/${code}/fiche`,
    storagePrefix: `${code}_`,
    thresholds: normThresholds(),
  }
}
