/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VIGICRUES_PROXY_URL?: string
  readonly VITE_HUBEAU_URL?: string
  readonly VITE_OPENMETEO_FORECAST_URL?: string
  readonly VITE_OPENMETEO_GEOCODING_URL?: string
  readonly VITE_VIGICRUES_TERRITORY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
