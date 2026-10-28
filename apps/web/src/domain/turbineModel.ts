import type { ExploitConfig, TurbineModel } from './types'

/** Poids volumique de l'eau x g : P(kW) = 9,81 * rendement * Q(m³/s) * H(m). */
const KW_PER_M3S_M = 9.81

/** Niveau (m) a la station aval pour un debit `q` (m³/s), d'apres sa courbe de tarage. */
export function tailLevel(q: number, m: TurbineModel): number {
  return m.tailRating.a * Math.pow(Math.max(q, 0.01), m.tailRating.b)
}

/** Chute brute a debit faible : niveau amont bas - niveau aval bas (m). */
export const headAtLowFlow = (m: TurbineModel): number => (m.poolLowCm - m.tailLowCm) / 100

/**
 * Chute brute (m) pour un debit `q` au barrage : la chute a debit faible, diminuee de la remontee du niveau de
 * restitution (le niveau aval monte avec le debit) et de la correction de chute. Le niveau amont est suppose constant.
 */
export function grossHead(q: number, m: TurbineModel): number {
  const rise = Math.max(0, tailLevel(q, m) - m.tailRefLevel)
  return Math.min(headAtLowFlow(m) - rise - m.headCorrection, m.headMax)
}

/** Debit au barrage a partir duquel la turbine peut demarrer / en dessous duquel elle s'arrete (m³/s). */
export const startFlowOf = (m: TurbineModel): number => m.reserveFlow + m.startRatio * m.maxTurbineFlow
export const stopFlowOf = (m: TurbineModel): number => m.reserveFlow + m.stopRatio * m.maxTurbineFlow

/** Debit turbine (m³/s) pour un debit `q` au barrage : le debit reserve est preleve en premier, la capacite plafonne. */
export function turbinedFlow(q: number, m: TurbineModel): number {
  return Math.min(Math.max(q - m.reserveFlow, 0), m.maxTurbineFlow)
}

/** Debit au barrage au-dela duquel la chute passe sous le minimum : la turbine s'arrete (crue). */
export function maxSiteFlow(m: TurbineModel): number {
  let lo = startFlowOf(m)
  let hi = 2000
  if (grossHead(lo, m) < m.headMin) return lo
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (grossHead(mid, m) >= m.headMin) lo = mid
    else hi = mid
  }
  return lo
}

/** Rendement global pour une charge `ratio` (debit turbine / capacite max) : interpolation de la courbe, ou rendement constant. */
export function efficiencyAt(ratio: number, m: TurbineModel): number {
  const c = m.efficiencyCurve
  if (!c.length) return m.efficiency
  if (ratio <= c[0]![0]) return c[0]![1]
  for (let i = 1; i < c.length; i++) {
    const [x1, y1] = c[i]!
    const [x0, y0] = c[i - 1]!
    if (ratio <= x1) return y0 + ((ratio - x0) / (x1 - x0)) * (y1 - y0)
  }
  return c[c.length - 1]![1]
}

/**
 * Puissance electrique (kW) en marche pour un debit `q` au barrage :
 * P = 9,81 * rendement(charge) * Q_turbine * H, plafonnee a la puissance nominale, nulle sous le debit d'arret ou si la
 * chute passe sous le minimum.
 */
export function powerKw(q: number, m: TurbineModel): number {
  if (q < stopFlowOf(m)) return 0
  const head = grossHead(q, m)
  if (head < m.headMin) return 0
  const qt = turbinedFlow(q, m)
  return Math.min(m.ratedPowerKw, KW_PER_M3S_M * efficiencyAt(qt / m.maxTurbineFlow, m) * qt * head)
}

/**
 * Zone optimale deduite du modele : debits au barrage ou la puissance atteint au moins `optimalShare` de la
 * puissance nominale. Bornee en bas par la capacite de la turbine, en haut par la chute qui s'efface en crue.
 * `null` si le modele n'atteint jamais ce seuil.
 */
export function optimalRange(m: TurbineModel): { low: number; high: number } | null {
  const target = m.optimalShare * m.ratedPowerKw
  const top = maxSiteFlow(m)
  let low: number | null = null
  let high: number | null = null
  for (let q = startFlowOf(m); q <= top; q += 0.25) {
    if (powerKw(q, m) >= target) {
      low ??= q
      high = q
    }
  }
  return low === null || high === null ? null : { low, high }
}

/**
 * Configuration d'exploitation equivalente, exprimee en debit au barrage (et non plus en debit de la station
 * de reference), pour reutiliser `turbineOutlook`. Le delai de propagation vaut 0 : la serie est deja decalee.
 */
export function exploitConfigFromModel(m: TurbineModel, watchMargin?: number): ExploitConfig {
  const opt = optimalRange(m)
  const start = startFlowOf(m)
  const max = maxSiteFlow(m)
  const min = stopFlowOf(m)
  const optMin = opt ? Math.max(opt.low, min + 0.01) : (min + max) / 3
  const optMax = opt ? Math.min(opt.high, max) : (2 * (min + max)) / 3
  return {
    refCode: m.refCode,
    minFlow: min,
    startFlow: Math.max(start, min),
    maxFlow: max,
    optMin,
    optMax: Math.max(optMax, optMin + 0.01),
    propagationMin: 0,
    ...(watchMargin === undefined ? {} : { watchMargin }),
  }
}

/** Relit une configuration persistee : toute valeur manquante ou invalide retombe sur `fallback`. */
export function normTurbineModel(raw: unknown, fallback: TurbineModel): TurbineModel | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const out: Record<string, unknown> = { ...fallback }
  for (const key of Object.keys(fallback) as (keyof TurbineModel)[]) {
    const v = r[key]
    const f = fallback[key]
    if (typeof f === 'number') out[key] = Number.isFinite(v) ? v : f
    else if (typeof f === 'string') out[key] = typeof v === 'string' && v ? v : f
    else if (Array.isArray(f)) {
      const ok =
        Array.isArray(v) &&
        v.every((p) => Array.isArray(p) && p.length === 2 && p.every((x) => Number.isFinite(x))) &&
        v.every((p, i) => i === 0 || (p as number[])[0]! > (v[i - 1] as number[])[0]!)
      out[key] = ok ? v : f
    } else if (f && typeof f === 'object' && v && typeof v === 'object') {
      out[key] = { ...(f as object), ...(v as object) }
    }
  }
  return out as unknown as TurbineModel
}

/** Copie profonde d'un modele (les reglages imbriques et la courbe de rendement ne sont pas partages). */
export function cloneTurbineModel(m: TurbineModel): TurbineModel {
  return {
    ...m,
    efficiencyCurve: m.efficiencyCurve.map(([load, eff]) => [load, eff] as [number, number]),
    tailRating: { ...m.tailRating },
    lag: { ...m.lag },
  }
}
