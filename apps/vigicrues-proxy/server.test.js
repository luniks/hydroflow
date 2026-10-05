/** Tests d'intégration du proxy Vigicrues (node:test, sans dépendance). */
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

/** Faux flux Vigicrues piloté par les tests. */
let upstreamHandler = null;
const upstream = http.createServer((req, res) => upstreamHandler(req, res));

const geojson = (features) => JSON.stringify({ type: "FeatureCollection", features });
const okFlux = () =>
  geojson([
    { type: "Feature", properties: { CdEntCru: "TL1", LbEntCru: "Agout", NivInfViCr: "2" } },
    { type: "Feature", properties: { CdEntVigiCru: "25", LbEntCru: "Tarn aval", NivInfViCr: "1" } },
  ]);

/** Répond avec un corps JSON fixe. */
function serve(body, status = 200, contentType = "application/json") {
  upstreamHandler = (_req, res) => {
    res.writeHead(status, { "Content-Type": contentType });
    res.end(body);
  };
}

let base;
let proxy;

before(async () => {
  await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
  serve(okFlux());

  // Les constantes du proxy sont lues à l'import : l'environnement doit être prêt avant.
  process.env.UPSTREAM_URL = `http://127.0.0.1:${upstream.address().port}/flux`;
  process.env.CACHE_TTL_S = "0"; // chaque requête retente l'amont -> permet de tester le repli périmé
  process.env.BASE_PATH = "/vigicrues";
  process.env.ALLOWED_ORIGINS = "*";

  ({ server: proxy } = await import("./server.js"));
  await new Promise((r) => proxy.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${proxy.address().port}`;
});

after(async () => {
  await new Promise((r) => proxy.close(r));
  await new Promise((r) => upstream.close(r));
});

const get = async (path, init) => {
  const res = await fetch(`${base}${path}`, init);
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  return { res, body };
};

describe("GET /vigicrues", () => {
  it("renvoie les propriétés du tronçon demandé (clé CdEntCru)", async () => {
    serve(okFlux());
    const { res, body } = await get("/vigicrues?code=TL1");
    assert.equal(res.status, 200);
    assert.equal(body.code, "TL1");
    assert.equal(body.properties.LbEntCru, "Agout");
    assert.equal(body.stale, false);
  });

  it("accepte aussi l'ancienne clé CdEntVigiCru", async () => {
    serve(okFlux());
    const { body } = await get("/vigicrues?code=25");
    assert.equal(body.properties.LbEntCru, "Tarn aval");
  });

  it("expose les en-têtes CORS", async () => {
    serve(okFlux());
    const { res } = await get("/vigicrues?code=TL1", { headers: { Origin: "http://localhost:5173" } });
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
  });

  it("refuse une requête sans code ou avec un code invalide", async () => {
    for (const path of ["/vigicrues", "/vigicrues?code=", "/vigicrues?code=TL-1", "/vigicrues?code=" + "A".repeat(13)]) {
      const { res, body } = await get(path);
      assert.equal(res.status, 400, path);
      assert.match(body.error, /code/i);
    }
  });

  it("renvoie 404 avec des exemples quand le code est inconnu", async () => {
    serve(okFlux());
    const { res, body } = await get("/vigicrues?code=ZZZ");
    assert.equal(res.status, 404);
    assert.deepEqual(body.exemplesDeCodes, ["TL1", "25"]);
  });

  it("sert la dernière réponse connue (stale) quand Vigicrues tombe", async () => {
    serve(okFlux());
    await get("/vigicrues?code=TL1"); // alimente le cache

    serve("<html>maintenance</html>", 503, "text/html");
    const { res, body } = await get("/vigicrues?code=TL1");
    assert.equal(res.status, 200);
    assert.equal(body.stale, true);
    assert.equal(body.properties.LbEntCru, "Agout");
  });

  it("tolère un flux sans tronçon exploitable en servant le cache précédent", async () => {
    serve(okFlux());
    await get("/vigicrues?code=TL1");

    serve(geojson([{ type: "Feature", properties: { autre: 1 } }]));
    const { res, body } = await get("/vigicrues?code=TL1");
    assert.equal(res.status, 200);
    assert.equal(body.stale, true);
  });
})


describe("GET /vigicrues/status", () => {
  it("renvoie 200 et les compteurs de cache quand l'amont répond", async () => {
    serve(okFlux());
    await get("/vigicrues?code=TL1");
    const { res, body } = await get("/vigicrues/status");
    assert.equal(res.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.cache.entries, 2);
    assert.equal(typeof body.uptimeSeconds, "number");
    assert.equal(res.headers.get("cache-control"), "no-store");
  });
});

describe("autres routes", () => {
  it("répond 404 sur une route inconnue", async () => {
    const { res, body } = await get("/inconnu");
    assert.equal(res.status, 404);
    assert.equal(body.error, "Route inconnue");
  });

  it("répond 405 sur une méthode non autorisée", async () => {
    const { res } = await get("/vigicrues?code=TL1", { method: "POST" });
    assert.equal(res.status, 405);
  });

  it("répond 204 au préflight OPTIONS", async () => {
    const res = await fetch(`${base}/vigicrues`, { method: "OPTIONS" });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("access-control-allow-methods"), "GET, OPTIONS");
  });
});
