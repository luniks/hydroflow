import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { config } from '@/config/env'
import { server } from '@/test/msw/server'
import { bassinUrl, fetchProxyStatus, fetchVigicrues, VIGICRUES_TERRITORY_PARENT } from './vigicrues'

const respond = (properties: Record<string, unknown> | undefined, stale = false) =>
  http.get(config.vigicruesProxyUrl, () => HttpResponse.json({ properties, stale }))

describe('fetchVigicrues', () => {
  it('mappe le code de niveau courant', async () => {
    server.use(respond({ NivInfViCr: 3, lbentcru: 'Agout - Thoré' }))
    const info = await fetchVigicrues()
    expect(info.levelCode).toBe(3)
    expect(info.level).toEqual({ key: 'orange', label: 'Orange — soyez très vigilant' })
    expect(info.name).toBe('Agout - Thoré')
  })

  it('accepte l’ancien nom de champ de niveau', async () => {
    server.use(respond({ NivSituVigiCruEnt: 4 }))
    expect((await fetchVigicrues()).level?.key).toBe('red')
  })

  it('enchaîne les replis sur le libellé du tronçon', async () => {
    server.use(respond({ NivInfViCr: 1, NomEntVigiCru: 'Ancien nom' }))
    expect((await fetchVigicrues()).name).toBe('Ancien nom')

    server.use(respond({ NivInfViCr: 1, LbEntVigiCru: 'Très ancien nom' }))
    expect((await fetchVigicrues()).name).toBe('Très ancien nom')

    server.use(respond({ NivInfViCr: 1 }))
    expect((await fetchVigicrues('TL1')).name).toBe('TL1')
  })

  it('retourne un niveau nul sur un code inconnu', async () => {
    server.use(respond({ NivInfViCr: 9 }))
    const info = await fetchVigicrues()
    expect(info.levelCode).toBe(9)
    expect(info.level).toBeNull()
  })

  it('retourne un code nul quand le niveau est absent', async () => {
    server.use(respond({ lbentcru: 'X' }))
    expect((await fetchVigicrues()).levelCode).toBeNull()
  })

  it('utilise le territoire parent fourni, sinon la valeur par défaut', async () => {
    server.use(respond({ NivInfViCr: 1, cdensup_1: '31' }))
    expect((await fetchVigicrues()).parentCode).toBe('31')

    server.use(respond({ NivInfViCr: 1 }))
    expect((await fetchVigicrues()).parentCode).toBe(VIGICRUES_TERRITORY_PARENT)
  })

  it('signale une réponse servie depuis le cache du proxy', async () => {
    server.use(respond({ NivInfViCr: 1 }, true))
    expect((await fetchVigicrues()).stale).toBe(true)
  })

  it('échoue quand le tronçon est absent de la réponse', async () => {
    server.use(respond(undefined))
    await expect(fetchVigicrues('TL1')).rejects.toThrow(/tronçon TL1 absent/)
  })

  it('remonte l’indisponibilité du proxy', async () => {
    server.use(http.get(config.vigicruesProxyUrl, () => new HttpResponse(null, { status: 502 })))
    await expect(fetchVigicrues()).rejects.toThrow(/HTTP 502/)
  })
})

describe('fetchProxyStatus', () => {
  it('retourne le statut du proxy', async () => {
    expect((await fetchProxyStatus()).status).toBe('ok')
  })
})

describe('bassinUrl', () => {
  it('encode le code de territoire', () => {
    expect(bassinUrl('25')).toContain('CdEntVigiCru=25')
  })
})
