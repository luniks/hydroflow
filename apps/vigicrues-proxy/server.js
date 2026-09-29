/**
 * Proxy Vigicrues — https://api.luniks.fr/vigicrues
 *
 * Aucune dépendance (Node >= 18 : fetch et AbortSignal.timeout natifs).
 *
 * Routes (préfixe configurable via BASE_PATH, "/vigicrues" par défaut) :
 *   GET {BASE_PATH}?code=TL1   -> vigilance du tronçon/territoire demandé (JSON réduit)
 *   GET {BASE_PATH}/status     -> état du proxy et du cache (200 = ok, 503 = dégradé)
 *
 * Variables d'environnement :
 *   PORT              port d'écoute                                   (3000)
 *   HOST              interface d'écoute                              (127.0.0.1, derrière nginx/caddy)
 *   BASE_PATH         préfixe des routes ; "" si le reverse proxy le retire  (/vigicrues)
 *   ALLOWED_ORIGINS   origines autorisées en CORS, séparées par des virgules, ou "*"  (*)
 *   CACHE_TTL_S       durée de fraîcheur du cache                     (300)
 *   STALE_MAX_S       âge max d'une réponse périmée servie si Vigicrues est en panne  (3600)
 *   UPSTREAM_TIMEOUT_MS  timeout de l'appel à Vigicrues               (10000)
 *   UPSTREAM_URL      URL du flux GeoJSON Vigicrues (voir défaut ci-dessous)
 */
import http from "node:http";
import { argv } from "node:process";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "127.0.0.1";
const BASE_PATH = (process.env.BASE_PATH ?? "/vigicrues").replace(/\/+$/, "");
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim()).filter(Boolean);
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_S ?? 300) * 1000;
const STALE_MAX_MS = Number(process.env.STALE_MAX_S ?? 3600) * 1000;
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS ?? 10000);
// URL documentée avec le "/" final ; la variante sans "/" est essayée en second recours
const UPSTREAM_URL = process.env.UPSTREAM_URL ?? "https://www.vigicrues.gouv.fr/services/1/InfoVigiCru.geojson/";
const UPSTREAM_CANDIDATES = [UPSTREAM_URL, UPSTREAM_URL.endsWith("/") ? UPSTREAM_URL.slice(0, -1) : `${UPSTREAM_URL}/`];
// Vigicrues peut refuser ou vider les réponses pour des clients "non navigateur" : en-têtes de navigateur classiques
const UPSTREAM_HEADERS = {
  Accept: "application/geo+json, application/json;q=0.9, */*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9",
  Referer: "https://www.vigicrues.gouv.fr/",
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};
const CODE_RE = /^[A-Za-z0-9]{1,12}$/;

const startedAt = Date.now();
const cache = { entries: new Map(), fetchedAt: 0 }; // code -> properties
const upstreamState = { lastSuccessAt: null, lastErrorAt: null, lastError: null, lastDiagnostic: null };
let inflight = null;

/** Cherche une propriété sans tenir compte de la casse (le flux a changé de format par le passé). */
function pick(obj, name) {
  if (!obj || typeof obj !== "object") return undefined;
  if (name in obj) return obj[name];
  const key = Object.keys(obj).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? obj[key] : undefined;
}

/** Extrait { code -> propriétés } du GeoJSON, en tolérant quelques variantes de structure. */
function extractEntries(data) {
  const list = Array.isArray(data) ? data : pick(data, "features") ?? pick(data, "data") ?? [];
  const entries = new Map();
  for (const f of Array.isArray(list) ? list : []) {
    const props = pick(f, "properties") ?? f;
    const code = pick(props, "CdEntCru") ?? pick(props, "CdEntVigiCru"); // flux actuel : CdEntCru (ancienne version : CdEntVigiCru)
    if (code !== undefined && code !== null) entries.set(String(code), props);
  }
  return entries;
}

/** Résumé de ce que Vigicrues a réellement renvoyé, pour comprendre une réponse inattendue. */
function describeResponse(res, text, data) {
  const list = Array.isArray(data) ? data : pick(data, "features");
  const first = Array.isArray(list) ? list[0] : undefined;
  return {
    httpStatus: res.status,
    contentType: res.headers.get("content-type"),
    bytes: text.length,
    topLevelKeys: data && typeof data === "object" ? Object.keys(data).slice(0, 15) : null,
    featuresCount: Array.isArray(list) ? list.length : null,
    firstFeatureKeys: first ? Object.keys(first).slice(0, 15) : null,
    firstPropertiesKeys: first ? Object.keys(pick(first, "properties") ?? {}).slice(0, 20) : null,
    bodyStart: data ? undefined : text.slice(0, 200), // affiché seulement si ce n'est pas du JSON
  };
}

/** Récupère le GeoJSON Vigicrues et ne conserve que les propriétés de chaque entité (léger). */
async function refreshCache() {
  if (inflight) return inflight; // évite les appels simultanés vers Vigicrues
  inflight = (async () => {
    let lastErr;
    for (const url of UPSTREAM_CANDIDATES) {
      try {
        const res = await fetch(url, { headers: UPSTREAM_HEADERS, redirect: "follow", signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
        const text = await res.text();
        let data = null;
        try { data = JSON.parse(text); } catch { /* réponse non JSON, décrite plus bas */ }
        upstreamState.lastDiagnostic = { url, ...describeResponse(res, text, data) };
        if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
        if (!data) throw new Error(`réponse non JSON (${res.headers.get("content-type") ?? "type inconnu"}) : ${text.slice(0, 80).replace(/\s+/g, " ")}`);
        const entries = extractEntries(data);
        if (entries.size === 0) throw new Error("aucun tronçon avec CdEntCru/CdEntVigiCru dans la réponse — voir upstream.diagnostic sur /status");
        cache.entries = entries;
        cache.fetchedAt = Date.now();
        upstreamState.lastSuccessAt = cache.fetchedAt;
        upstreamState.lastError = null;
        return;
      } catch (err) {
        lastErr = err?.name === "TimeoutError" ? new Error("timeout") : err;
      }
    }
    upstreamState.lastErrorAt = Date.now();
    upstreamState.lastError = String(lastErr?.message ?? lastErr);
    throw lastErr;
  })().finally(() => { inflight = null; });
  return inflight;
}

/** Retourne le cache s'il est frais, sinon le rafraîchit ; en cas d'échec, sert une version périmée si elle n'est pas trop vieille. */
async function getEntries() {
  const age = Date.now() - cache.fetchedAt;
  if (cache.fetchedAt && age < CACHE_TTL_MS) return { entries: cache.entries, stale: false };
  try {
    await refreshCache();
    return { entries: cache.entries, stale: false };
  } catch (err) {
    if (cache.fetchedAt && Date.now() - cache.fetchedAt < STALE_MAX_MS) return { entries: cache.entries, stale: true };
    throw err;
  }
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  const headers = { Vary: "Origin" };
  if (ALLOWED_ORIGINS.includes("*")) headers["Access-Control-Allow-Origin"] = "*";
  else if (origin && ALLOWED_ORIGINS.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
  headers["Access-Control-Allow-Headers"] = "Content-Type";
  headers["Access-Control-Max-Age"] = "86400";
  return headers;
}

function sendJson(req, res, status, body, extra = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    ...corsHeaders(req),
    ...extra,
  });
  res.end(req.method === "HEAD" ? undefined : payload);
}

const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

function statusPayload() {
  const now = Date.now();
  const cacheAge = cache.fetchedAt ? now - cache.fetchedAt : null;
  // Dégradé : cache jamais rempli après un échec, ou plus ancien que la limite de péremption
  const degraded = cache.fetchedAt ? cacheAge > STALE_MAX_MS : upstreamState.lastErrorAt !== null;
  return {
    status: degraded ? "degraded" : "ok",
    uptimeSeconds: Math.round((now - startedAt) / 1000),
    upstream: {
      url: UPSTREAM_URL,
      lastSuccessAt: iso(upstreamState.lastSuccessAt),
      lastErrorAt: iso(upstreamState.lastErrorAt),
      lastError: upstreamState.lastError,
      diagnostic: upstreamState.lastDiagnostic,
    },
    cache: {
      entries: cache.entries.size,
      fetchedAt: iso(cache.fetchedAt),
      ageSeconds: cacheAge === null ? null : Math.round(cacheAge / 1000),
      ttlSeconds: CACHE_TTL_MS / 1000,
    },
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders(req));
      return res.end();
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return sendJson(req, res, 405, { error: "Méthode non autorisée" }, { Allow: "GET, HEAD, OPTIONS" });
    }

    const url = new URL(req.url, "http://localhost");
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === `${BASE_PATH}/status`) {
      const payload = statusPayload();
      return sendJson(req, res, payload.status === "ok" ? 200 : 503, payload, { "Cache-Control": "no-store" });
    }

    if (path === (BASE_PATH || "/")) {
      const code = url.searchParams.get("code");
      if (!code || !CODE_RE.test(code)) {
        return sendJson(req, res, 400, { error: "Paramètre 'code' requis (ex. ?code=TL1)" });
      }
      let result;
      try {
        result = await getEntries();
      } catch (err) {
        return sendJson(req, res, 502, { error: "Vigicrues indisponible", detail: String(err?.message ?? err) });
      }
      const properties = result.entries.get(code);
      if (!properties) return sendJson(req, res, 404, { error: `Code '${code}' introuvable dans Vigicrues`, exemplesDeCodes: [...result.entries.keys()].slice(0, 30) });
      return sendJson(
        req,
        res,
        200,
        { code, properties, fetchedAt: iso(cache.fetchedAt), stale: result.stale },
        { "Cache-Control": `public, max-age=${Math.min(60, CACHE_TTL_MS / 1000)}` }
      );
    }

    sendJson(req, res, 404, { error: "Route inconnue" });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(req, res, 500, { error: "Erreur interne" });
    else res.end();
  }
});

// Démarrage uniquement en exécution directe : les tests importent le module et pilotent le serveur.
const isMain = argv[1] && realpathSync(argv[1]) === realpathSync(fileURLToPath(import.meta.url));
const underPassenger = typeof globalThis.PhusionPassenger !== "undefined" || "PASSENGER_APP_ENV" in process.env;

if (isMain || underPassenger) {
  server.listen(PORT, HOST, () => {
    console.log(`vigicrues-proxy sur http://${HOST}:${PORT}${BASE_PATH || "/"} (status : ${BASE_PATH}/status)`);
    refreshCache().catch((err) => console.warn("Préchargement du cache impossible :", err.message)); // non bloquant
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}

export { server, extractEntries, statusPayload };
