import { ref, type Ref } from 'vue'
import { nearestByTime, tooltipAlignment } from '@/domain/chartScale'
import type { RainBarsGeometry } from '@/domain/chartScale'
import type { SeriesPoint } from '@/domain/types'

export interface RainHoverState {
  bandX: number
  bandWidth: number
  cssX: number
  cssY: number
  align: 'left' | 'center' | 'right'
  point: SeriesPoint
}

/** Survol du graphe de pluie : se cale sur l'heure la plus proche (comme la legacy setupRainHover). */
export function useRainHover(geometry: Ref<RainBarsGeometry | null>, points: Ref<SeriesPoint[]>) {
  const state = ref<RainHoverState | null>(null)

  function move(event: MouseEvent | Touch, svg: SVGSVGElement) {
    const geo = geometry.value
    if (!geo || points.value.length === 0) return

    const rect = svg.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    const scaleX = geo.width / rect.width
    const scaleY = geo.height / rect.height
    const svgX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width) * scaleX
    const plotWidth = geo.width - geo.padLeft - geo.padRight
    const targetMs = geo.windowStartMs + ((svgX - geo.padLeft) / plotWidth) * geo.windowMs

    const point = nearestByTime(points.value, targetMs)
    if (!point) return

    const pointMs = new Date(point.t).getTime()
    const cx = geo.padLeft + ((pointMs - geo.windowStartMs) / geo.windowMs) * plotWidth
    const max = geo.max
    const barTopY = geo.plotBottom - (point.y / max) * (geo.plotBottom - geo.plotTop)

    const cssX = cx / scaleX
    const cssY = Math.min(barTopY, geo.plotBottom - 6) / scaleY

    state.value = {
      bandX: cx - geo.slotWidth / 2,
      bandWidth: geo.slotWidth,
      cssX,
      cssY,
      align: tooltipAlignment(cssX, rect.width),
      point,
    }
  }

  function onMouseMove(event: MouseEvent) {
    move(event, event.currentTarget as SVGSVGElement)
  }

  function onTouch(event: TouchEvent) {
    const touch = event.touches[0]
    if (!touch) return
    event.preventDefault()
    move(touch, event.currentTarget as SVGSVGElement)
  }

  function hide() {
    state.value = null
  }

  return { state, onMouseMove, onTouch, hide }
}
