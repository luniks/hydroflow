import { ref, type Ref } from 'vue'
import { nearestPointIndex, tooltipAlignment } from '@/domain/chartScale'
import type { SparklineGeometry } from '@/domain/chartScale'
import type { SeriesPoint } from '@/domain/types'

export interface CrosshairState {
  index: number
  x: number
  y: number
  cssX: number
  cssY: number
  align: 'left' | 'center' | 'right'
  point: SeriesPoint
}

/** Suivi souris/tactile sur un SVG : résout le point le plus proche et sa position écran. */
export function useChartCrosshair(geometry: Ref<SparklineGeometry | null>, points: Ref<SeriesPoint[]>) {
  const state = ref<CrosshairState | null>(null)

  function move(event: MouseEvent | Touch, svg: SVGSVGElement) {
    const geo = geometry.value
    if (!geo || points.value.length === 0) return

    const rect = svg.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    const svgX = ((event.clientX - rect.left) * geo.width) / rect.width
    const plotWidth = geo.width - geo.padLeft - geo.padRight
    const ratio = Math.min(Math.max((svgX - geo.padLeft) / plotWidth, 0), 1)
    const targetMs = geo.windowStartMs + ratio * geo.windowMs

    const index = nearestPointIndex(points.value, targetMs)
    if (index < 0) return

    const coord = geo.coords[index]
    const point = points.value[index]
    if (!coord || !point) return

    const cssX = (coord[0] * rect.width) / geo.width
    const cssY = (coord[1] * rect.height) / geo.height

    state.value = {
      index,
      x: coord[0],
      y: coord[1],
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
