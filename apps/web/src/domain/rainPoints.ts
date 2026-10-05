import { RAIN_EXTERNAL_MAX } from './constants'
import type { RainPointDef } from './types'

/** Deux points plus proches que ce seuil (~1 km) designent le meme lieu. */
export const RAIN_POINT_MIN_DISTANCE = 0.01

export function externalRainKey(lat: number, lon: number): string {
  return `ext_${Math.round(lat * 1000)}_${Math.round(lon * 1000)}`
}

export function roundCoord(v: number): number {
  return Math.round(v * 10000) / 10000
}

/** Retourne le point existant situe au meme endroit, `null` sinon. */
export function findNearbyRainPoint(
  lat: number,
  lon: number,
  existing: RainPointDef[],
): RainPointDef | null {
  return (
    existing.find(
      (d) =>
        Math.abs(d.lat - lat) < RAIN_POINT_MIN_DISTANCE &&
        Math.abs(d.lon - lon) < RAIN_POINT_MIN_DISTANCE,
    ) ?? null
  )
}

export interface ManualRainInput {
  name: string
  lat: number | null
  lon: number | null
}

/** Retourne le message d'erreur FR, ou `null` si le point peut etre ajoute. */
export function validateManualRainPoint(
  input: ManualRainInput,
  existing: RainPointDef[],
): string | null {
  if (!input.name.trim()) return 'Indiquez un nom.'
  if (input.lat === null || !Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) {
    return 'Latitude invalide (entre -90 et 90).'
  }
  if (input.lon === null || !Number.isFinite(input.lon) || input.lon < -180 || input.lon > 180) {
    return 'Longitude invalide (entre -180 et 180).'
  }
  if (existing.length >= RAIN_EXTERNAL_MAX) return `Maximum ${RAIN_EXTERNAL_MAX} points amont.`
  const near = findNearbyRainPoint(roundCoord(input.lat), roundCoord(input.lon), existing)
  if (near) return `Ce lieu est déjà dans la liste (« ${near.name} »).`
  return null
}

/** Construit la definition a partir d'une saisie deja validee. */
export function makeExternalRainDef(name: string, lat: number, lon: number, context = ''): RainPointDef {
  const la = roundCoord(lat)
  const lo = roundCoord(lon)
  return { key: externalRainKey(la, lo), name: name.trim(), context, lat: la, lon: lo }
}
