#!/usr/bin/env bash
# Deploie la webapp et le proxy Vigicrues sur le serveur cPanel via SSH/rsync.
# Usage : scripts/deploy.sh [--dry-run] [--skip-tests]
# Configuration : scripts/.env.production (non versionne, voir .env.example).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${DEPLOY_CONFIG:-$ROOT/scripts/.env.production}"

DRY_RUN=0
SKIP_TESTS=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    *) echo "Option inconnue : $arg" >&2; exit 2 ;;
  esac
done

[[ -f "$CONFIG" ]] || { echo "Configuration absente : $CONFIG (copier .env.example)" >&2; exit 1; }
# shellcheck disable=SC1090
source "$CONFIG"
: "${SSH_TARGET:?}" "${WEB_DIR:?}" "${PROXY_DIR:?}" "${WEB_BASE:?}" "${PROXY_PUBLIC_URL:?}"
SSH_OPTS="${SSH_OPTS:-}"

cd "$ROOT"

# Deploiement uniquement depuis un tag de version propre
TAG="$(git describe --exact-match --tags --match 'v[0-9]*' HEAD 2>/dev/null || true)"
[[ -n "$TAG" ]] || { echo "HEAD doit etre sur un tag de version (vX.Y.Z)." >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "Arbre de travail non propre." >&2; exit 1; }
echo "==> Deploiement de $TAG"

if [[ $SKIP_TESTS -eq 0 ]]; then
  npm ci
  npm test
  npm run typecheck
fi

VITE_BASE="$WEB_BASE" VITE_VIGICRUES_PROXY_URL="$PROXY_PUBLIC_URL" npm run build

RSYNC=(rsync -az --delete --itemize-changes -e "ssh $SSH_OPTS")
[[ $DRY_RUN -eq 1 ]] && RSYNC+=(--dry-run)

echo "==> Webapp -> $SSH_TARGET:$WEB_DIR"
"${RSYNC[@]}" --exclude '.htaccess' apps/web/dist/ "$SSH_TARGET:$WEB_DIR/"

echo "==> Proxy -> $SSH_TARGET:$PROXY_DIR"
"${RSYNC[@]}" --exclude '.htaccess' --exclude 'node_modules' --exclude 'tmp' \
  --include 'server.js' --include 'package.json' --exclude '*' \
  apps/vigicrues-proxy/ "$SSH_TARGET:$PROXY_DIR/"

if [[ $DRY_RUN -eq 0 ]]; then
  echo "==> Redemarrage du proxy (Passenger)"
  # shellcheck disable=SC2086
  ssh $SSH_OPTS "$SSH_TARGET" "mkdir -p '$PROXY_DIR/tmp' && touch '$PROXY_DIR/tmp/restart.txt'"
fi

echo "==> Termine ($TAG)"
