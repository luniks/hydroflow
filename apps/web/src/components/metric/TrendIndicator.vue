<script setup lang="ts">
import type { StationLine } from '@/domain/stationTrend'

defineProps<{ line: StationLine | null }>()
</script>

<template>
  <p v-if="line" class="trend" :class="`trend--${line.tone}`" :title="line.title">{{ line.text }}</p>
</template>

<style scoped>
.trend {
  margin: 2px 0 0;
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  /* Une seule ligne : sur mobile, le texte complet est dans l'infobulle. */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trend--neutral {
  color: var(--muted);
}

.trend--ok {
  color: var(--green);
}

.trend--warn {
  color: var(--orange);
}
</style>
