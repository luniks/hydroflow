import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MetricValue from './MetricValue.vue'
import TrendIndicator from './TrendIndicator.vue'
import BaseBadge from '../ui/BaseBadge.vue'

describe('TrendIndicator', () => {
  it('ne rend rien sans tendance', () => {
    expect(mount(TrendIndicator, { props: { trend: null, unit: 'm/h' } }).html()).toBe('<!--v-if-->')
  })

  it('signale une hausse comme une alerte', () => {
    const wrapper = mount(TrendIndicator, {
      props: { trend: { dir: 'up', ratePerHour: 0.5 }, unit: 'm/h' },
    })
    expect(wrapper.classes()).toContain('trend--alert')
    expect(wrapper.text()).toContain('▲')
    expect(wrapper.text()).toContain('+0.50 m/h')
  })

  it('signale une baisse favorablement et un palier en neutre', () => {
    const down = mount(TrendIndicator, {
      props: { trend: { dir: 'down', ratePerHour: -0.2 }, unit: 'm/h' },
    })
    expect(down.classes()).toContain('trend--ok')
    expect(down.text()).toContain('▼')

    const flat = mount(TrendIndicator, {
      props: { trend: { dir: 'flat', ratePerHour: 0 }, unit: 'm/h' },
    })
    expect(flat.classes()).toContain('trend--neutral')
  })

  it('privilégie le taux converti quand il est fourni', () => {
    const wrapper = mount(TrendIndicator, {
      props: { trend: { dir: 'up', ratePerHour: 0.005 }, unit: 'cm/h', rate: 0.5 },
    })
    expect(wrapper.text()).toContain('+0.50 cm/h')
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

  it('transmet la tendance à l’indicateur', () => {
    const wrapper = mount(MetricValue, {
      props: {
        label: 'Niveau',
        value: '1',
        unit: 'm',
        trend: { dir: 'up', ratePerHour: 1 },
        trendUnit: 'cm/h',
      },
    })
    expect(wrapper.findComponent(TrendIndicator).text()).toContain('cm/h')
  })
})
