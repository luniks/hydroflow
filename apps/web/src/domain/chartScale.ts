import type { SeriesPoint } from './types'

export interface SparklineOptions {
  width?: number
  height?: number
  withXLabels?: boolean
  windowStart: Date
  windowEnd: Date
}

export interface AxisTick {
  position: number
  label: string
}

export interface SparklineGeometry {
  width: number
  height: number
  padLeft: number
  padRight: number
  plotTop: number
  plotBottom: number
  min: number
  max: number
  range: number
  windowStartMs: number
  windowMs: number
  coords: [number, number][]
  pathD: string
  areaD: string
  lastPoint: [number, number]
  xTicks: AxisTick[]
}

export const SPARKLINE_PAD_LEFT = 44
export const SPARKLINE_PAD_RIGHT = 8
export const SPARKLINE_PLOT_TOP = 10
export const SPARKLINE_TICK_COUNT = 5

/** Formate un repère d'axe X : heure sous 30 h de plage, date au-delà. */
export function formatAxisTick(ms: number, spanHours: number): string {
  const d = new Date(ms)
  return spanHours <= 30
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export function sparklineGeometry(
  points: SeriesPoint[],
  options: SparklineOptions,
): SparklineGeometry | null {
  const { windowStart, windowEnd } = options
  if (points.length < 2) return null

  const width = options.width ?? 600
  const withXLabels = options.withXLabels ?? true
  const height = options.height ?? (withXLabels ? 122 : 92)
  const padLeft = SPARKLINE_PAD_LEFT
  const padRight = SPARKLINE_PAD_RIGHT
  const plotTop = SPARKLINE_PLOT_TOP
  const plotBottom = withXLabels ? height - 24 : height - 10

  const values = points.map((p) => p.y)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const windowStartMs = windowStart.getTime()
  const windowMs = Math.max(windowEnd.getTime() - windowStartMs, 1)
  const plotWidth = width - padLeft - padRight

  const xForTime = (t: string) =>
    padLeft + ((new Date(t).getTime() - windowStartMs) / windowMs) * plotWidth
  const yForValue = (v: number) => plotTop + (plotBottom - plotTop) * (1 - (v - min) / range)

  const coords = points.map((p): [number, number] => [xForTime(p.t), yForValue(p.y)])
  const first = coords[0]!
  const lastPoint = coords[coords.length - 1]!

  const pathD = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`)
    .join(' ')
  const areaD = `${pathD} L${lastPoint[0].toFixed(1)},${plotBottom} L${first[0].toFixed(1)},${plotBottom} Z`

  const spanHours = windowMs / 3_600_000
  const xTicks = Array.from({ length: SPARKLINE_TICK_COUNT }, (_, k) => {
    const ratio = k / (SPARKLINE_TICK_COUNT - 1)
    return {
      position: padLeft + ratio * plotWidth,
      label: formatAxisTick(windowStartMs + ratio * windowMs, spanHours),
    }
  })

  return {
    width,
    height,
    padLeft,
    padRight,
    plotTop,
    plotBottom,
    min,
    max,
    range,
    windowStartMs,
    windowMs,
    coords,
    pathD,
    areaD,
    lastPoint,
    xTicks,
  }
}

/** Index du point dont l'horodatage est le plus proche de `targetMs` (recherche dichotomique). */
export function nearestPointIndex(points: SeriesPoint[], targetMs: number): number {
  if (points.length === 0) return -1
  let lo = 0
  let hi = points.length - 1
  if (targetMs <= new Date(points[0]!.t).getTime()) return 0
  if (targetMs >= new Date(points[hi]!.t).getTime()) return hi

  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const midMs = new Date(points[mid]!.t).getTime()
    if (midMs === targetMs) return mid
    if (midMs < targetMs) lo = mid + 1
    else hi = mid
  }

  const beforeMs = new Date(points[lo - 1]!.t).getTime()
  const currentMs = new Date(points[lo]!.t).getTime()
  return targetMs - beforeMs <= currentMs - targetMs ? lo - 1 : lo
}

/** Alignement de l'infobulle pour qu'elle reste dans le cadre du graphique. */
export function tooltipAlignment(x: number, width: number): 'left' | 'center' | 'right' {
  if (x < width * 0.25) return 'left'
  if (x > width * 0.75) return 'right'
  return 'center'
}

export interface RainBarsOptions {
  width?: number
  height?: number
  windowStartMs: number
  windowEndMs: number
  nowMs: number
}

export interface RainBar {
  x: number
  y: number
  width: number
  height: number
  fill: string
  opacity: number
}

export interface RainBarsGeometry {
  width: number
  height: number
  padLeft: number
  padRight: number
  plotTop: number
  plotBottom: number
  max: number
  bars: RainBar[]
  nowX: number | null
  slotWidth: number
  windowStartMs: number
  windowMs: number
}

export const RAIN_BARS_MIN_SCALE = 4

/** Opacité d'une barre : pleine pour le passé, atténuée au-delà de 24 h de prévision. */
export function rainBarOpacity(tMs: number, nowMs: number): number {
  if (tMs <= nowMs) return 1
  const hoursAhead = (tMs - nowMs) / 3_600_000
  if (hoursAhead <= 24) return 0.85
  return Math.max(0.85 - ((hoursAhead - 24) / 24) * 0.55, 0.25)
}

export function rainBarsGeometry(
  points: SeriesPoint[],
  options: RainBarsOptions,
): RainBarsGeometry | null {
  if (points.length < 2) return null

  const width = options.width ?? 480
  const height = options.height ?? 88
  const padLeft = 4
  const padRight = 4
  const plotTop = 8
  const plotBottom = height - 4
  const plotWidth = width - padLeft - padRight

  const { windowStartMs, windowEndMs, nowMs } = options
  const windowMs = Math.max(windowEndMs - windowStartMs, 1)

  const visible = points
    .map((p) => ({ tMs: new Date(p.t).getTime(), value: p.y }))
    .filter((d) => d.tMs >= windowStartMs && d.tMs <= windowEndMs)

  const max = Math.max(...visible.map((d) => d.value), RAIN_BARS_MIN_SCALE)
  const barSlot = (plotWidth * 3_600_000) / windowMs
  const barWidth = Math.max(barSlot * 0.7, 1)

  const xForMs = (ms: number) => padLeft + ((ms - windowStartMs) / windowMs) * plotWidth

  const bars = visible
    .filter((d) => d.value > 0)
    .map((d) => {
      const y = plotBottom - (d.value / max) * (plotBottom - plotTop)
      return {
        x: xForMs(d.tMs) - barWidth / 2,
        y,
        width: barWidth,
        height: Math.max(plotBottom - y, 1.5),
        fill: d.tMs > nowMs ? 'var(--rain-far)' : 'var(--rain)',
        opacity: rainBarOpacity(d.tMs, nowMs),
      }
    })

  const inWindow = nowMs >= windowStartMs && nowMs <= windowEndMs

  return {
    width,
    height,
    padLeft,
    padRight,
    plotTop,
    plotBottom,
    max,
    bars,
    nowX: inWindow ? xForMs(nowMs) : null,
    slotWidth: barSlot,
    windowStartMs,
    windowMs,
  }
}

/** Point le plus proche d'un instant cible (recherche linéaire, séries courtes). */
export function nearestByTime<T extends { t: string }>(points: T[], targetMs: number): T | null {
  if (points.length === 0) return null
  let best = points[0]!
  let bestDiff = Math.abs(new Date(best.t).getTime() - targetMs)
  for (const p of points) {
    const diff = Math.abs(new Date(p.t).getTime() - targetMs)
    if (diff < bestDiff) {
      best = p
      bestDiff = diff
    }
  }
  return best
}
