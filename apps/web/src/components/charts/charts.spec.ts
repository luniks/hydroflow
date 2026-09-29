import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SparklineChart from './SparklineChart.vue'
import RainBarsChart from './RainBarsChart.vue'
import ChartEmpty from './ChartEmpty.vue'
import type { SeriesPoint } from '@/domain/types'

const windowStart = new Date('2026-10-01T00:00:00Z')
const windowEnd = new Date('2026-10-01T04:00:00Z')

const points: SeriesPoint[] = [
  { t: '2026-10-01T00:00:00Z', y: 1 },
  { t: '2026-10-01T02:00:00Z', y: 3 },
  { t: '2026-10-01T04:00:00Z', y: 2 },
]

/** jsdom ne calcule aucune géométrie : on simule la boîte du SVG. */
function stubSvgRect(wrapper: ReturnType<typeof mount>, width = 600, height = 122) {
  const svg = wrapper.find('svg').element
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }) as DOMRect
  return svg
}

describe('SparklineChart', () => {
  it('affiche un message quand la série est insuffisante', () => {
    const wrapper = mount(SparklineChart, {
      props: { points: [], windowStart, windowEnd, emptyLabel: 'Rien à tracer' },
    })
    expect(wrapper.findComponent(ChartEmpty).text()).toBe('Rien à tracer')
    expect(wrapper.find('svg[role="img"]').exists()).toBe(false)
  })

  it('trace la courbe, l’aire et les bornes de l’axe Y', () => {
    const wrapper = mount(SparklineChart, { props: { points, windowStart, windowEnd } })
    const paths = wrapper.findAll('path')
    expect(paths).toHaveLength(2)
    expect(paths[1]!.attributes('d')).toContain('M44.0,98.0')
    const texts = wrapper.findAll('text').map((t) => t.text())
    expect(texts).toContain('3.00')
    expect(texts).toContain('1.00')
  })

  it('rend cinq libellés d’axe X, masqués sur demande', () => {
    const withLabels = mount(SparklineChart, { props: { points, windowStart, windowEnd } })
    expect(withLabels.findAll('.chart__axis--x')).toHaveLength(5)

    const without = mount(SparklineChart, {
      props: { points, windowStart, windowEnd, withXLabels: false },
    })
    expect(without.findAll('.chart__axis--x')).toHaveLength(0)
  })

  it('affiche le réticule et l’infobulle au survol', async () => {
    const wrapper = mount(SparklineChart, {
      props: { points, windowStart, windowEnd, unit: 'm' },
    })
    stubSvgRect(wrapper)

    await wrapper.find('svg').trigger('mousemove', { clientX: 300 })
    const tooltip = wrapper.find('.chart__tooltip')
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.text()).toContain('3.00 m')
    expect(wrapper.find('.chart__crosshair').exists()).toBe(true)

    await wrapper.find('svg').trigger('mouseleave')
    expect(wrapper.find('.chart__tooltip').exists()).toBe(false)
  })

  it('aligne l’infobulle sur les bords du graphique', async () => {
    const wrapper = mount(SparklineChart, { props: { points, windowStart, windowEnd } })
    stubSvgRect(wrapper)

    await wrapper.find('svg').trigger('mousemove', { clientX: 0 })
    expect(wrapper.find('.chart__tooltip').classes()).toContain('is-align-left')

    await wrapper.find('svg').trigger('mousemove', { clientX: 600 })
    expect(wrapper.find('.chart__tooltip').classes()).toContain('is-align-right')
  })

  it('ajoute la mesure associée quand elle est contemporaine', async () => {
    const companion = {
      label: 'Débit',
      unit: 'm³/s',
      points: [{ t: '2026-10-01T02:00:00Z', y: 12 }],
    }
    const wrapper = mount(SparklineChart, {
      props: { points, windowStart, windowEnd, unit: 'm', companion },
    })
    stubSvgRect(wrapper)

    await wrapper.find('svg').trigger('mousemove', { clientX: 300 })
    expect(wrapper.find('.chart__tooltip-companion').text()).toBe('Débit : 12.00 m³/s')
  })

  it('ignore une mesure associée trop éloignée dans le temps', async () => {
    const companion = {
      label: 'Débit',
      unit: 'm³/s',
      points: [{ t: '2026-10-01T22:00:00Z', y: 12 }],
    }
    const wrapper = mount(SparklineChart, {
      props: { points, windowStart, windowEnd, companion },
    })
    stubSvgRect(wrapper)

    await wrapper.find('svg').trigger('mousemove', { clientX: 300 })
    expect(wrapper.find('.chart__tooltip-companion').exists()).toBe(false)
  })

  it('gère le tactile et ignore un toucher vide', async () => {
    const wrapper = mount(SparklineChart, { props: { points, windowStart, windowEnd } })
    stubSvgRect(wrapper)

    await wrapper.find('svg').trigger('touchstart', { touches: [] })
    expect(wrapper.find('.chart__tooltip').exists()).toBe(false)

    await wrapper.find('svg').trigger('touchmove', { touches: [{ clientX: 300, clientY: 20 }] })
    expect(wrapper.find('.chart__tooltip').exists()).toBe(true)

    await wrapper.find('svg').trigger('touchend')
    expect(wrapper.find('.chart__tooltip').exists()).toBe(false)
  })

  it('reste silencieux si le SVG n’a aucune dimension', async () => {
    const wrapper = mount(SparklineChart, { props: { points, windowStart, windowEnd } })
    stubSvgRect(wrapper, 0, 0)
    await wrapper.find('svg').trigger('mousemove', { clientX: 10 })
    expect(wrapper.find('.chart__tooltip').exists()).toBe(false)
  })
})

describe('RainBarsChart', () => {
  const windowStartMs = Date.UTC(2026, 9, 1, 0)
  const windowEndMs = Date.UTC(2026, 9, 1, 4)
  const nowMs = Date.UTC(2026, 9, 1, 2)

  const rain: SeriesPoint[] = [
    { t: '2026-10-01T00:00:00Z', y: 2 },
    { t: '2026-10-01T01:00:00Z', y: 0 },
    { t: '2026-10-01T03:00:00Z', y: 10 },
  ]

  it('affiche un message quand la série est insuffisante', () => {
    const wrapper = mount(RainBarsChart, {
      props: { points: [], windowStartMs, windowEndMs, nowMs },
    })
    expect(wrapper.findComponent(ChartEmpty).exists()).toBe(true)
  })

  it('ne dessine que les barres de cumul non nul', () => {
    const wrapper = mount(RainBarsChart, {
      props: { points: rain, windowStartMs, windowEndMs, nowMs },
    })
    const rects = wrapper.findAll('rect')
    expect(rects).toHaveLength(2)
    expect(rects[0]!.attributes('fill')).toBe('var(--rain)')
    expect(rects[1]!.attributes('fill')).toBe('var(--rain-far)')
  })

  it('trace le repère « maintenant » seulement dans la fenêtre', () => {
    const inside = mount(RainBarsChart, {
      props: { points: rain, windowStartMs, windowEndMs, nowMs },
    })
    expect(inside.find('.rain-bars__now').exists()).toBe(true)

    const outside = mount(RainBarsChart, {
      props: { points: rain, windowStartMs, windowEndMs, nowMs: windowEndMs + 3_600_000 },
    })
    expect(outside.find('.rain-bars__now').exists()).toBe(false)
  })
})
