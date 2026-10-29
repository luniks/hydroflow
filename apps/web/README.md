# HydroFlow — application web

Tableau de bord Vue 3 : niveaux et débits des stations Hub'Eau, pluviométrie observée et prévue (Open-Meteo), vigilance crues (via [`vigicrues-proxy`](../vigicrues-proxy/README.md)) et prévision de production de la turbine VLH.

## Pile technique

- Vue 3 (`<script setup>`, TypeScript strict) + Vite
- Tailwind CSS v4 (thème auto → clair → sombre)
- Vitest + MSW + Vue Test Utils

## Structure

```
src/domain/          règles métier pures (tendances, pluie, modèle de production) — testées
src/api/             clients Hub'Eau, Open-Meteo, Vigicrues
src/composables/     état applicatif (stations, pluie, thème, période, rafraîchissement)
src/components/ui/   design system
src/components/      composants métier (station, pluie, exploitation, graphiques, configuration)
```

## Développement

Depuis la racine du dépôt :

```bash
npm run dev            # http://localhost:5173
npm test -w apps/web
```

## Configuration

Variables d'environnement (`apps/web/.env`, voir `.env.example` ; toutes optionnelles) :

| Variable                       | Description                      | Défaut                                           |
|--------------------------------|----------------------------------|--------------------------------------------------|
| `VITE_VIGICRUES_PROXY_URL`     | URL du proxy Vigicrues           | `https://api.luniks.fr/vigicrues`                |
| `VITE_HUBEAU_URL`              | API Hub'Eau Hydrométrie          | `https://hubeau.eaufrance.fr/api/v2/hydrometrie` |
| `VITE_OPENMETEO_FORECAST_URL`  | API prévisions Open-Meteo        | `https://api.open-meteo.com/v1/forecast`         |
| `VITE_OPENMETEO_GEOCODING_URL` | API géocodage Open-Meteo         | `https://geocoding-api.open-meteo.com/v1/search` |
| `VITE_VIGICRUES_TERRITORY`     | Code du tronçon/territoire suivi | `TL1`                                            |

Stations, seuils, points de pluie et paramètres de la turbine se règlent dans l'application (bouton **Configuration**) et sont persistés en `localStorage`.

## Prévision de production

À partir des débits des stations amont et aval, le modèle annonce la marche/arrêt de la turbine dans les heures à venir, la puissance attendue et la stabilité de la prévision.

Principes :

- la turbine démarre quand le niveau amont atteint la consigne de démarrage ;
- la puissance monte avec le débit turbiné (débit de réserve déduit) jusqu'à la puissance nominale ; le surplus passe en surverse ;
- en crue, la chute disponible diminue, la puissance baisse jusqu'à l'arrêt ; arrêt aussi hors plage de chute ou quand le débit approche le débit de réserve ;
- après redescente du niveau amont, la turbine tourne en régime réduit avant de s'arrêter.

Paramètres réglables : puissance nominale, débit de réserve, capacité maximale turbinée, débit d'amorçage, plage de chute, niveaux de référence du barrage.

## Indicateurs de tendance

Chaque carte de station affiche une ligne : prochain seuil franchi et délai (`▲ Haut ~40 min`), sinon palier (`▬ stable 20 min`) ou pente (`▲ +3.20 m³/s/h`). Calcul dans `domain/trend.ts`.

## Licence

GPLv3 — voir [LICENSE.md](../../LICENSE.md).
