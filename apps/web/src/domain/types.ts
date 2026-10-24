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
  | 'opt-exit-expected'
  | 'opt-entry-expected'
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
  /** Derniere mesure de la station et heure (ms) a laquelle elle arrive a la turbine ; `null` sans prevision. */
  arrival: { atMs: number; flow: number } | null
  /** Delai avant le changement d'etat prevu, en minutes. */
  inMinutes: number | null
  source: OutlookSource | null
  headline: string
  detail: string | null
}

export type TrendDirection = 'up' | 'down' | 'flat'

/** Reglages de `analyzeSeries`, propres a la grandeur analysee (debit, niveau). */
export interface AnalyzeOptions {
  /** Part du niveau courant en dessous de laquelle une variation est un palier (ex. 0,01 = 1 %). */
  relFloor: number
  /** Variation absolue minimale d'un palier, dans l'unite de la serie. */
  absFloor: number
  /** Seuil « plat » (unite/h) de la pente 2 points, utilisee quand la serie est trop courte pour une regression. */
  legacyFlat: number
}

/** Lecture d'une serie : palier, pente significative, et courbure quand elle est reelle. */
export interface SeriesAnalysis {
  dir: TrendDirection
  /** Pente retenue (unite/h) ; 0 pour un palier ou sans tendance significative. */
  ratePerHour: number
  /** Fenetre (min) de la pente retenue ; `null` pour un palier, un repli ou une serie sans tendance. */
  windowMin: number | null
  /** Duree (min) du palier en cours (15 min au moins), sinon `null`. */
  stableMin: number | null
  /** Tendance quadratique au dernier instant (pente `b` en unite/h, courbure `a` en unite/h²) si elle est significative. */
  curve: { b: number; a: number } | null
  /** `legacy` : trop peu de points pour une regression, repli sur la pente 2 points sur 1 h. */
  method: 'regression' | 'legacy'
}

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

/** Reglage de l'utilisateur : un theme impose, ou `system` pour suivre celui du systeme. */
export type ThemePreference = 'system' | ThemeName

export type ApiHealth = 'ok' | 'warn' | 'err'
