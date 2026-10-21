import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VigicruesBanner from './VigicruesBanner.vue'
import ApiStatusIndicator from './ApiStatusIndicator.vue'
import { VIGICRUES_LEVELS } from '@/api/vigicrues'
import { useApiHealth } from '@/composables/useApiHealth'
import { useDataLoader } from '@/composables/useDataLoader'
import { useStations } from '@/composables/useStations'
import { useTimeRange } from '@/composables/useTimeRange'

describe('VigicruesBanner', () => {
  const info = {
    name: 'Agout aval',
    levelCode: 3,
    level: VIGICRUES_LEVELS[3]!,
    parentCode: '25',
    stale: false,
  }

  it('signale l’indisponibilité quand aucune information n’est connue', () => {
    const wrapper = mount(VigicruesBanner, { props: { info: null } })
    expect(wrapper.find('.vigicrues-banner').classes()).toContain('vigicrues-banner--unknown')
    expect(wrapper.text()).toContain('indisponible')
  })

  it('reprend la couleur et le libellé du niveau de vigilance', () => {
    const wrapper = mount(VigicruesBanner, { props: { info } })
    expect(wrapper.find('.vigicrues-banner').classes()).toContain('vigicrues-banner--orange')
    expect(wrapper.text()).toContain('Agout aval')
  })

  it('mentionne les données issues du cache du proxy', () => {
    const fresh = mount(VigicruesBanner, { props: { info } })
    expect(fresh.find('.vigicrues-banner__stale').exists()).toBe(false)

    const stale = mount(VigicruesBanner, { props: { info: { ...info, stale: true } } })
    expect(stale.find('.vigicrues-banner__stale').text()).toContain('cache')
  })

  it('pointe vers le bassin Vigicrues en lien externe sécurisé', () => {
    const link = mount(VigicruesBanner, { props: { info } }).find('a')
    expect(link.attributes('href')).toContain('CdEntVigiCru=25')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })
})

describe('ApiStatusIndicator', () => {
  it('agrège l’état des trois sources', async () => {
    const api = useApiHealth()
    api.set('hubeau', 'ok', 'Stations à jour.')
    api.set('meteo', 'ok', 'Points à jour.')
    api.set('vigicrues', 'err', 'Proxy injoignable.')

    const wrapper = mount(ApiStatusIndicator)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.api-dot').classes()).toContain('api-dot--warn')

    await wrapper.find('.api-status').trigger('focusin')
    const items = wrapper.findAll('.api-status__list li')
    expect(items).toHaveLength(3)
    expect(items[2]!.text()).toContain('Proxy injoignable.')
    expect(items[2]!.find('.api-dot').classes()).toContain('api-dot--err')
  })

  describe('libellé de mise à jour', () => {
    const loader = useDataLoader()
    const stations = useStations()
    const range = useTimeRange()
    const label = () => mount(ApiStatusIndicator).find('.app-header__update').text()

    beforeEach(() => {
      stations.reset()
      loader.lastUpdate.value = null
      range.offsetSteps.value = 0
    })

    it('annonce l’absence de données quand rien n’a pu être chargé', () => {
      expect(label()).toBe('Aucune donnée récupérée')
    })

    it('annonce la récupération en cours pendant le tout premier chargement', async () => {
      loader.loading.value = true
      expect(label()).toBe('Récupération des données en cours')
      loader.loading.value = false
    })

    it('donne l’heure de mise à jour', () => {
      const updated = new Date('2026-01-01T12:00:00Z')
      loader.lastUpdate.value = updated
      const at = (agoMin: number) => ({ t: new Date(updated.getTime() - agoMin * 60_000).toISOString(), y: 1 })
      stations.stateOf('O469251003').flowPoints = [at(10)]
      stations.stateOf('O480252002').points = [at(185)]

      expect(label()).toContain('Dernière mise à jour')
    })
  })
})
