import { config } from '@/config/env'
import { ApiError, fetchJson } from './http'

export type VigicruesLevelKey = 'green' | 'yellow' | 'orange' | 'red'

export const VIGICRUES_LEVELS: Record<number, { key: VigicruesLevelKey; label: string }> = {
  1: { key: 'green', label: 'Vert — pas de vigilance particulière' },
  2: { key: 'yellow', label: 'Jaune — soyez attentif' },
  3: { key: 'orange', label: 'Orange — soyez très vigilant' },
  4: { key: 'red', label: 'Rouge — vigilance absolue' },
}

/** Territoire de rattachement du tronçon (Garonne-Tarn-Lot). */
export const VIGICRUES_TERRITORY_PARENT = '25'

interface VigicruesResponse {
  properties?: Record<string, unknown>
  stale?: boolean
}

export interface VigicruesInfo {
  name: string
  levelCode: number | null
  level: { key: VigicruesLevelKey; label: string } | null
  parentCode: string
  stale: boolean
}

export function bassinUrl(parentCode: string): string {
  return `https://www.vigicrues.gouv.fr/niv2-bassin.php?CdEntVigiCru=${encodeURIComponent(parentCode)}`
}

/**
 * Vigilance crues du troncon suivi, via le proxy CORS.
 * Le flux a change de nom de champs au fil du temps : les anciens sont conserves en repli.
 */
export async function fetchVigicrues(
  code = config.vigicruesTerritory,
): Promise<VigicruesInfo> {
  const data = await fetchJson<VigicruesResponse>(
    `${config.vigicruesProxyUrl}?code=${encodeURIComponent(code)}`,
  )
  const props = data.properties
  if (!props) throw new ApiError(`tronçon ${code} absent de la réponse`, 'payload')

  const rawLevel = props.NivInfViCr ?? props.NivSituVigiCruEnt
  const levelCode = typeof rawLevel === 'number' ? rawLevel : Number(rawLevel)
  const level = VIGICRUES_LEVELS[levelCode] ?? null
  const name =
    (props.lbentcru as string) ||
    (props.NomEntVigiCru as string) ||
    (props.LbEntVigiCru as string) ||
    code

  return {
    name,
    levelCode: Number.isFinite(levelCode) ? levelCode : null,
    level,
    parentCode: (props.cdensup_1 as string) || VIGICRUES_TERRITORY_PARENT,
    stale: data.stale === true,
  }
}

export async function fetchProxyStatus(): Promise<{ status: string }> {
  return fetchJson<{ status: string }>(`${config.vigicruesProxyUrl}/status`)
}
