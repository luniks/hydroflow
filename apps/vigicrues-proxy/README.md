# HydroFlow — proxy Vigicrues

Proxy Node.js sans dépendance devant le flux GeoJSON [Vigicrues](https://www.vigicrues.gouv.fr/) : ajoute les en-têtes CORS et un cache. Si Vigicrues est en panne, une réponse périmée est servie (dans la limite de `STALE_MAX_S`).

## Routes

| Route                      | Description                          |
|----------------------------|--------------------------------------|
| `GET {BASE_PATH}?code=TL1` | Vigilance du tronçon/territoire      |
| `GET {BASE_PATH}/status`   | État du proxy et du cache            |

## Démarrage

Depuis la racine du dépôt :

```bash
npm run dev            # lance web + proxy
npm test -w apps/vigicrues-proxy
```

## Configuration

Variables d'environnement :

| Variable              | Description                                                        | Défaut                                                          |
|-----------------------|--------------------------------------------------------------------|-----------------------------------------------------------------|
| `PORT`                | Port d'écoute                                                      | `3000`                                                          |
| `HOST`                | Interface d'écoute                                                 | `127.0.0.1`                                                     |
| `BASE_PATH`           | Préfixe des routes (`""` si retiré par le reverse proxy)           | `/vigicrues`                                                    |
| `ALLOWED_ORIGINS`     | Origines CORS autorisées, séparées par des virgules, ou `*`        | `*`                                                             |
| `CACHE_TTL_S`         | Durée de fraîcheur du cache (s)                                    | `300`                                                           |
| `STALE_MAX_S`         | Âge max d'une réponse périmée servie si Vigicrues est en panne (s) | `3600`                                                          |
| `UPSTREAM_TIMEOUT_MS` | Timeout de l'appel à Vigicrues (ms)                                | `10000`                                                         |
| `UPSTREAM_URL`        | URL du flux GeoJSON Vigicrues                                      | `https://www.vigicrues.gouv.fr/services/1/InfoVigiCru.geojson/` |

## Licence

GPLv3 — voir [LICENSE.md](../../LICENSE.md).
