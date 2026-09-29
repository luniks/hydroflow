# ⚡ HydroFlow •••

Tableau de bord de suivi de stations hydrométriques (Hub'Eau) pour l'exploitation d'une turbine Kaplan : niveaux et débits, pluviométrie observée et prévue, vigilance crues.

## Pile technique

- Vue 3 (`<script setup>`, TypeScript strict)
- Vite
- Tailwind CSS v4 (tokens CSS, thèmes sombre/clair)
- Vitest + MSW + Vue Test Utils
- Proxy Node sans dépendance pour Vigicrues

## Structure

```
apps/web/                 application Vue
  src/domain/             règles métier pures (seuils, tendances, pluie, exploitation) — 100 % testées
  src/api/                clients Hub'Eau, Open-Meteo, Vigicrues
  src/composables/        état applicatif (stations, pluie, thème, période, rafraîchissement)
  src/components/ui/      design system (boutons, champs, toggles, modale, icônes)
  src/components/         composants métier (station, pluie, exploitation, graphiques, configuration)
apps/vigicrues-proxy/     proxy CORS + cache du flux Vigicrues
```

## Démarrage

```bash
npm install
cp apps/web/.env.example apps/web/.env   # optionnel : des valeurs par défaut existent
npm run dev                              # web (5173) + proxy (3000) en parallèle
```

Autres scripts :

| Script | Description |
| --- | --- |
| `npm run build` | Build de production de l'application web |
| `npm run preview` | Sert localement le build de production |
| `npm run typecheck` | Vérification TypeScript de l'application web |
| `npm test` | Tests unitaires de tous les workspaces |
| `npm run coverage` | Tests avec rapport de couverture |

## Configuration

Front (`apps/web/.env`) :

| Variable | Description | Valeur par défaut |
| --- | --- | --- |
| `VITE_VIGICRUES_PROXY_URL` | URL du proxy Vigicrues | `https://api.luniks.fr/vigicrues` |
| `VITE_HUBEAU_URL` | API Hub'Eau Hydrométrie | `https://hubeau.eaufrance.fr/api/v2/hydrometrie` |
| `VITE_OPENMETEO_FORECAST_URL` | API prévisions Open-Meteo | `https://api.open-meteo.com/v1/forecast` |
| `VITE_OPENMETEO_GEOCODING_URL` | API géocodage Open-Meteo | `https://geocoding-api.open-meteo.com/v1/search` |
| `VITE_VIGICRUES_TERRITORY` | Code du tronçon/territoire suivi | `TL1` |

Proxy (`apps/vigicrues-proxy`) :

| Variable | Description | Valeur par défaut |
| --- | --- | --- |
| `PORT` | Port d'écoute | `3000` |
| `HOST` | Interface d'écoute | `127.0.0.1` |
| `BASE_PATH` | Préfixe des routes (`""` si retiré par le reverse proxy) | `/vigicrues` |
| `ALLOWED_ORIGINS` | Origines CORS autorisées, séparées par des virgules, ou `*` | `*` |
| `CACHE_TTL_S` | Durée de fraîcheur du cache (s) | `300` |
| `STALE_MAX_S` | Âge max d'une réponse périmée servie si Vigicrues est en panne (s) | `3600` |
| `UPSTREAM_TIMEOUT_MS` | Timeout de l'appel à Vigicrues (ms) | `10000` |
| `UPSTREAM_URL` | URL du flux GeoJSON Vigicrues | `https://www.vigicrues.gouv.fr/services/1/InfoVigiCru.geojson/` |

Routes : `GET {BASE_PATH}?code=TL1` et `GET {BASE_PATH}/status`.

Stations suivies, seuils, réglages d'exploitation et points de pluie se règlent dans l'application
(bouton **Configuration**) et sont persistés en `localStorage`.

## Sources de données

[Hub'Eau Hydrométrie](https://hubeau.eaufrance.fr/) · [Open-Meteo](https://open-meteo.com/) ·
[Vigicrues](https://www.vigicrues.gouv.fr/) (via le proxy).

Si le proxy est indisponible, l'application reste fonctionnelle : seul le bandeau de vigilance crues
est signalé en erreur.

## Licence

GPLv3 — voir [LICENSE.md](LICENSE.md).
