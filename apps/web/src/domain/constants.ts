import type { ExploitConfig, RainPointDef, Range, Station, Thresholds } from './types'

export const DEFAULT_THRESHOLDS: Thresholds = {
  level: { low: 0.5, high: 2.5 },
  flow: { low: 5, high: 20 },
}

function normRange(r: Partial<Range> | undefined, fallback: Range): Range {
  const ok = r && Number.isFinite(r.low) && Number.isFinite(r.high)
  return ok ? { low: r.low as number, high: r.high as number } : { ...fallback }
}

export function normThresholds(t?: Partial<Thresholds> | null): Thresholds {
  return {
    level: normRange(t?.level, DEFAULT_THRESHOLDS.level),
    flow: normRange(t?.flow, DEFAULT_THRESHOLDS.flow),
  }
}

export const DEFAULT_STATIONS: Station[] = [
  {
    code: 'O460251001',
    fallbackName: 'Vielmur-sur-Agout',
    fallbackRiver: "L'Agout",
    label: 'Amont',
    lat: 43.6192,
    lon: 2.0901,
    url: 'https://hydro.eaufrance.fr/stationhydro/O460251001/fiche',
    storagePrefix: 'O460251001_lavaur_',
    thresholds: normThresholds(),
  },
  {
    code: 'O469251003',
    fallbackName: 'Lavaur',
    fallbackRiver: "L'Agout",
    label: 'Amont',
    lat: 43.7014,
    lon: 1.8167,
    url: 'https://hydro.eaufrance.fr/stationhydro/O469251003/fiche',
    storagePrefix: 'O469251003_lavaur_',
    thresholds: normThresholds(),
  },
  {
    code: 'O480252002',
    fallbackName: 'Giroussens / St-Lieux-lès-Lavaur',
    fallbackRiver: "L'Agout",
    label: 'Aval',
    lat: 43.7333,
    lon: 1.75,
    url: 'https://hydro.eaufrance.fr/stationhydro/O480252002/fiche',
    storagePrefix: 'O480252002_giroussens_',
    thresholds: normThresholds(),
  },
]

export const EXPLOIT_DEFAULTS: ExploitConfig = {
  refCode: 'O469251003',
  dmin: 5.5,
  max: 23.5,
  optMin: 10,
  optMax: 19,
}

export const DEFAULT_EXTERNAL_RAIN_DEFS: RainPointDef[] = [
  { key: 'castres', name: 'Castres', context: "Amont bassin · L'Agout", lat: 43.6047, lon: 2.2417 },
  { key: 'mazamet', name: 'Mazamet', context: 'Amont bassin · Le Thoré', lat: 43.4919, lon: 2.3753 },
  { key: 'graulhet', name: 'Graulhet', context: 'Amont bassin · Le Dadou', lat: 43.7576, lon: 1.9511 },
]

export const RAIN_EXTERNAL_MAX = 8
export const RAIN_FORECAST_HOURS = 48
export const RAIN_PAST_HOURS = 24
export const STATION_RAIN_DEFAULT_THRESHOLD = 35
export const EXTERNAL_RAIN_DEFAULT_THRESHOLD = 30

export const RANGES = [
  { label: '1h', longLabel: 'Dernière heure', hours: 1 },
  { label: '3h', longLabel: 'Dernières 3 heures', hours: 3 },
  { label: '1j', longLabel: 'Dernier jour', hours: 24 },
  { label: '3j', longLabel: 'Derniers 3 jours', hours: 72 },
  { label: '7j', longLabel: 'Derniers 7 jours', hours: 168 },
  { label: '14j', longLabel: 'Derniers 14 jours', hours: 336 },
  { label: '30j', longLabel: 'Derniers 30 jours', hours: 720 },
] as const

export const DEFAULT_RANGE_HOURS = 24
export const MAX_CHART_POINTS = 800
export const MAX_PAGES = 12
export const REQUEST_TIMEOUT_MS = 20_000

/** Tolerances de platitude des tendances : 0,5 cm/h sur le niveau, 2 % (min 0,05) sur le debit. */
export const LEVEL_FLAT_THRESHOLD = 0.005

export function flowFlatThreshold(currentFlow: number): number {
  return Math.max(Math.abs(currentFlow) * 0.02, 0.05)
}

export const AUTO_REFRESH_OPTIONS = [0, 5, 10, 30] as const

export const STORAGE_KEYS = {
  stations: 'custom_stations_v2',
  exploit: 'exploitation_config_v1',
  exploitCollapsed: 'exploitation_collapsed',
  rainHidden: 'rain_hidden_v1',
  rainExternal: 'rain_external_v1',
  rainGroupsCollapsed: 'rain_groups_collapsed_v1',
  rangeHours: 'range_hours',
  autoRefresh: 'autorefresh',
  theme: 'ui_theme',
} as const
