import { exploitConfigFromModel, maxSiteFlow, powerKw, startFlowOf, stopFlowOf } from './turbineModel'
import type { ExploitConfig, TurbineModel } from './types'

/** Groupes de reglages de la page de configuration. */
export type SettingsGroup = 'install' | 'behavior' | 'advanced'

export interface SettingField {
  /** Chemin dans `TurbineModel`, ex. `reserveFlow` ou `lag.refMin`. */
  path: string
  label: string
  unit: string
  hint?: string
  group: SettingsGroup
  step: number
  min?: number
  max?: number
}

/** Reglages numeriques saisissables, dans l'ordre d'affichage. Les stations et la courbe de rendement ont leur propre saisie. */
export const TURBINE_FIELDS: SettingField[] = [
  { path: 'reserveFlow', label: 'Débit réservé', unit: 'm³/s', hint: 'Passe à poissons et surverse : prélevé avant la turbine', group: 'install', step: 0.1, min: 0 },
  { path: 'maxTurbineFlow', label: 'Capacité maximale turbinée', unit: 'm³/s', group: 'install', step: 0.1, min: 0 },
  { path: 'startRatio', label: 'Débit de démarrage', unit: '× capacité', hint: 'Part de la capacité maximale (0,3 = 30 %)', group: 'install', step: 0.01, min: 0, max: 1 },
  { path: 'stopRatio', label: 'Débit d’arrêt', unit: '× capacité', hint: 'Sous ce débit, la turbine s’arrête', group: 'install', step: 0.01, min: 0, max: 1 },
  { path: 'ratedPowerKw', label: 'Puissance nominale', unit: 'kW', group: 'install', step: 10, min: 0 },
  { path: 'headMin', label: 'Chute minimale', unit: 'm', hint: 'En dessous, arrêt (crue)', group: 'install', step: 0.1, min: 0 },
  { path: 'headMax', label: 'Chute maximale', unit: 'm', group: 'install', step: 0.1, min: 0 },
  { path: 'poolLowCm', label: 'Niveau amont bas', unit: 'cm', hint: 'Repère local de la retenue', group: 'install', step: 1 },
  { path: 'tailLowCm', label: 'Niveau aval bas', unit: 'cm', hint: 'Repère local de la restitution, à débit faible', group: 'install', step: 1 },
  { path: 'stopHoldMin', label: 'Inertie à l’arrêt', unit: 'min', hint: 'Durée d’un creux de débit que la retenue absorbe avant l’arrêt', group: 'behavior', step: 1, min: 0 },
  { path: 'rampKwPerMin', label: 'Vitesse de rampe', unit: 'kW/min', hint: 'Montée et descente de la puissance (0 = instantané)', group: 'behavior', step: 0.5, min: 0 },
  { path: 'reducedPowerKw', label: 'Puissance en régime réduit', unit: 'kW', group: 'behavior', step: 10, min: 0 },
  { path: 'reducedMin', label: 'Durée du régime réduit', unit: 'min', hint: '0 tant qu’elle est inconnue', group: 'behavior', step: 1, min: 0 },
  { path: 'defaultGain', label: 'Gain amont → barrage', unit: '', hint: 'Les travaux amont gonflent le débit de la station de référence', group: 'advanced', step: 0.01, min: 0 },
  { path: 'defaultOffset', label: 'Décalage amont → barrage', unit: 'm³/s', group: 'advanced', step: 0.1 },
  { path: 'calibrationWeight', label: 'Poids du calage sur l’aval', unit: '0 à 1', hint: '0 = valeurs par défaut seules, 1 = calage seul', group: 'advanced', step: 0.1, min: 0, max: 1 },
  { path: 'lag.refMin', label: 'Délai de propagation de référence', unit: 'min', hint: 'Station amont → turbine, à fort débit', group: 'advanced', step: 1, min: 0 },
  { path: 'lag.refFlow', label: 'Débit de référence du délai', unit: 'm³/s', hint: 'En dessous, l’eau est plus lente', group: 'advanced', step: 1, min: 0 },
  { path: 'lag.exponent', label: 'Exposant du délai', unit: '', group: 'advanced', step: 0.1, min: 0 },
  { path: 'lag.maxMin', label: 'Délai maximal', unit: 'min', group: 'advanced', step: 1, min: 0 },
  { path: 'tailRating.a', label: 'Courbe de tarage aval · a', unit: '', hint: 'Niveau (m) = a × Q^b à la station aval', group: 'advanced', step: 0.0001, min: 0 },
  { path: 'tailRating.b', label: 'Courbe de tarage aval · b', unit: '', group: 'advanced', step: 0.01, min: 0 },
  { path: 'tailRefLevel', label: 'Niveau de la station pour le repère aval bas', unit: 'm', group: 'advanced', step: 0.01, min: 0 },
  { path: 'headCorrection', label: 'Ajustement de chute', unit: 'm', hint: 'Décalage ajouté à la chute calculée (0 par défaut)', group: 'advanced', step: 0.01 },
  { path: 'optimalShare', label: 'Part de la puissance nominale « optimale »', unit: '0 à 1', group: 'advanced', step: 0.05, min: 0, max: 1 },
]

/** Lit un reglage (`lag.refMin` -> `m.lag.refMin`). */
export function getSetting(m: TurbineModel, path: string): number {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], m) as number
}

/** Ecrit un reglage ; `NaN` marque un champ vide, rejete par `validateTurbineModel`. */
export function setSetting(m: TurbineModel, path: string, value: number): void {
  const keys = path.split('.')
  const last = keys.pop()!
  const target = keys.reduce<Record<string, unknown>>((o, k) => o[k] as Record<string, unknown>, m as unknown as Record<string, unknown>)
  target[last] = value
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** Message d'erreur (francais) du premier reglage invalide, ou `null`. */
export function validateTurbineModel(m: TurbineModel): string | null {
  if (!m.refCode) return 'Choisissez la station amont de référence.'
  const missing = TURBINE_FIELDS.find((f) => !isNum(getSetting(m, f.path)))
  if (missing) return `« ${missing.label} » doit être un nombre.`
  const below = TURBINE_FIELDS.find((f) => f.min !== undefined && getSetting(m, f.path) < f.min)
  if (below) return `« ${below.label} » doit être au moins ${below.min}.`
  const above = TURBINE_FIELDS.find((f) => f.max !== undefined && getSetting(m, f.path) > f.max)
  if (above) return `« ${above.label} » doit être au plus ${above.max}.`

  if (m.maxTurbineFlow <= 0) return 'La capacité maximale turbinée doit être positive.'
  if (m.startRatio <= 0) return 'Le débit de démarrage doit être positif.'
  if (m.stopRatio > m.startRatio) return 'Le débit d’arrêt ne peut pas dépasser le débit de démarrage.'
  if (m.ratedPowerKw <= 0) return 'La puissance nominale doit être positive.'
  if (m.headMin <= 0 || m.headMax <= m.headMin) return 'La chute maximale doit dépasser la chute minimale.'
  if (m.poolLowCm <= m.tailLowCm) return 'Le niveau amont bas doit être au-dessus du niveau aval bas.'
  if ((m.poolLowCm - m.tailLowCm) / 100 < m.headMin) return 'La chute à débit faible est inférieure à la chute minimale.'
  if (m.reducedPowerKw > m.ratedPowerKw) return 'La puissance en régime réduit dépasse la puissance nominale.'
  if (m.lag.maxMin < m.lag.refMin) return 'Le délai maximal doit être au moins égal au délai de référence.'
  if (m.tailRating.a <= 0 || m.tailRating.b <= 0) return 'La courbe de tarage aval doit avoir des coefficients positifs.'

  if (!m.efficiencyCurve.length) {
    if (!(m.efficiency > 0 && m.efficiency <= 1)) return 'Le rendement doit être compris entre 0 et 1.'
  } else {
    for (let i = 0; i < m.efficiencyCurve.length; i++) {
      const [load, eff] = m.efficiencyCurve[i]!
      if (!(isNum(load) && isNum(eff) && load > 0 && load <= 1 && eff > 0 && eff <= 1)) {
        return 'Chaque point de la courbe de rendement doit avoir une charge et un rendement entre 0 et 1.'
      }
      if (i > 0 && load <= m.efficiencyCurve[i - 1]![0]) return 'Les charges de la courbe de rendement doivent être croissantes.'
    }
  }
  return null
}

export interface TurbinePreview {
  /** Debits au barrage (m³/s). */
  startFlow: number
  stopFlow: number
  /** Debit de crue au-dela duquel la chute passe sous le minimum. */
  maxFlow: number
  /** Puissance a pleine capacite turbinee (kW). */
  fullPowerKw: number
}

/** Valeurs deduites des reglages, affichees en direct a l'ecran de configuration. */
export function turbinePreview(m: TurbineModel): TurbinePreview {
  return {
    startFlow: startFlowOf(m),
    stopFlow: stopFlowOf(m),
    maxFlow: maxSiteFlow(m),
    fullPowerKw: powerKw(m.reserveFlow + m.maxTurbineFlow, m),
  }
}

/** Debit equivalent a la station de reference d'un debit au barrage (inverse du passage gain / decalage). */
export function toRefFlow(siteFlow: number, m: TurbineModel): number {
  return (siteFlow - m.defaultOffset) / m.defaultGain
}

/**
 * Seuils du modele exprimes en debit de la station de reference : utile pour la lire par rapport a la turbine.
 * Les bornes de « zone optimale » restent calculees mais ne sont pas utilisees par l'affichage.
 */
export function refSpaceConfig(m: TurbineModel): ExploitConfig {
  const c = exploitConfigFromModel(m)
  const eq = (q: number): number => toRefFlow(q, m)
  return {
    refCode: m.refCode,
    minFlow: eq(c.minFlow),
    startFlow: eq(c.startFlow),
    maxFlow: eq(c.maxFlow),
    optMin: eq(c.optMin),
    optMax: eq(c.optMax),
    propagationMin: m.lag.refMin,
  }
}
