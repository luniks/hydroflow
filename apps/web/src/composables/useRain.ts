import { computed, reactive, watch } from 'vue'
import { errorMessage } from '@/api/http'
import { fetchRain } from '@/api/openMeteo'
import {
  DEFAULT_EXTERNAL_RAIN_DEFS,
  EXTERNAL_RAIN_DEFAULT_THRESHOLD,
  RAIN_EXTERNAL_MAX,
  STATION_RAIN_DEFAULT_THRESHOLD,
  STORAGE_KEYS,
} from '@/domain/constants'
import { defaultRainAlert } from '@/domain/rain'
import type { RainPoint, RainPointDef, RainState } from '@/domain/types'
import { readNumber, useLocalStorage, writeNumber } from './useLocalStorage'
import { useStations } from './useStations'

const hiddenKeys = useLocalStorage<string[]>(STORAGE_KEYS.rainHidden, [], {
  parse: (raw) => (Array.isArray(raw) ? (raw as string[]) : null),
})

const externalDefs = useLocalStorage<RainPointDef[]>(
  STORAGE_KEYS.rainExternal,
  DEFAULT_EXTERNAL_RAIN_DEFS.map((d) => ({ ...d })),
  {
    parse: (raw) =>
      Array.isArray(raw)
        ? (raw as RainPointDef[]).filter(
            (d) =>
              d &&
              typeof d.key === 'string' &&
              typeof d.name === 'string' &&
              typeof d.lat === 'number' &&
              typeof d.lon === 'number',
          )
        : null,
  },
)

const groupsCollapsed = useLocalStorage<Record<string, boolean>>(
  STORAGE_KEYS.rainGroupsCollapsed,
  {},
)

const states = reactive<Record<string, RainState>>({})

function makeExternalPoint(d: RainPointDef): RainPoint {
  return {
    ...d,
    origin: 'external',
    label: 'Amont',
    context: d.context ?? '',
    storagePrefix: `rain_${d.key}_`,
    defaultThreshold: EXTERNAL_RAIN_DEFAULT_THRESHOLD,
  }
}

const { stations, states: stationStates } = useStations()

/** Chaque station H/Q geolocalisee genere automatiquement son point pluie. */
const stationPoints = computed<RainPoint[]>(() =>
  stations.value
    .filter((s) => typeof s.lat === 'number' && typeof s.lon === 'number')
    .map((s) => {
      const river = stationStates[s.code]?.river || s.fallbackRiver || ''
      return {
        key: `station_${s.code}`,
        origin: 'station',
        label: s.label,
        name: stationStates[s.code]?.name || s.fallbackName || s.code,
        context: `Station suivie${river ? ` · ${river}` : ''}`,
        lat: s.lat!,
        lon: s.lon!,
        storagePrefix: `rain_station_${s.code}_`,
        defaultThreshold: STATION_RAIN_DEFAULT_THRESHOLD,
      }
    }),
)

const externalPoints = computed<RainPoint[]>(() => externalDefs.value.map(makeExternalPoint))
const allPoints = computed(() => [...stationPoints.value, ...externalPoints.value])
const visiblePoints = computed(() => allPoints.value.filter((p) => !hiddenKeys.value.includes(p.key)))

/** Cree l'etat des nouveaux points et purge celui des points disparus. */
function syncStates() {
  const keys = new Set(visiblePoints.value.map((p) => p.key))
  for (const key of Object.keys(states)) if (!keys.has(key)) delete states[key]
  for (const p of visiblePoints.value) {
    if (states[p.key]) continue
    states[p.key] = {
      times: [],
      values: [],
      threshold: readNumber(`${p.storagePrefix}threshold`, p.defaultThreshold),
      alertThreshold: readNumber(
        `${p.storagePrefix}alert_threshold`,
        defaultRainAlert(p.defaultThreshold),
      ),
      error: null,
      fetching: true,
    }
  }
}

// Les points apparaissent des que les stations sont geolocalisees : l'etat doit suivre
// immediatement, sinon les cartes se rendent sans donnees.
watch(visiblePoints, syncStates, { immediate: true, flush: 'sync' })

async function load(points: RainPoint[] = visiblePoints.value) {
  if (!points.length) return
  for (const p of points) if (states[p.key]) states[p.key]!.fetching = true
  try {
    const series = await fetchRain(points)
    points.forEach((p, i) => {
      const st = states[p.key]
      if (!st) return
      st.fetching = false
      const serie = series[i]
      if (serie) {
        st.times = serie.times
        st.values = serie.values
        st.error = null
      } else {
        st.error = 'Données de pluviométrie indisponibles pour ce point.'
      }
    })
  } catch (e) {
    for (const p of points) {
      const st = states[p.key]
      if (!st) continue
      st.fetching = false
      st.error = `Impossible de récupérer la pluviométrie (${errorMessage(e)}).`
    }
  }
}

function setThreshold(p: RainPoint, value: number) {
  const st = states[p.key]
  if (!st) return
  st.threshold = value
  writeNumber(`${p.storagePrefix}threshold`, value)
  if (st.alertThreshold < value) setAlertThreshold(p, value)
}

function setAlertThreshold(p: RainPoint, value: number) {
  const st = states[p.key]
  if (!st) return
  st.alertThreshold = Math.max(value, st.threshold)
  writeNumber(`${p.storagePrefix}alert_threshold`, st.alertThreshold)
}

export function useRain() {
  return {
    states,
    hiddenKeys,
    externalDefs,
    groupsCollapsed,
    stationPoints,
    externalPoints,
    allPoints,
    visiblePoints,
    syncStates,
    load,
    setThreshold,
    setAlertThreshold,

    isHidden: (key: string) => hiddenKeys.value.includes(key),

    setHidden(key: string, hidden: boolean) {
      const set = new Set(hiddenKeys.value)
      if (hidden) set.add(key)
      else set.delete(key)
      hiddenKeys.value = [...set]
      syncStates()
    },

    /** Retourne `false` si la limite de points amont est atteinte ou si la clé existe déjà. */
    addExternal(def: RainPointDef): boolean {
      if (externalDefs.value.length >= RAIN_EXTERNAL_MAX) return false
      if (externalDefs.value.some((d) => d.key === def.key)) return false
      externalDefs.value = [...externalDefs.value, def]
      syncStates()
      return true
    },

    removeExternal(key: string) {
      externalDefs.value = externalDefs.value.filter((d) => d.key !== key)
      syncStates()
    },

    resetExternal() {
      externalDefs.value = DEFAULT_EXTERNAL_RAIN_DEFS.map((d) => ({ ...d }))
      syncStates()
    },

    resetThresholds(p: RainPoint) {
      setThreshold(p, p.defaultThreshold)
      setAlertThreshold(p, defaultRainAlert(p.defaultThreshold))
    },

    isExternalDefault: computed(
      () =>
        externalDefs.value.length === DEFAULT_EXTERNAL_RAIN_DEFS.length &&
        externalDefs.value.every((d, i) => d.key === DEFAULT_EXTERNAL_RAIN_DEFS[i]!.key),
    ),

    toggleGroup(key: string) {
      groupsCollapsed.value = { ...groupsCollapsed.value, [key]: !groupsCollapsed.value[key] }
    },
  }
}

export function slugifyPlaceKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
