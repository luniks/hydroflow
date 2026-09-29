import { config } from '@/config/env'
import { MAX_PAGES } from '@/domain/constants'
import { computeWindow } from '@/domain/series'
import type { SeriesPoint } from '@/domain/types'
import { ApiError, fetchJson, isoNoMillis } from './http'

interface RawObservation {
  date_obs: string
  resultat_obs: number | null
  grandeur_hydro: 'H' | 'Q'
}

interface ObservationsResponse {
  data?: RawObservation[]
  next?: string | null
}

interface StationResponse {
  data?: Array<{
    libelle_station?: string | null
    libelle_site?: string | null
    libelle_cours_eau?: string | null
    latitude_station?: number | null
    longitude_station?: number | null
    latitude?: number | null
    longitude?: number | null
  }>
}

export interface StationInfo {
  name: string | null
  river: string | null
  lat: number | null
  lon: number | null
}

export interface Observations {
  heightPoints: SeriesPoint[]
  flowPoints: SeriesPoint[]
}

function coord(v: unknown): number | null {
  const n = typeof v === 'string' ? Number.parseFloat(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** Retourne `null` si la station est introuvable : l'appelant retombe sur le nom par defaut. */
export async function fetchStationInfo(code: string): Promise<StationInfo | null> {
  try {
    const url = `${config.hubeauUrl}/referentiel/stations?code_station=${encodeURIComponent(code)}&format=json&size=1`
    const data = await fetchJson<StationResponse>(url)
    const s = data.data?.[0]
    if (!s) return null
    return {
      name: s.libelle_station || s.libelle_site || null,
      river: s.libelle_cours_eau || null,
      lat: coord(s.latitude_station ?? s.latitude),
      lon: coord(s.longitude_station ?? s.longitude),
    }
  } catch {
    return null
  }
}

/**
 * Hauteur (H) et debit (Q) sur la fenetre demandee. L'API melange les deux grandeurs
 * dans un meme tableau et pagine par curseur, du plus recent au plus ancien.
 */
export async function fetchObservations(
  code: string,
  hours: number,
  offsetSteps: number,
): Promise<Observations> {
  const { dateDebut, dateFin } = computeWindow(hours, offsetSteps)
  const size = hours <= 24 ? 500 : 6000

  let url: string | null =
    `${config.hubeauUrl}/observations_tr?code_entite=${encodeURIComponent(code)}` +
    `&grandeur_hydro=H,Q&date_debut_obs=${isoNoMillis(dateDebut)}` +
    (dateFin ? `&date_fin_obs=${isoNoMillis(dateFin)}` : '') +
    `&size=${size}&fields=date_obs,resultat_obs,grandeur_hydro`

  const raw: RawObservation[] = []
  let pages = 0

  while (url && pages < MAX_PAGES) {
    const data: ObservationsResponse = await fetchJson<ObservationsResponse>(url).catch((e) => {
      if (e instanceof ApiError && e.kind === 'http')
        throw new ApiError(
          `HTTP ${e.status} lors de la récupération des observations`,
          'http',
          e.status,
        )
      throw e
    })
    if (data.data?.length) raw.push(...data.data)
    pages++

    const oldest = data.data?.length ? data.data[data.data.length - 1] : null
    if (oldest && new Date(oldest.date_obs) <= dateDebut) break
    url = data.next ?? null
  }

  if (!raw.length) return { heightPoints: [], flowPoints: [] }

  const inWindow = (d: RawObservation) => {
    const t = new Date(d.date_obs)
    return t >= dateDebut && (!dateFin || t <= dateFin)
  }

  // L'API renvoie du plus recent au plus ancien : on remet en ordre chronologique.
  const toChronoPoints = (grandeur: 'H' | 'Q', divisor: number): SeriesPoint[] =>
    raw
      .filter((d) => d.grandeur_hydro === grandeur && d.resultat_obs != null && inWindow(d))
      .map((d) => ({ t: d.date_obs, y: d.resultat_obs! / divisor }))
      .reverse()

  return {
    heightPoints: toChronoPoints('H', 1000), // mm -> m
    flowPoints: toChronoPoints('Q', 1000), // l/s -> m³/s
  }
}
