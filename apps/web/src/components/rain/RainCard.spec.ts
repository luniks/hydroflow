import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RainCard from './RainCard.vue'
import RainBarsChart from '../charts/RainBarsChart.vue'
import MetricValue from '../metric/MetricValue.vue'
import BaseBadge from '../ui/BaseBadge.vue'
import type { RainPoint, RainState } from '@/domain/types'

const nowMs = Date.UTC(2026, 9, 1, 12)

const point: RainPoint = {
  key: 'castres',
  origin: 'external',
  label: 'Amont',
  name: 'Castres',
  context: 'Bassin amont',
  lat: 43.6,
  lon: 2.24,
  storagePrefix: 'rain_castres_',
  defaultThreshold: 30,
}

function makeState(overrides: Partial<RainState> = {}): RainState {
  return {
    times: [
      '2026-10-01T06:00:00Z',
      '2026-10-01T11:00:00Z',
      '2026-10-01T14:00:00Z',
      '2026-10-01T20:00:00Z',
    ],
    values: [4, 6, 3, 2],
    threshold: 30,
    alertThreshold: 45,
    error: null,
    fetching: false,
    ...overrides,
  }
}

const factory = (state: RainState = makeState()) =>
  mount(RainCard, { props: { point, state, nowMs } })

describe('RainCard', () => {
  it('affiche le nom et le contexte du point', () => {
    const wrapper = factory()
    expect(wrapper.find('.rain-card__title').text()).toBe('Castres')
    expect(wrapper.find('.rain-card__context').text()).toBe('Bassin amont')
  })

  it('sépare le cumul tombé du cumul prévu sur l’horizon du point', () => {
    const metrics = factory().findAllComponents(MetricValue)
    expect(metrics[0]!.props('label')).toBe('Tombé (24 h)')
    expect(metrics[0]!.find('.metric__number').text()).toBe('10.0')
    expect(metrics[1]!.props('label')).toBe('Prévu (48 h)')
    expect(metrics[1]!.find('.metric__number').text()).toBe('5.0')
    expect(factory().find('.rain-card__total').text()).toContain('15.0 mm')
  })

  it('n’affiche un badge qu’à partir du seuil de vigilance', () => {
    expect(factory().findComponent(BaseBadge).exists()).toBe(false)

    const warn = factory(makeState({ threshold: 10, alertThreshold: 45 }))
    expect(warn.findComponent(BaseBadge).text()).toBe('Vigilance')

    const alert = factory(makeState({ threshold: 5, alertThreshold: 10 }))
    expect(alert.findComponent(BaseBadge).text()).toBe('Alerte')
  })

  it('affiche l’erreur de récupération', () => {
    const wrapper = factory(makeState({ error: 'Open-Meteo injoignable' }))
    expect(wrapper.find('[role="alert"]').text()).toContain('Open-Meteo injoignable')
  })

  it('demande le rafraîchissement du point', async () => {
    const wrapper = factory()
    await wrapper.find('[aria-label="Rafraîchir ce point"]').trigger('click')
    expect(wrapper.emitted('refresh')).toEqual([[point]])
  })

  it('émet les seuils et la réinitialisation depuis le menu', async () => {
    const wrapper = factory()
    await wrapper.find('[aria-label="Seuils de pluviométrie"]').trigger('click')

    const inputs = wrapper.find('.rain-card__dropdown').findAll('input')
    await inputs[0]!.setValue('25')
    expect(wrapper.emitted('threshold')).toEqual([[point, 25]])

    await inputs[1]!.setValue('60')
    expect(wrapper.emitted('alert')).toEqual([[point, 60]])

    await wrapper.find('.rain-card__dropdown button').trigger('click')
    expect(wrapper.emitted('reset')).toEqual([[point]])
  })

  it('ferme le menu des seuils au clic extérieur', async () => {
    const wrapper = factory()
    await wrapper.find('[aria-label="Seuils de pluviométrie"]').trigger('click')
    expect(wrapper.find('.rain-card__dropdown').exists()).toBe(true)

    document.body.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.rain-card__dropdown').exists()).toBe(false)
  })

  it('cadre le graphique sur 24 h passées et l’horizon de prévision', () => {
    const chart = factory().findComponent(RainBarsChart)
    expect(chart.props('points')).toHaveLength(4)
    expect(nowMs - chart.props('windowStartMs')).toBe(24 * 3_600_000)
    expect(chart.props('windowEndMs') - nowMs).toBe(48 * 3_600_000)
  })
})
