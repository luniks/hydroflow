import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '@/config/env'
import { server } from '@/test/msw/server'
import { fetchObservations, fetchStationInfo } from './hubeau'

const OBS_URL = `${config.hubeauUrl}/observations_tr`
const REF_URL = `${config.hubeauUrl}/referentiel/stations`

const obs = (date: string, grandeur: 'H' | 'Q', resultat: number | null) => ({
  date_obs: date,
  grandeur_hydro: grandeur,
  resultat_obs: resultat,
})

describe('fetchStationInfo', () => {
  it('retourne le libellé, la rivière et les coordonnées', async () => {
    const info = await fetchStationInfo('O480252002')
    expect(info).toEqual({
      name: 'Station de test',
      river: "L'Agout",
      lat: 43.72,
      lon: 1.82,
    })
  })

  it('retombe sur libelle_site et les coordonnées génériques', async () => {
    server.use(
      http.get(REF_URL, () =>
        HttpResponse.json({
          data: [{ libelle_site: 'Site X', latitude: 43.1, longitude: 1.1 }],
        }),
      ),
    )
    const info = await fetchStationInfo('X')
    expect(info).toMatchObject({ name: 'Site X', river: null, lat: 43.1, lon: 1.1 })
  })

  it('retourne null sur une station introuvable', async () => {
    server.use(http.get(REF_URL, () => HttpResponse.json({ data: [] })))
    expect(await fetchStationInfo('INCONNU')).toBeNull()
  })

  it('retourne null sur une erreur HTTP', async () => {
    server.use(http.get(REF_URL, () => new HttpResponse(null, { status: 500 })))
    expect(await fetchStationInfo('X')).toBeNull()
  })

  it('tolère des coordonnées absentes ou non numériques', async () => {
    server.use(
      http.get(REF_URL, () =>
        HttpResponse.json({ data: [{ libelle_station: 'S', latitude_station: null }] }),
      ),
    )
    expect(await fetchStationInfo('X')).toMatchObject({ lat: null, lon: null })
  })
})

describe('fetchObservations', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('retourne des séries vides sans donnée', async () => {
    expect(await fetchObservations('X', 24, 0)).toEqual({ heightPoints: [], flowPoints: [] })
  })

  it('sépare les grandeurs, convertit les unités et remet en ordre chronologique', async () => {
    server.use(
      http.get(OBS_URL, () =>
        HttpResponse.json({
          data: [
            obs('2026-01-01T11:00:00Z', 'H', 1500),
            obs('2026-01-01T11:00:00Z', 'Q', 8000),
            obs('2026-01-01T10:00:00Z', 'H', 1400),
          ],
          next: null,
        }),
      ),
    )
    const { heightPoints, flowPoints } = await fetchObservations('X', 24, 0)
    expect(heightPoints.map((p) => p.y)).toEqual([1.4, 1.5])
    expect(flowPoints.map((p) => p.y)).toEqual([8])
  })

  it('ignore les mesures nulles et celles hors fenêtre', async () => {
    server.use(
      http.get(OBS_URL, () =>
        HttpResponse.json({
          data: [
            obs('2026-01-01T11:00:00Z', 'H', null),
            obs('2025-12-01T11:00:00Z', 'H', 9999),
            obs('2026-01-01T10:00:00Z', 'H', 1400),
          ],
          next: null,
        }),
      ),
    )
    const { heightPoints } = await fetchObservations('X', 24, 0)
    expect(heightPoints).toHaveLength(1)
  })

  it('borne la fenêtre haute en mode historique', async () => {
    server.use(
      http.get(OBS_URL, () =>
        HttpResponse.json({
          data: [obs('2026-01-01T11:00:00Z', 'H', 1500), obs('2025-12-31T06:00:00Z', 'H', 1400)],
          next: null,
        }),
      ),
    )
    const { heightPoints } = await fetchObservations('X', 24, 1)
    expect(heightPoints.map((p) => p.y)).toEqual([1.4])
  })

  it('suit la pagination par curseur', async () => {
    const page2 = `${OBS_URL}?page=2`
    server.use(
      http.get(OBS_URL, ({ request }) => {
        if (new URL(request.url).searchParams.get('page') === '2')
          return HttpResponse.json({ data: [obs('2026-01-01T09:00:00Z', 'H', 1300)], next: null })
        return HttpResponse.json({ data: [obs('2026-01-01T11:00:00Z', 'H', 1500)], next: page2 })
      }),
    )
    const { heightPoints } = await fetchObservations('X', 24, 0)
    expect(heightPoints.map((p) => p.y)).toEqual([1.3, 1.5])
  })

  it('arrête la pagination dès que le début de fenêtre est couvert', async () => {
    let calls = 0
    server.use(
      http.get(OBS_URL, () => {
        calls++
        return HttpResponse.json({
          data: [obs('2025-12-31T11:00:00Z', 'H', 1500)],
          next: `${OBS_URL}?page=99`,
        })
      }),
    )
    await fetchObservations('X', 24, 0)
    expect(calls).toBe(1)
  })

  it('plafonne le nombre de pages', async () => {
    let calls = 0
    server.use(
      http.get(OBS_URL, () => {
        calls++
        return HttpResponse.json({
          data: [obs('2026-01-01T11:00:00Z', 'H', 1500)],
          next: `${OBS_URL}?page=${calls}`,
        })
      }),
    )
    await fetchObservations('X', 24, 0)
    expect(calls).toBe(12)
  })

  it('remonte une erreur explicite sur un échec HTTP', async () => {
    server.use(http.get(OBS_URL, () => new HttpResponse(null, { status: 503 })))
    await expect(fetchObservations('X', 24, 0)).rejects.toThrow(/503.*observations/)
  })

  it('remonte une erreur sur une réponse illisible', async () => {
    server.use(http.get(OBS_URL, () => new HttpResponse('pas du json', { status: 200 })))
    await expect(fetchObservations('X', 24, 0)).rejects.toThrow(/JSON invalide/)
  })
})
