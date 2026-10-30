# ⚡ HydroFlow •••

Tableau de bord de suivi de stations hydrométriques (Hub'Eau) pour l'exploitation d'une turbine VLH : niveaux et débits, pluviométrie observée et prévue, vigilance crues, prévision de production.

Démo : [hydroflow.luniks.fr](https://hydroflow.luniks.fr)

## Applications

| App                                           | Rôle                                         |
|-----------------------------------------------|----------------------------------------------|
| [`apps/web`](apps/web/README.md)              | Application Vue (tableau de bord)            |
| [`apps/vigicrues-proxy`](apps/vigicrues-proxy/README.md) | Proxy CORS + cache du flux Vigicrues |

Monorepo npm workspaces. Si le proxy est indisponible, l'application web reste fonctionnelle : seul le bandeau de vigilance crues est signalé en erreur.

## Documentation

- [Modèle prédictif de production de la turbine](docs/modele-turbine.md)

## Démarrage

```bash
npm install
npm run dev   # web (5173) + proxy (3000) en parallèle
```

| Script              | Description                              |
|---------------------|------------------------------------------|
| `npm run dev`       | Lance web et proxy                       |
| `npm run build`     | Build de production de l'app web         |
| `npm run preview`   | Sert localement le build de production   |
| `npm run typecheck` | Vérification TypeScript de l'app web     |
| `npm test`          | Tests unitaires de tous les workspaces   |
| `npm run coverage`  | Tests avec rapport de couverture         |

## Sources de données

[Hub'Eau Hydrométrie](https://hubeau.eaufrance.fr/) · [Open-Meteo](https://open-meteo.com/) · [Vigicrues](https://www.vigicrues.gouv.fr/) (via le proxy)

## Licence

GPLv3 — voir [LICENSE.md](LICENSE.md).
