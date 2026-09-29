<script setup lang="ts">
import { computed } from 'vue'
import { rainBarsGeometry } from '@/domain/chartScale'
import { fmtDate, fmtMm } from '@/domain/format'
import type { SeriesPoint } from '@/domain/types'
import ChartEmpty from './ChartEmpty.vue'
import { useRainHover } from './useRainHover'

const props = withDefaults(
  defineProps<{
    points: SeriesPoint[]
    windowStartMs: number
    windowEndMs: number
    nowMs: number
    emptyLabel?: string
  }>(),
  { emptyLabel: 'Prévisions indisponibles pour ce point' },
)

const geometry = computed(() =>
  rainBarsGeometry(props.points, {
    windowStartMs: props.windowStartMs,
    windowEndMs: props.windowEndMs,
    nowMs: props.nowMs,
  }),
)

const points = computed(() => props.points)
const { state, onMouseMove, onTouch, hide } = useRainHover(geometry, points)
</script>

<template>
  <div class="chart__wrap">
    <ChartEmpty v-if="!geometry" :label="emptyLabel" />
    <template v-else>
      <svg
        :viewBox="`0 0 ${geometry.width} ${geometry.height}`"
        preserveAspectRatio="none"
        role="img"
        aria-label="Cumuls de pluie horaires"
        @mousemove="onMouseMove"
        @mouseleave="hide"
        @touchstart="onTouch"
        @touchmove="onTouch"
        @touchend="hide"
      >
        <rect
          v-if="state"
          class="rain-bars__hover-band"
          :x="state.bandX"
          :y="geometry.plotTop"
          :width="state.bandWidth"
          :height="geometry.plotBottom - geometry.plotTop"
        />
        <line
          :x1="geometry.padLeft"
          :y1="geometry.plotBottom"
          :x2="geometry.width - geometry.padRight"
          :y2="geometry.plotBottom"
          class="rain-bars__baseline"
        />
        <rect
          v-for="(bar, index) in geometry.bars"
          :key="index"
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
          rx="1.2"
          :fill="bar.fill"
          :opacity="bar.opacity"
        />
        <line
          v-if="geometry.nowX !== null"
          :x1="geometry.nowX"
          :y1="geometry.plotTop"
          :x2="geometry.nowX"
          :y2="geometry.plotBottom"
          class="rain-bars__now"
        />
      </svg>

      <div
        v-if="state"
        class="chart__tooltip"
        :class="`is-align-${state.align}`"
        :style="{ left: `${state.cssX}px`, top: `${state.cssY}px` }"
        role="status"
      >
        {{ fmtDate(state.point.t) }} — {{ fmtMm(state.point.y) }} mm{{
          new Date(state.point.t).getTime() > nowMs ? ' (prévu)' : ''
        }}
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

.rain-bars__hover-band {
  fill: var(--muted);
  opacity: 0.18;
}

.rain-bars__baseline {
  stroke: var(--card-border);
  stroke-width: 1;
}

.rain-bars__now {
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
</style>
