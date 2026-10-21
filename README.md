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

## Suivi d'exploitation

Seuils (onglet **Seuils d'exploitation**), tous en m³/s sauf le délai :

| Réglage | Rôle |
| --- | --- |
| Débit minimal | En dessous, la turbine s'arrête. |
| Débit maximum | Au-dessus, la turbine s'arrête. |
| Débit de démarrage | À partir de ce seuil la turbine peut démarrer ; compris entre minimal et maximum. Affiché par un tiret vertical sur la jauge. |
| Plage de rendement optimal | Zone verte de la jauge. |
| Délai de propagation (min) | Temps que met le débit de la station de référence pour arriver à la turbine. |

Le texte sous le débit amont du panneau (qui remplace l'ancien « X m³/s sous le débit… ») anticipe les changements d'état de la turbine ;
le badge garde la zone du débit amont, avec un statut en plus : « Mesure trop ancienne ».

L'application ne mesure pas l'état de la turbine : elle le **déduit** en rejouant l'historique du débit affiché (décalé du délai de propagation)
avec les règles ci-dessous, en supposant que la turbine démarre dès que c'est possible. L'état initial est « en marche » si la première
mesure de l'historique permet de démarrer, « à l'arrêt » sinon : avec une plage d'historique courte, cette hypothèse pèse davantage.

- Le débit à la turbine à l'instant *t* est le débit mesuré à la station à *t − délai*. Ce qui est déjà passé à la station est donc **connu** (« prévu ») ;
  au-delà, la tendance de la dernière heure est prolongée (« probable », préfixé de `~`), sur 2 h maximum.
- En marche : arrêt si le débit passe sous le minimal ou au-dessus du maximum.
- À l'arrêt : démarrage possible si débit de démarrage ≤ débit ≤ débit maximum. Entre minimal et démarrage, l'état courant est conservé (hystérésis).
- « Stable » = aucun changement prévu sur l'horizon et au moins 10 % de la plage [minimal ; maximum] de marge avec le seuil le plus proche, sinon « à surveiller ».
- Une mesure de plus de 2 h désactive toute prévision.

Les constantes (`OUTLOOK_HORIZON_MIN`, `OUTLOOK_STALE_MIN`, `OUTLOOK_WATCH_RATIO`) sont dans `apps/web/src/domain/constants.ts`.
Une configuration enregistrée avec l'ancien format (débit de réserve / capacité maximum) est migrée automatiquement.

## Rafraîchissement des données

- **Manuel** (bouton), **automatique** (intervalle réglable, 0 = désactivé) et **au retour sur l'onglet** ou quand le réseau revient, si les données sont plus vieilles que l'intervalle (les minuteurs sont suspendus en arrière-plan et en veille).
- Une demande de chargement faite **pendant** un chargement (changement de période, fermeture de la configuration…) n'est pas perdue : elle déclenche un seul rechargement une fois le courant terminé, avec la période du moment. Les ticks du minuteur, eux, sont ignorés pendant un chargement.
- Chaque station et chaque point de pluie n'applique que la réponse du **dernier** chargement lancé : une réponse lente et ancienne ne remplace jamais une donnée plus récente.
- « Dernière mise à jour » n'avance que si au moins une source (Hub'Eau, Open-Meteo, Vigicrues) a répondu ; l'en-tête indique aussi l'âge de la mesure la plus ancienne (vue en direct uniquement). En cas d'échec, les anciennes données restent affichées avec un bandeau d'erreur sur la carte concernée.

## Sources de données

[Hub'Eau Hydrométrie](https://hubeau.eaufrance.fr/) · [Open-Meteo](https://open-meteo.com/) ·
[Vigicrues](https://www.vigicrues.gouv.fr/) (via le proxy).

Si le proxy est indisponible, l'application reste fonctionnelle : seul le bandeau de vigilance crues
est signalé en erreur.

## Licence

GPLv3 — voir [LICENSE.md](LICENSE.md).
