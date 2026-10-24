import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StationCard from './StationCard.vue'
import SparklineChart from '../charts/SparklineChart.vue'
import MetricValue from '../metric/MetricValue.vue'
import BaseBadge from '../ui/BaseBadge.vue'
import { DEFAULT_STATIONS, EXPLOIT_DEFAULTS, normThresholds } from '@/domain/constants'
import type { StationState, TimeWindow } from '@/domain/types'

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

const ENDED: TimeWindow = {
  dateDebut: new Date('2026-10-01T00:00:00Z'),
  dateFin: new Date('2026-10-01T04:00:00Z'),
}
const LIVE: TimeWindow = { dateDebut: new Date('2026-10-01T00:00:00Z'), dateFin: null }
const NOW = Date.parse('2026-10-01T04:00:00Z')

function factory(
  state: StationState = makeState(),
  isReference = false,
  extra: { window?: TimeWindow; nowMs?: number } = {},
) {
  return mount(StationCard, {
    props: {
      station,
      state,
      thresholds: normThresholds(),
      window: extra.window ?? ENDED,
      hours: 24,
      isReference,
      exploit: EXPLOIT_DEFAULTS,
      nowMs: extra.nowMs ?? NOW,
    },
  })
}

/** Debit ou niveau reliant deux mesures a 1 h d'ecart : pente de +(b - a) par heure. */
const rising = (a: number, b: number) => [
  { t: '2026-10-01T00:00:00Z', y: a },
  { t: '2026-10-01T01:00:00Z', y: b },
]
const flowLine = (wrapper: ReturnType<typeof factory>) => wrapper.findAllComponents(MetricValue)[0]!.props('line')!

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

  it('demande le rafraîchissement et le masque pendant le chargement', async () => {
    const wrapper = factory()
    await wrapper.find('[aria-label="Rafraîchir cette station"]').trigger('click')
    expect(wrapper.emitted('refresh')).toEqual([[station.code]])

    const busy = factory(makeState({ fetching: true }))
    expect(busy.find('[aria-label="Rafraîchir cette station"]').exists()).toBe(false)
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

  describe('ligne de tendance', () => {
    it('donne la pente quand aucun seuil n’est proche', () => {
      // 10 -> 12 m³/s en 2 h : +1 m³/s/h, le seuil haut (20) est a 8 h
      expect(flowLine(factory())).toMatchObject({ text: '▲ +1.00 m³/s/h', tone: 'neutral' })
    })

    it('annonce le prochain seuil de la station avec son délai', () => {
      const wrapper = factory(makeState({ flowPoints: rising(10, 17) }))
      expect(flowLine(wrapper)).toMatchObject({ text: '▲ Haut ~26 min', tone: 'warn' })
    })

    it('station de référence : reprend les zones d’exploitation (entrée en zone optimale)', () => {
      const wrapper = factory(makeState({ flowPoints: rising(30, 40) }), true)
      expect(flowLine(wrapper)).toMatchObject({ text: '▲ Optimale ~30 min', tone: 'ok' })
    })

    it('mesure principale = niveau quand il n’y a pas de débit : seuils de niveau', () => {
      // +0,35 m/h : le seuil haut de niveau (2,5 m) est franchi dans 25,7 min, soit a la 26e minute
      const wrapper = factory(makeState({ flowPoints: [], points: rising(2, 2.35) }))
      expect(wrapper.findAllComponents(MetricValue)[0]!.props('line')).toMatchObject({ text: '▲ Haut ~26 min' })
    })

    it('le niveau secondaire reste une ligne simple, en cm/h', () => {
      const wrapper = factory(makeState({ points: rising(1, 1.4) }))
      expect(wrapper.findAllComponents(MetricValue)[1]!.props('line')).toMatchObject({ text: '▲ +40.00 cm/h' })
    })

    it('signale l’âge d’une dernière mesure ancienne en direct, pas en navigation dans le passé', () => {
      const state = makeState({ flowPoints: rising(10, 12) }) // dernière mesure à 01:00
      const live = factory(state, false, { window: LIVE, nowMs: Date.parse('2026-10-01T02:20:00Z') })
      expect(flowLine(live).text).toBe('▲ +2.00 m³/s/h · 1 h 20')
      expect(flowLine(factory(state, false, { nowMs: Date.parse('2026-10-01T02:20:00Z') })).text).toBe('▲ +2.00 m³/s/h')
    })

    it('ne signale rien pour une mesure récente', () => {
      const live = factory(makeState({ flowPoints: rising(10, 12) }), false, {
        window: LIVE,
        nowMs: Date.parse('2026-10-01T01:10:00Z'),
      })
      expect(flowLine(live).text).toBe('▲ +2.00 m³/s/h')
    })
  })

  describe('badge « Bas / Haut »', () => {
    it('porte sur la dernière valeur, pas sur la moyenne', () => {
      // moyenne 13,5 m³/s (dans la plage), mais dernière valeur 25 m³/s (au-dessus du seuil haut de 20)
      const metric = factory(makeState({ flowPoints: rising(2, 25) })).findAllComponents(MetricValue)[0]!
      expect(metric.props('status')).toBe('high')
      expect(metric.props('statusTitle')).toBe('Dernière mesure 25 m³/s : au-dessus du seuil')
    })

    it('signale une dernière valeur sous le seuil bas', () => {
      const metric = factory(makeState({ flowPoints: rising(10, 3) })).findAllComponents(MetricValue)[0]!
      expect(metric.props('status')).toBe('low')
      expect(metric.props('statusTitle')).toContain('en dessous du seuil')
    })

    it('n’affiche rien dans la plage', () => {
      const metric = factory().findAllComponents(MetricValue)[0]!
      expect(metric.props('status')).toBe('ok')
      expect(metric.props('statusTitle')).toBeUndefined()
    })

    it('la station de référence n’en a pas : sa zone est dans le suivi d’exploitation', () => {
      const wrapper = factory(makeState({ flowPoints: rising(2, 25) }), true)
      expect(wrapper.findAllComponents(MetricValue)[0]!.props('status')).toBeNull()
    })

    it('sans débit, porte sur le niveau (dernière valeur)', () => {
      const metric = factory(makeState({ flowPoints: [], points: rising(2, 3) })).findAllComponents(MetricValue)[0]!
      expect(metric.props('status')).toBe('high')
    })
  })

  describe('station de référence : seuils d’exploitation en lecture seule', () => {
    it('affiche les seuils sans champ d’édition, avec un lien vers la configuration', async () => {
      const wrapper = factory(makeState(), true)
      await wrapper.find('[aria-label="Réglages des seuils"]').trigger('click')
      const dropdown = wrapper.find('.card__dropdown')

      expect(dropdown.find('.card__dropdown-title').text()).toBe("Seuils d'exploitation")
      expect(dropdown.findAll('input')).toHaveLength(0)
      const text = dropdown.find('.card__readonly').text()
      expect(text).toContain('20 m³/s')
      expect(text).toContain('30 m³/s')
      expect(text).toContain('45 – 135 m³/s')
      expect(text).toContain('150 m³/s')
      expect(text).toContain(`${EXPLOIT_DEFAULTS.propagationMin} min`)
    })

    it('ouvre l’onglet des seuils d’exploitation et referme le menu', async () => {
      const wrapper = factory(makeState(), true)
      await wrapper.find('[aria-label="Réglages des seuils"]').trigger('click')
      await wrapper.find('.card__link').trigger('click')

      expect(wrapper.emitted('openConfig')).toEqual([['seuils']])
      expect(wrapper.find('.card__dropdown').exists()).toBe(false)
    })
  })
})
