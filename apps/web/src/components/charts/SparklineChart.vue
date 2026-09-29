<script setup lang="ts">
import { computed, toRef, useId } from 'vue'
import { sparklineGeometry } from '@/domain/chartScale'
import { fmtDate } from '@/domain/format'
import type { SeriesPoint } from '@/domain/types'
import { useChartCrosshair } from './useChartCrosshair'
import ChartEmpty from './ChartEmpty.vue'

const props = withDefaults(
  defineProps<{
    points: SeriesPoint[]
    windowStart: Date
    windowEnd: Date
    color?: string
    unit?: string
    decimals?: number
    withXLabels?: boolean
    height?: number
    companion?: { label: string; unit: string; points: SeriesPoint[]; decimals?: number } | null
    emptyLabel?: string
    ariaLabel?: string
  }>(),
  {
    color: 'var(--accent)',
    unit: '',
    decimals: 2,
    withXLabels: true,
    companion: null,
    emptyLabel: 'Aucune mesure sur la période',
    ariaLabel: 'Évolution sur la période',
  },
)

const gradientId = useId()

const geometry = computed(() =>
  sparklineGeometry(props.points, {
    windowStart: props.windowStart,
    windowEnd: props.windowEnd,
    withXLabels: props.withXLabels,
    height: props.height,
  }),
)

const { state, onMouseMove, onTouch, hide } = useChartCrosshair(geometry, toRef(props, 'points'))

const format = (v: number) => v.toFixed(props.decimals)

const companionValue = computed(() => {
  const current = state.value
  const companion = props.companion
  if (!current || !companion || companion.points.length === 0) return null
  const targetMs = new Date(current.point.t).getTime()
  const match = companion.points.reduce((best, p) =>
    Math.abs(new Date(p.t).getTime() - targetMs) < Math.abs(new Date(best.t).getTime() - targetMs)
      ? p
      : best,
  )
  // Au-delà d'une heure d'écart la mesure associée n'est plus comparable.
  if (Math.abs(new Date(match.t).getTime() - targetMs) > 3_600_000) return null
  return `${companion.label} : ${match.y.toFixed(companion.decimals ?? 2)} ${companion.unit}`
})
</script>

<template>
  <div class="chart__wrap">
    <ChartEmpty v-if="!geometry" :label="emptyLabel" />
    <template v-else>
      <svg
        :viewBox="`0 0 ${geometry.width} ${geometry.height}`"
        preserveAspectRatio="none"
        role="img"
        :aria-label="ariaLabel"
        @mousemove="onMouseMove"
        @mouseleave="hide"
        @touchstart="onTouch"
        @touchmove="onTouch"
        @touchend="hide"
      >
        <defs>
          <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="color" stop-opacity="0.35" />
            <stop offset="100%" :stop-color="color" stop-opacity="0" />
          </linearGradient>
        </defs>

        <line
          v-for="edge in [geometry.plotTop, geometry.plotBottom]"
          :key="edge"
          :x1="geometry.padLeft"
          :y1="edge"
          :x2="geometry.width - geometry.padRight"
          :y2="edge"
          class="chart__grid"
        />
        <text :x="geometry.padLeft - 6" :y="geometry.plotTop + 4" text-anchor="end" class="chart__axis">
          {{ format(geometry.max) }}
        </text>
        <text
          :x="geometry.padLeft - 6"
          :y="geometry.plotBottom + 4"
          text-anchor="end"
          class="chart__axis"
        >
          {{ format(geometry.min) }}
        </text>

        <g v-for="(tick, index) in geometry.xTicks" :key="tick.label + index">
          <line
            :x1="tick.position"
            :y1="geometry.plotTop"
            :x2="tick.position"
            :y2="geometry.plotBottom"
            class="chart__grid"
          />
          <text
            v-if="withXLabels"
            :x="tick.position"
            :y="geometry.height - 6"
            :text-anchor="index === 0 ? 'start' : index === geometry.xTicks.length - 1 ? 'end' : 'middle'"
            class="chart__axis chart__axis--x"
          >
            {{ tick.label }}
          </text>
        </g>

        <path :d="geometry.areaD" :fill="`url(#${gradientId})`" stroke="none" />
        <path
          :d="geometry.pathD"
          fill="none"
          :stroke="color"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        <circle :cx="geometry.lastPoint[0]" :cy="geometry.lastPoint[1]" r="3.5" :fill="color" />

        <g v-if="state" class="chart__crosshair">
          <line
            :x1="state.x"
            :y1="geometry.plotTop"
            :x2="state.x"
            :y2="geometry.plotBottom"
            class="chart__crosshair-line"
          />
          <line
            :x1="geometry.padLeft"
            :y1="state.y"
            :x2="geometry.width - geometry.padRight"
            :y2="state.y"
            class="chart__crosshair-line"
          />
          <circle :cx="state.x" :cy="state.y" r="4" :fill="color" stroke="var(--card)" stroke-width="1.5" />
        </g>
      </svg>

      <div
        v-if="state"
        class="chart__tooltip"
        :class="`is-align-${state.align}`"
        :style="{ left: `${state.cssX}px`, top: `${state.cssY}px` }"
        role="status"
      >
        <div>{{ fmtDate(state.point.t) }} — {{ format(state.point.y) }} {{ unit }}</div>
        <div v-if="companionValue" class="chart__tooltip-companion">{{ companionValue }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.chart__wrap {
  position: relative;
  width: 100%;
}

.chart__wrap svg {
  display: block;
  width: 100%;
  height: auto;
  touch-action: none;
}

.chart__grid {
  stroke: var(--card-border);
  stroke-width: 1;
  stroke-dasharray: 2, 3;
}

.chart__axis {
  fill: var(--muted);
  font-size: 11px;
}

.chart__axis--x {
  font-size: 10px;
}

.chart__crosshair-line {
  stroke: var(--muted);
  stroke-width: 1;
  stroke-dasharray: 3, 3;
}

.chart__tooltip {
  position: absolute;
  z-index: var(--z-tooltip);
  padding: 4px 8px;
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-chip);
  box-shadow: var(--shadow-tooltip);
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  transform: translate(-50%, -130%);
}

.chart__tooltip.is-align-left {
  transform: translate(0, -130%);
}

.chart__tooltip.is-align-right {
  transform: translate(-100%, -130%);
}

.chart__tooltip-companion {
  color: var(--muted);
  font-weight: 500;
}
</style>
