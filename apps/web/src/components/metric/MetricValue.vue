<script setup lang="ts">
import BaseBadge from '../ui/BaseBadge.vue'
import TrendIndicator from './TrendIndicator.vue'
import type { RangeStatus, Trend } from '@/domain/types'

withDefaults(
  defineProps<{
    label: string
    value: string | null
    unit: string
    color?: string
    status?: RangeStatus | null
    trend?: Trend | null
    trendUnit?: string
    trendRate?: number
  }>(),
  { color: 'var(--accent)', status: null, trend: null, trendUnit: '', trendRate: undefined },
)

const STATUS_LABEL: Record<Exclude<RangeStatus, 'ok'>, string> = { low: 'Bas', high: 'Haut' }
</script>

<template>
  <div class="metric">
    <p class="metric__label" :style="{ color }">
      <span class="metric__dot" />
      {{ label }}
      <BaseBadge v-if="status && status !== 'ok'" :tone="status === 'high' ? 'warn' : 'accent'" size="sm">
        {{ STATUS_LABEL[status] }}
      </BaseBadge>
    </p>
    <p class="metric__value">
      <span class="metric__number">{{ value ?? '—' }}</span>
      <span v-if="value" class="metric__unit">{{ unit }}</span>
    </p>
    <TrendIndicator :trend="trend" :unit="trendUnit" :rate="trendRate" />
  </div>
</template>

<style scoped>
.metric {
  flex: 1;
  min-width: 110px;
}

.metric__label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 3px;
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.metric__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.metric__value {
  margin: 0;
  color: var(--text);
  line-height: 1.1;
}

.metric__number {
  font-size: 1.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.metric__unit {
  margin-left: 4px;
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 600;
}
</style>
