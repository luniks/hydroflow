import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from './App.vue'
import { config } from '@/config/env'
import { useExploit } from '@/composables/useExploit'
import { useRain } from '@/composables/useRain'
import { useStations } from '@/composables/useStations'
import { useTimeRange } from '@/composables/useTimeRange'
import { server } from '@/test/msw/server'
import ConfigModal from '@/components/config/ConfigModal.vue'
import StationGrid from '@/components/station/StationGrid.vue'

const stations = useStations()
const exploit = useExploit()
const rain = useRain()
const timeRange = useTimeRange()

const mounted: VueWrapper[] = []

function factory() {
  const wrapper = mount(App, { attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}

beforeEach(async () => {
  for (const w of mounted.splice(0)) w.unmount()
  document.body.innerHTML = ''
  stations.reset()
  exploit.reset()
  rain.resetExternal()
  rain.hiddenKeys.value = []
  timeRange.setHours(24)
  await nextTick()
})

describe('App', () => {
  it('rend les sections principales', async () => {
    const wrapper = factory()
    await flushPromises()

    expect(wrapper.find('.app-header__title').text()).toBe('Monitoring St-Jean-de-Rives')
    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.find('.exploit').exists()).toBe(true)
    expect(wrapper.find('.station-grid').exists()).toBe(true)
    expect(wrapper.find('.rain').exists()).toBe(true)
    expect(wrapper.find('.app-footer').exists()).toBe(true)
  })

  it('charge les données au montage et horodate la mise à jour', async () => {
    const wrapper = factory()
    await flushPromises()

    expect(wrapper.find('.app-header__update').text()).not.toContain('Jamais chargé')
    expect(wrapper.findAllComponents({ name: 'StationCard' })).toHaveLength(3)
  })

  it('affiche une carte par station suivie', async () => {
    const wrapper = factory()
    await flushPromises()
    expect(wrapper.findComponent(StationGrid).findAll('.card__title').length).toBe(3)
  })

  it('recharge les séries quand la période change', async () => {
    factory()
    await flushPromises()

    const spy = vi.fn()
    server.use(
      http.get(`${config.hubeauUrl}/observations_tr`, () => {
        spy()
        return HttpResponse.json({ data: [], next: null })
      }),
    )

    timeRange.setHours(72)
    await flushPromises()

    expect(spy).toHaveBeenCalled()
  })

  it('ouvre la modale de configuration depuis la barre d’outils', async () => {
    const wrapper = factory()
    await flushPromises()

    expect(wrapper.findComponent(ConfigModal).props('open')).toBe(false)
    await wrapper.find('[aria-label="Configuration"]').trigger('click')

    expect(wrapper.findComponent(ConfigModal).props('open')).toBe(true)
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('dégrade proprement quand les API sont en erreur', async () => {
    server.use(
      http.get(`${config.hubeauUrl}/observations_tr`, () => HttpResponse.error()),
      http.get(config.openMeteoForecastUrl, () => HttpResponse.error()),
      http.get(config.vigicruesProxyUrl, () => HttpResponse.error()),
    )

    const wrapper = factory()
    await flushPromises()

    expect(wrapper.find('.app').exists()).toBe(true)
    expect(wrapper.findAll('.card__error').length).toBeGreaterThan(0)
  })
})
