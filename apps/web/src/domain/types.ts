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
  /** Debit minimal turbinable (m³/s) : en dessous, la turbine s'arrete. */
  minFlow: number
  /** Debit a partir duquel la turbine peut demarrer (m³/s), compris entre `minFlow` et `maxFlow`. */
  startFlow: number
  /** Debit maximum turbinable (m³/s) : au-dessus, la turbine s'arrete. */
  maxFlow: number
  optMin: number
  optMax: number
  /** Duree (min) que met le debit de la station de reference pour arriver a la turbine. */
  propagationMin: number
}

export type ZoneId = 'stop-low' | 'run-low' | 'opt' | 'run-high' | 'stop-high'
export type ZoneState = 'danger' | 'run' | 'ok'

export interface Zone {
  zone: ZoneId
  state: ZoneState
  label: string
  zoneName: string
}

/** Etat suppose de la turbine, deduit de l'historique du debit (l'application ne le mesure pas). */
export type TurbineState = 'run' | 'stop'

export type OutlookKind =
  | 'unknown'
  | 'stale'
  | 'run-stable'
  | 'run-watch'
  | 'stop-expected'
  | 'stop-now'
  | 'stopped-stable'
  | 'stopped-watch'
  | 'stopped-blocked'
  | 'start-expected'
  | 'start-now'

export type OutlookStability = 'stable' | 'watch' | 'changing'

/** Provenance d'une echeance : debit deja mesure en amont, ou extrapole depuis la tendance. */
export type OutlookSource = 'observed' | 'estimated'

export interface TurbineOutlook {
  kind: OutlookKind
  tone: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent'
  /** `null` quand aucune prevision n'est possible (pas de mesure, mesure trop ancienne). */
  stability: OutlookStability | null
  /** Etat de la turbine suppose pour la prevision ; `null` si aucune prevision. */
  turbine: TurbineState | null
  /** Delai avant le changement d'etat prevu, en minutes. */
  inMinutes: number | null
  source: OutlookSource | null
  headline: string
  detail: string | null
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
