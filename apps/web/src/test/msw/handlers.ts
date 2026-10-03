import { HttpResponse, http } from 'msw'
import { config } from '@/config/env'

/** Handlers nominaux ; chaque test peut les surcharger via `server.use(...)`. */
export const handlers = [
  http.get(`${config.hubeauUrl}/referentiel/stations`, () =>
    HttpResponse.json({
      data: [
        {
          code_station: 'O480252002',
          libelle_station: 'Station de test',
          libelle_cours_eau: "L'Agout",
          latitude_station: 43.72,
          longitude_station: 1.82,
        },
      ],
    }),
  ),

  http.get(`${config.hubeauUrl}/observations_tr`, () =>
    HttpResponse.json({ data: [], next: null }),
  ),

  http.get(config.openMeteoForecastUrl, () =>
    HttpResponse.json({ hourly: { time: [], precipitation: [] } }),
  ),

  http.get(config.openMeteoGeocodingUrl, () => HttpResponse.json({ results: [] })),

  http.get(config.vigicruesProxyUrl, () =>
    HttpResponse.json({
      code: config.vigicruesTerritory,
      properties: { NivInfViCr: 1 },
      fetchedAt: new Date().toISOString(),
      stale: false,
    }),
  ),

  http.get(`${config.vigicruesProxyUrl}/status`, () =>
    HttpResponse.json({ status: 'ok', upstream: {}, cache: {} }),
  ),
]
