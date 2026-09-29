import { config } from '@/config/env'
import { RAIN_FORECAST_HOURS, RAIN_PAST_HOURS } from '@/domain/constants'
import { fetchJson } from './http'

interface ForecastEntry {
  hourly?: {
    time?: string[]
    precipitation?: number[]
  }
}

export interface RainSeries {
  times: string[]
  values: number[]
}

export interface PlaceResult {
  name: string
  latitude: number
  longitude: number
  admin1?: string
  admin2?: string
  elevation?: number
}

interface GeocodingResponse {
  results?: PlaceResult[]
}

/**
 * Precipitations horaires (24 h passees + 48 h prevues) pour plusieurs points en une requete.
 * Retourne une entree par point, `null` quand la reponse ne contient pas de serie exploitable.
 */
export async function fetchRain(
  points: Array<{ lat: number; lon: number }>,
): Promise<Array<RainSeries | null>> {
  if (!points.length) return []

  const url =
    `${config.openMeteoForecastUrl}` +
    `?latitude=${points.map((p) => p.lat).join(',')}` +
    `&longitude=${points.map((p) => p.lon).join(',')}` +
    '&hourly=precipitation' +
    '&models=meteofrance_seamless' +
    `&past_hours=${RAIN_PAST_HOURS}` +
    `&forecast_hours=${RAIN_FORECAST_HOURS}` +
    '&timezone=Europe%2FParis'

  const data = await fetchJson<ForecastEntry | ForecastEntry[]>(url)
  // Un seul point renvoie un objet, plusieurs renvoient un tableau.
  const list = Array.isArray(data) ? data : [data]

  return points.map((_, i) => {
    const hourly = list[i]?.hourly
    if (!hourly?.time || !hourly.precipitation) return null
    return { times: hourly.time, values: hourly.precipitation }
  })
}

/** Geocodage Open-Meteo : meme fournisseur que la pluie, sans cle d'API. */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const url = `${config.openMeteoGeocodingUrl}?name=${encodeURIComponent(query)}&count=6&language=fr&format=json&countryCode=FR`
  const data = await fetchJson<GeocodingResponse>(url)
  return (data.results ?? []).filter(
    (x) => typeof x.latitude === 'number' && typeof x.longitude === 'number',
  )
}

export function placeSubtitle(place: PlaceResult): string {
  return (
    [
      place.admin2 || place.admin1,
      typeof place.elevation === 'number' ? `${Math.round(place.elevation)} m` : '',
    ]
      .filter(Boolean)
      .join(' · ') || 'France'
  )
}
