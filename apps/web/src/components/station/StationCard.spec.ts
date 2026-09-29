import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StationCard from './StationCard.vue'
import SparklineChart from '../charts/SparklineChart.vue'
import MetricValue from '../metric/MetricValue.vue'
import BaseBadge from '../ui/BaseBadge.vue'
import { DEFAULT_STATIONS, normThresholds } from '@/domain/constants'
import type { StationState } from '@/domain/types'

const station = DEFAULT_STATIONS[0]!

function makeState(overrides: Partial<StationState> = {}): StationState {
  return {
    points: [
      { t: '2026-10-01T00:00:00Z', y: 1 },
      { t: '2026-10-01T02:00:00Z', y: 1.4 },
    ],
    flowPoints: [
      { t: '2026-10-01T00:00:00Z', y: 10 },
      { t: '2026-10-01T02:00:00Z', y: 12 },
    ],
    name: 'Vielmur-sur-Agout',
    river: 'Agout',
    error: null,
    fetching: false,
    ...overrides,
  }
}

function factory(state: StationState = makeState(), isReference = false) {
  return mount(StationCard, {
    props: {
      station,
      state,
      thresholds: normThresholds(),
      window: {
        dateDebut: new Date('2026-10-01T00:00:00Z'),
        dateFin: new Date('2026-10-01T04:00:00Z'),
      },
      hours: 24,
      isReference,
    },
  })
}

describe('StationCard', () => {
  it('affiche le nom résolu par l’API et la rivière', () => {
    const wrapper = factory()
    expect(wrapper.find('.card__title').text()).toBe('Vielmur-sur-Agout')
    expect(wrapper.find('.card__subtitle').text()).toContain(station.label)
    expect(wrapper.find('.card__subtitle').text()).toContain(station.code)
  })

  it('retombe sur le nom de secours quand l’API n’a rien renvoyé', () => {
    const wrapper = factory(makeState({ name: null, river: null }))
    expect(wrapper.find('.card__title').text()).toBe(station.fallbackName)
  })

  it('affiche le débit moyen et le niveau moyen quand les deux sont disponibles', () => {
    const metrics = factory().findAllComponents(MetricValue)
    expect(metrics).toHaveLength(2)
    expect(metrics[0]!.props('label')).toBe('Débit moyen')
    expect(metrics[0]!.find('.metric__number').text()).toBe('11')
  })

  it('affiche le niveau moyen si aucun débit n’est disponible', () => {
    const metrics = factory(makeState({ flowPoints: [] })).findAllComponents(MetricValue)
    expect(metrics).toHaveLength(1)
    expect(metrics[0]!.props('label')).toBe('Niveau moyen')
    expect(metrics[0]!.find('.metric__number').text()).toBe('1.20')
  })

  it('signale le badge de référence uniquement pour la station pilote', () => {
    expect(factory().findComponent(BaseBadge).exists()).toBe(false)
    expect(factory(makeState(), true).findComponent(BaseBadge).text()).toContain('Référence')
  })

  it('affiche l’erreur de chargement en alerte', () => {
    const wrapper = factory(makeState({ error: 'Service indisponible' }))
    expect(wrapper.find('[role="alert"]').text()).toContain('Service indisponible')
  })

  it('demande le rafraîchissement et le désactive pendant le chargement', async () => {
    const wrapper = factory()
    await wrapper.find('[aria-label="Rafraîchir cette station"]').trigger('click')
    expect(wrapper.emitted('refresh')).toEqual([[station.code]])

    const busy = factory(makeState({ fetching: true }))
    expect(busy.find('[aria-label="Rafraîchir cette station"]').attributes('disabled')).toBeDefined()
    expect(busy.find('[role="status"]').exists()).toBe(true)
  })

  it('ouvre le menu des seuils de débit et émet la mise à jour quand le débit est disponible', async () => {
    const wrapper = factory()
    expect(wrapper.find('.card__dropdown').exists()).toBe(false)

    await wrapper.find('[aria-label="Réglages des seuils"]').trigger('click')
    const dropdown = wrapper.find('.card__dropdown')
    expect(dropdown.find('.card__dropdown-title').text()).toBe('Seuils de débit')
    const inputs = dropdown.findAll('input')
    expect(inputs).toHaveLength(2)

    await inputs[1]!.setValue('25')
    expect(wrapper.emitted('update:thresholds')).toEqual([
      [station.code, { level: { low: 0.5, high: 2.5 }, flow: { low: 5, high: 25 } }],
    ])
  })

  it('bascule sur les seuils de niveau quand aucun débit n’est disponible', async () => {
    const wrapper = factory(makeState({ flowPoints: [] }))
    await wrapper.find('[aria-label="Réglages des seuils"]').trigger('click')
    const dropdown = wrapper.find('.card__dropdown')
    expect(dropdown.find('.card__dropdown-title').text()).toBe('Seuils de niveau')

    const inputs = dropdown.findAll('input')
    await inputs[1]!.setValue('3')
    expect(wrapper.emitted('update:thresholds')).toEqual([
      [station.code, { level: { low: 0.5, high: 3 }, flow: { low: 5, high: 20 } }],
    ])
  })

  it('ferme le menu des seuils au clic extérieur', async () => {
    const wrapper = factory()
    await wrapper.find('[aria-label="Réglages des seuils"]').trigger('click')
    expect(wrapper.find('.card__dropdown').exists()).toBe(true)

    document.body.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.card__dropdown').exists()).toBe(false)
  })

  it('affiche le débit en série principale et le niveau en compagnon quand le débit est disponible', () => {
    const chart = factory().findComponent(SparklineChart)
    expect(chart.props('points')).toEqual(makeState().flowPoints)
    expect(chart.props('companion')).toMatchObject({ label: 'Niveau', unit: 'm' })

    const alone = factory(makeState({ flowPoints: [] })).findComponent(SparklineChart)
    expect(alone.props('companion')).toBeNull()
  })

  it('résume la dernière mesure et le nombre de points', () => {
    const text = factory().find('.card__meta').text()
    expect(text).toContain('Dernière mesure')
    expect(text).toContain('2 mesures — 24 h')
  })
})
