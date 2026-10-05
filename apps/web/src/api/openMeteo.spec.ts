import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { config } from '@/config/env'
import { server } from '@/test/msw/server'
import { fetchRain, placeSubtitle, searchPlaces } from './openMeteo'

const hourly = (n: number) => ({
  hourly: {
    time: Array.from({ length: n }, (_, i) => new Date(i * 3_600_000).toISOString()),
    precipitation: Array.from({ length: n }, () => 1),
  },
})

describe('fetchRain', () => {
  it('ne fait aucune requête sans point', async () => {
    expect(await fetchRain([])).toEqual([])
  })

  it('accepte une réponse objet pour un point unique', async () => {
    server.use(http.get(config.openMeteoForecastUrl, () => HttpResponse.json(hourly(3))))
    const [serie] = await fetchRain([{ lat: 43, lon: 1 }])
    expect(serie?.values).toEqual([1, 1, 1])
  })

  it('accepte une réponse tableau pour plusieurs points', async () => {
    server.use(
      http.get(config.openMeteoForecastUrl, () => HttpResponse.json([hourly(2), hourly(4)])),
    )
    const series = await fetchRain([
      { lat: 43, lon: 1 },
      { lat: 44, lon: 2 },
    ])
    expect(series[0]?.times).toHaveLength(2)
    expect(series[1]?.times).toHaveLength(4)
  })

  it('envoie les coordonnées et la fenêtre attendues', async () => {
    let url: URL | null = null
    server.use(
      http.get(config.openMeteoForecastUrl, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json(hourly(1))
      }),
    )
    await fetchRain([
      { lat: 43, lon: 1 },
      { lat: 44, lon: 2 },
    ])
    expect(url!.searchParams.get('latitude')).toBe('43,44')
    expect(url!.searchParams.get('longitude')).toBe('1,2')
    expect(url!.searchParams.get('past_hours')).toBe('24')
    expect(url!.searchParams.get('forecast_hours')).toBe('48')
    expect(url!.searchParams.get('models')).toBe('meteofrance_seamless')
  })

  it('retourne null pour un point sans série exploitable', async () => {
    server.use(http.get(config.openMeteoForecastUrl, () => HttpResponse.json([{}, hourly(1)])))
    const series = await fetchRain([
      { lat: 43, lon: 1 },
      { lat: 44, lon: 2 },
    ])
    expect(series[0]).toBeNull()
    expect(series[1]).not.toBeNull()
  })

  it('remonte les erreurs HTTP', async () => {
    server.use(http.get(config.openMeteoForecastUrl, () => new HttpResponse(null, { status: 429 })))
    await expect(fetchRain([{ lat: 43, lon: 1 }])).rejects.toThrow(/HTTP 429/)
  })
})

describe('searchPlaces', () => {
  it('retourne une liste vide sans résultat', async () => {
    expect(await searchPlaces('zzz')).toEqual([])
  })

  it('filtre les résultats sans coordonnées numériques', async () => {
    server.use(
      http.get(config.openMeteoGeocodingUrl, () =>
        HttpResponse.json({
          results: [
            { name: 'Castres', latitude: 43.6, longitude: 2.2 },
            { name: 'Sans coord', latitude: null, longitude: null },
          ],
        }),
      ),
    )
    const results = await searchPlaces('cas')
    expect(results).toHaveLength(1)
    expect(results[0]!.name).toBe('Castres')
  })

  it('restreint la recherche à la France et au français', async () => {
    let url: URL | null = null
    server.use(
      http.get(config.openMeteoGeocodingUrl, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ results: [] })
      }),
    )
    await searchPlaces('Saint Jean')
    expect(url!.searchParams.get('name')).toBe('Saint Jean')
    expect(url!.searchParams.get('countryCode')).toBe('FR')
    expect(url!.searchParams.get('language')).toBe('fr')
  })
})

describe('placeSubtitle', () => {
  const base = { name: 'X', latitude: 0, longitude: 0 }

  it('combine le département et l’altitude', () => {
    expect(placeSubtitle({ ...base, admin2: 'Tarn', elevation: 172.4 })).toBe('Tarn · 172 m')
  })

  it('retombe sur la région puis sur France', () => {
    expect(placeSubtitle({ ...base, admin1: 'Occitanie' })).toBe('Occitanie')
    expect(placeSubtitle(base)).toBe('France')
  })
})
