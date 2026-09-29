export type StationLabel = 'Amont' | 'Aval'

export interface Range {
  low: number
  high: number
}

export interface Thresholds {
  level: Range
  flow: Range
}

export interface Station {
  code: string
  fallbackName: string
  fallbackRiver: string
  label: StationLabel
  lat?: number
  lon?: number
  url: string
  storagePrefix: string
  thresholds: Thresholds
}

/** Point d'une serie temporelle : `t` ISO 8601, `y` valeur en unite SI. */
export interface SeriesPoint {
  t: string
  y: number
}

export interface StationState {
  points: SeriesPoint[]
  flowPoints: SeriesPoint[]
  name: string | null
  river: string | null
  error: string | null
  fetching: boolean
}

export interface ExploitConfig {
  refCode: string
  dmin: number
  max: number
  optMin: number
  optMax: number
}

export type ZoneId = 'stop-low' | 'run-low' | 'opt' | 'run-high' | 'stop-high'
export type ZoneState = 'danger' | 'run' | 'ok'

export interface Zone {
  zone: ZoneId
  state: ZoneState
  label: string
  zoneName: string
}

export type TrendDirection = 'up' | 'down' | 'flat'

export interface Trend {
  dir: TrendDirection
  ratePerHour: number
}

export type RangeStatus = 'low' | 'ok' | 'high'

export type RainOrigin = 'station' | 'external'
export type RainLevel = 'warn' | 'alert' | null

export interface RainPointDef {
  key: string
  name: string
  context?: string
  lat: number
  lon: number
}

export interface RainPoint extends RainPointDef {
  origin: RainOrigin
  label: StationLabel
  context: string
  storagePrefix: string
  defaultThreshold: number
}

export interface RainState {
  times: string[]
  values: number[]
  threshold: number
  alertThreshold: number
  error: string | null
  fetching: boolean
}

export interface RainRow {
  name: string
  tombe: number
  prevu: number
  total: number
  level: RainLevel
}

export interface RainAggregate {
  horizon: number
  rows: RainRow[]
  level: RainLevel
  tombe: number
  prevu: number
  total: number
}

export interface TimeWindow {
  dateDebut: Date
  dateFin: Date | null
}

export type ThemeName = 'dark' | 'light'

export type ApiHealth = 'ok' | 'warn' | 'err'
