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
  /** Marge (m³/s) de « production a surveiller » ; par defaut `OUTLOOK_WATCH_RATIO` de la plage [minimal ; maximum]. */
  watchMargin?: number
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

// ---------------------------------------------------------------------------
// Modele de production de la turbine VLH (voir turbineModel.ts / turbineForecast.ts)
// ---------------------------------------------------------------------------

/** Loi du delai de propagation de la station de reference a la turbine : plus le debit baisse, plus l'onde est lente. */
export interface LagLaw {
  /** Delai (min) pour un debit de reference >= `refFlow`. */
  refMin: number
  /** Debit (m³/s, station de reference) au-dela duquel le delai est constant. */
  refFlow: number
  /** Exposant : delai = refMin * (refFlow / q) ^ exponent sous `refFlow`. */
  exponent: number
  /** Plafond du delai (min), pour les tres faibles debits. */
  maxMin: number
}

/** Courbe de tarage de la station aval, niveau (m) = a * Q^b, utilisee comme niveau de restitution au barrage. */
export interface TailRating {
  a: number
  b: number
}

/** Caracteristiques de la turbine et reglages du modele de production. */
export interface TurbineModel {
  /** Station de reference amont (debit) et station aval (calage et niveau de restitution). */
  refCode: string
  downCode: string
  /** Debit reserve (m³/s) : passe a poissons + surverse, s'ajoute au debit turbine. */
  reserveFlow: number
  /** Capacite maximale turbinee (m³/s). */
  maxTurbineFlow: number
  /** Debit de demarrage et d'arret, en part de la capacite maximale. */
  startRatio: number
  stopRatio: number
  ratedPowerKw: number
  /** Puissance en regime reduit (niveau amont redescendu a 0 cm) et duree (min) de ce regime avant l'arret. */
  reducedPowerKw: number
  reducedMin: number
  /** Duree (min) pendant laquelle la retenue permet a la turbine de traverser un creux de debit sous le seuil d'arret avant de s'arreter. */
  stopHoldMin: number
  /** Vitesse de montee et de descente de la puissance (kW/min) au demarrage et a l'arret : la turbine suit le niveau amont, elle ne saute pas a sa puissance finale. */
  rampKwPerMin: number
  /** Rendement global (turbine + generateur) moyen. A caler avec l'historique de production. */
  efficiency: number
  /** Rendement selon la charge : points [Q_turbine / capacite max ; rendement], croissants. Vide : `efficiency` constant. */
  efficiencyCurve: [number, number][]
  /** Chute brute de fonctionnement (m) : en dehors, arret. */
  headMin: number
  headMax: number
  /** Niveaux locaux (cm) de repere : retenue basse, restitution basse. Chute brute a debit faible = (pool - tail) / 100. */
  poolLowCm: number
  tailLowCm: number
  /** Niveau (m) de la station aval correspondant au repere `tailLowCm`. */
  tailRefLevel: number
  /** Correction de chute (m, soustraite). 0 tant que sa definition n'est pas confirmee. */
  headCorrection: number
  tailRating: TailRating
  lag: LagLaw
  /** Rapport des distances de lit : station aval / turbine (17,73 km / 15,35 km). */
  downLagRatio: number
  /** Passage debit station de reference -> debit au barrage : gain * q + offset (les travaux amont doublent le debit). */
  defaultGain: number
  defaultOffset: number
  /** `true` : le calage ajuste aussi le gain ; sinon seul le decalage suit la station aval (gain fixe = `defaultGain`). */
  fitGain: boolean
  /** Poids (0-1) du calage sur la station aval : 0 = valeurs par defaut seules, 1 = calage seul. Le calage est bruite (aval douteux, travaux). */
  calibrationWeight: number
  /** Part de la puissance nominale au-dessus de laquelle on est en zone optimale. */
  optimalShare: number
}

/** Calage station de reference -> debit au barrage. */
export interface SiteCalibration {
  gain: number
  offset: number
  /** Ecart-type des residus (m³/s) sur la fenetre de calage ; incertitude de la conversion. */
  sigma: number
  pairs: number
  /** `false` : valeurs par defaut (pas assez de mesures aval). */
  fitted: boolean
}

export interface ForecastStep {
  minute: number
  atMs: number
  /** Debit au barrage attendu (m³/s) et son incertitude (ecart-type). */
  flow: number
  sigma: number
  source: OutlookSource
  turbine: TurbineState
  /** Probabilite que la turbine tourne a cet instant. */
  pRun: number
  powerKw: number
}

export type ForecastConfidence = 'high' | 'medium' | 'low'

export interface TurbineForecast {
  outlook: TurbineOutlook
  calibration: SiteCalibration
  /** Debit au barrage maintenant (m³/s), `null` sans mesure. */
  siteFlow: number | null
  powerKw: number | null
  steps: ForecastStep[]
  /** Debit au barrage, a l'heure ou il y arrive (serie de la station de reference convertie et decalee). */
  siteSeries: SeriesPoint[]
  /** Energie attendue sur l'horizon (kWh). */
  energyKwh: number
  /** Probabilite de marche a +30, +60 et +120 min. */
  pRun: { m30: number; m60: number; m120: number } | null
  confidence: ForecastConfidence | null
}
