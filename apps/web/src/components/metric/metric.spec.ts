import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MetricValue from './MetricValue.vue'
import TrendIndicator from './TrendIndicator.vue'
import BaseBadge from '../ui/BaseBadge.vue'
import type { StationLine } from '@/domain/stationTrend'

const line = (tone: StationLine['tone'], text = '▲ +0.50 m/h'): StationLine => ({
  arrow: '▲',
  text,
  title: 'Phrase complète pour l’infobulle',
  tone,
})

describe('TrendIndicator', () => {
  it('ne rend rien sans ligne', () => {
    expect(mount(TrendIndicator, { props: { line: null } }).html()).toBe('<!--v-if-->')
  })

  it('affiche le texte sur une ligne, avec la phrase complète en infobulle', () => {
    const wrapper = mount(TrendIndicator, { props: { line: line('neutral') } })
    expect(wrapper.text()).toBe('▲ +0.50 m/h')
    expect(wrapper.attributes('title')).toBe('Phrase complète pour l’infobulle')
  })

  it('colore selon le ton : bonne nouvelle, à surveiller, neutre', () => {
    expect(mount(TrendIndicator, { props: { line: line('ok') } }).classes()).toContain('trend--ok')
    expect(mount(TrendIndicator, { props: { line: line('warn') } }).classes()).toContain('trend--warn')
    expect(mount(TrendIndicator, { props: { line: line('neutral') } }).classes()).toContain('trend--neutral')
  })
})

describe('MetricValue', () => {
  it('affiche la valeur et son unité', () => {
    const wrapper = mount(MetricValue, {
      props: { label: 'Niveau moyen', value: '2.34', unit: 'm' },
    })
    expect(wrapper.find('.metric__label').text()).toContain('Niveau moyen')
    expect(wrapper.find('.metric__number').text()).toBe('2.34')
    expect(wrapper.find('.metric__unit').text()).toBe('m')
  })

  it('affiche un tiret sans unité quand la valeur manque', () => {
    const wrapper = mount(MetricValue, { props: { label: 'Débit', value: null, unit: 'm³/s' } })
    expect(wrapper.find('.metric__number').text()).toBe('—')
    expect(wrapper.find('.metric__unit').exists()).toBe(false)
  })

  it('n’affiche un badge que hors de la plage normale', () => {
    const high = mount(MetricValue, {
      props: { label: 'Niveau', value: '5', unit: 'm', status: 'high' },
    })
    expect(high.findComponent(BaseBadge).text()).toBe('Haut')
    expect(high.findComponent(BaseBadge).classes()).toContain('ui-badge--warn')

    const low = mount(MetricValue, {
      props: { label: 'Niveau', value: '0.1', unit: 'm', status: 'low' },
    })
    expect(low.findComponent(BaseBadge).text()).toBe('Bas')

    const ok = mount(MetricValue, {
      props: { label: 'Niveau', value: '1', unit: 'm', status: 'ok' },
    })
    expect(ok.findComponent(BaseBadge).exists()).toBe(false)
  })

  it('transmet la ligne de tendance à l’indicateur', () => {
    const wrapper = mount(MetricValue, {
      props: { label: 'Niveau', value: '1', unit: 'm', line: line('warn', '▲ Haut ~40 min') },
    })
    expect(wrapper.findComponent(TrendIndicator).text()).toBe('▲ Haut ~40 min')
  })

  it('explique le badge par une infobulle', () => {
    const wrapper = mount(MetricValue, {
      props: { label: 'Débit', value: '25', unit: 'm³/s', status: 'high', statusTitle: 'Dernière mesure 25 m³/s' },
    })
    expect(wrapper.findComponent(BaseBadge).attributes('title')).toBe('Dernière mesure 25 m³/s')
  })
})
