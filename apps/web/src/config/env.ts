const env = import.meta.env

export const config = {
  hubeauUrl: env.VITE_HUBEAU_URL ?? 'https://hubeau.eaufrance.fr/api/v2/hydrometrie',
  openMeteoForecastUrl: env.VITE_OPENMETEO_FORECAST_URL ?? 'https://api.open-meteo.com/v1/forecast',
  openMeteoGeocodingUrl:
    env.VITE_OPENMETEO_GEOCODING_URL ?? 'https://geocoding-api.open-meteo.com/v1/search',
  vigicruesProxyUrl: env.VITE_VIGICRUES_PROXY_URL ?? 'https://api.luniks.fr/vigicrues',
  vigicruesTerritory: env.VITE_VIGICRUES_TERRITORY ?? 'TL1',
} as const
