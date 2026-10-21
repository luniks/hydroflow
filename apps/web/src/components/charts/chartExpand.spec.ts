import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import ChartExpand from './ChartExpand.vue'
import SparklineChart from './SparklineChart.vue'
import RainBarsChart from './RainBarsChart.vue'
import type { SeriesPoint } from '@/domain/types'

beforeAll(() => {
  // jsdom n'implémente pas <dialog>.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 })
})

afterEach(() => {
  document.body.innerHTML = ''
})

const points: SeriesPoint[] = [
  { t: '2026-10-01T00:00:00Z', y: 1 },
  { t: '2026-10-01T02:00:00Z', y: 3 },
  { t: '2026-10-01T04:00:00Z', y: 2 },
]

describe('ChartExpand', () => {
  function mountExpand() {
    return mount(ChartExpand, {
      props: { title: 'Station', subtitle: 'Détail' },
      slots: { default: (p: { width: number; height: number }) => h('i', { class: 'probe' }, `${p.width}x${p.height}`) },
      attachTo: document.body,
    })
  }

  it('ouvre la modale avec titre, sous-titre et dimensions mesurées, puis la ferme', async () => {
    const wrapper = mountExpand()
    expect(wrapper.find('dialog').exists()).toBe(false)

    await wrapper.find('button.chart__expand').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('h2').text()).toBe('Station')
    expect(wrapper.find('.chart__dialog-head p').text()).toBe('Détail')
    expect(wrapper.find('.probe').text()).toBe('800x400')

    await wrapper.find('.chart__expand--static').trigger('click')
    expect(wrapper.find('dialog').exists()).toBe(false)
  })

  it('ferme au clic sur le fond et ne propage pas les clics', async () => {
    const parentClick = vi.fn()
    document.body.addEventListener('click', parentClick)
    const wrapper = mountExpand()
    await wrapper.find('button.chart__expand').trigger('click')
    await wrapper.vm.$nextTick()
    expect(parentClick).not.toHaveBeenCalled()

    await wrapper.find('dialog').trigger('click')
    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(parentClick).not.toHaveBeenCalled()
    document.body.removeEventListener('click', parentClick)
  })

  it('est proposé par les graphiques, sauf si expandable=false', () => {
    const spark = { points, windowStart: new Date(points[0]!.t), windowEnd: new Date(points[2]!.t) }
    expect(mount(SparklineChart, { props: spark }).find('.chart__expand').exists()).toBe(true)
    expect(
      mount(SparklineChart, { props: { ...spark, expandable: false } }).find('.chart__expand').exists(),
    ).toBe(false)
    const rain = { points, windowStartMs: 0, windowEndMs: 1, nowMs: 0 }
    expect(mount(RainBarsChart, { props: { ...rain, windowStartMs: Date.parse(points[0]!.t), windowEndMs: Date.parse(points[2]!.t) } }).find('.chart__expand').exists()).toBe(true)
  })
})
