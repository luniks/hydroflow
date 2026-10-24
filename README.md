# ⚡ HydroFlow •••

Tableau de bord de suivi de stations hydrométriques (Hub'Eau) pour l'exploitation d'une turbine Kaplan : niveaux et débits, pluviométrie observée et prévue, vigilance crues.

## Pile technique

- Vue 3 (`<script setup>`, TypeScript strict)
- Vite
- Tailwind CSS v4 (tokens CSS, thèmes sombre/clair ; suit le thème du système, ou thème imposé via le bouton de l'en-tête : auto → clair → sombre)
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

## Suivi d'exploitation

Seuils (onglet **Seuils d'exploitation**) :

| Réglage | Unité | Rôle |
| --- | --- | --- |
| Débit minimal | m³/s | En dessous, la turbine s'arrête. |
| Débit maximum | m³/s | Au-dessus, la turbine s'arrête. |
| Débit de démarrage | m³/s | À partir de ce seuil la turbine peut démarrer ; compris entre minimal et maximum. Affiché par un tiret vertical sur la jauge. |
| Plage de rendement optimal | m³/s | Zone verte de la jauge. |
| Délai de propagation | min | Temps que met le débit de la station de référence pour arriver à la turbine. |

### Indicateurs de tendance

Chaque carte de station affiche **une seule ligne** sous la valeur : le prochain seuil franchi et son délai
(`▲ Haut ~40 min`), sinon un palier (`▬ stable 20 min`) ou la pente (`▲ +3.20 m³/s/h`), suivie de l'âge de la
dernière mesure quand elle a plus de 15 min (`· 1 h 20`). Les seuils sont ceux de la station (Bas / Haut) ; pour la
station de référence ce sont les seuils d'exploitation, en lecture seule (modifiables dans la configuration). Le temps
est celui de la station : le délai de propagation n'intervient que dans le suivi d'exploitation.

Le calcul (`domain/trend.ts`) lisse les creux isolés, détecte d'abord un **palier** (15 min dans la tolérance de bruit
mesuré de la station), sinon retient la **pente** de la fenêtre de 30 puis 60 min si elle dépasse 3 erreurs-types, et
n'applique la **courbure** (ETA d'une courbe qui accélère) que si elle est significative. Une série trop courte retombe
sur la pente 2 points sur 1 h.

Dans la zone dépliée du suivi d'exploitation : détail de la prévision, heure d'arrivée de la dernière mesure à la
turbine, et bilan de la période (temps en zone optimale, arrêts). La prévision annonce aussi l'entrée et la sortie de la
zone optimale.

## Sources de données

[Hub'Eau Hydrométrie](https://hubeau.eaufrance.fr/) · [Open-Meteo](https://open-meteo.com/) ·
[Vigicrues](https://www.vigicrues.gouv.fr/) (via le proxy).

Si le proxy est indisponible, l'application reste fonctionnelle : seul le bandeau de vigilance crues
est signalé en erreur.

## Licence

GPLv3 — voir [LICENSE.md](LICENSE.md).
