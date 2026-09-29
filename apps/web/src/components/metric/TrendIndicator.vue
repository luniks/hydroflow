<script setup lang="ts">
import { computed } from 'vue'
import type { Trend } from '@/domain/types'
import { fmtTrend } from '@/domain/format'

const props = defineProps<{ trend: Trend | null; unit: string; rate?: number }>()

const tone = computed(() => {
  if (!props.trend || props.trend.dir === 'flat') return 'neutral'
  return props.trend.dir === 'up' ? 'alert' : 'ok'
})

const arrow = computed(() => {
  if (!props.trend) return ''
  return props.trend.dir === 'up' ? '▲' : props.trend.dir === 'down' ? '▼' : '▬'
})

const text = computed(() =>
  props.trend ? fmtTrend(props.rate ?? props.trend.ratePerHour, props.unit) : '',
)
</script>

<template>
  <p v-if="trend" class="trend" :class="`trend--${tone}`">
    <span aria-hidden="true">{{ arrow }}</span>
    {{ text }}
  </p>
</template>

<style scoped>
.trend {
  margin: 2px 0 0;
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.trend--neutral {
  color: var(--muted);
}

.trend--ok {
  color: var(--green);
}

.trend--alert {
  color: var(--orange);
}
</style>
