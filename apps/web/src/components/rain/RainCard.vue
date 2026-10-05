<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { rainLevel, rainTotals, rainWindow } from '@/domain/rain'
import { fmtMm } from '@/domain/format'
import type { RainPoint, RainState } from '@/domain/types'
import BaseBadge from '../ui/BaseBadge.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseNumberInput from '../ui/BaseNumberInput.vue'
import BaseSpinner from '../ui/BaseSpinner.vue'
import RainBarsChart from '../charts/RainBarsChart.vue'
import MetricValue from '../metric/MetricValue.vue'

const props = defineProps<{ point: RainPoint; state: RainState; nowMs: number }>()

const emit = defineEmits<{
  refresh: [point: RainPoint]
  threshold: [point: RainPoint, value: number]
  alert: [point: RainPoint, value: number]
  reset: [point: RainPoint]
}>()

const menuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)

const totals = computed(() => rainTotals(props.state, props.point.origin, props.nowMs))
const level = computed(() => rainLevel(totals.value.total, props.state))
const window = computed(() => rainWindow(props.point.origin, props.nowMs))

const series = computed(() =>
  props.state.times.map((t, i) => ({ t, y: props.state.values[i] ?? 0 })),
)

const threshold = computed({
  get: () => props.state.threshold,
  set: (v) => emit('threshold', props.point, v ?? 0),
})

const alertThreshold = computed({
  get: () => props.state.alertThreshold,
  set: (v) => emit('alert', props.point, v ?? 0),
})

function onDocumentClick(event: MouseEvent) {
  if (menuRoot.value && !menuRoot.value.contains(event.target as Node)) menuOpen.value = false
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <article class="rain-card">
    <header class="rain-card__head">
      <div class="rain-card__titles">
        <h4 class="rain-card__title">{{ point.name }}</h4>
        <p class="rain-card__context">{{ point.context }}</p>
      </div>
      <div class="rain-card__actions">
        <BaseBadge
          v-if="level"
          :tone="level === 'alert' ? 'danger' : 'warn'"
          dot
          :title="`Cumul total ${fmtMm(totals.total)} mm`"
        >
          {{ level === 'alert' ? 'Alerte' : 'Vigilance' }}
        </BaseBadge>
        <BaseSpinner v-if="state.fetching" />
        <BaseButton
          variant="icon"
          icon="refresh"
          aria-label="Rafraîchir ce point"
          :disabled="state.fetching"
          @click="emit('refresh', point)"
        />
        <div ref="menuRoot" class="rain-card__menu">
          <BaseButton
            variant="icon"
            icon="kebab"
            aria-label="Seuils de pluviométrie"
            :aria-expanded="menuOpen"
            @click="menuOpen = !menuOpen"
          />
          <div v-if="menuOpen" class="rain-card__dropdown">
            <BaseNumberInput v-model="threshold" label="Vigilance" unit="mm" :min="0" :step="1" />
            <BaseNumberInput
              v-model="alertThreshold"
              label="Alerte"
              unit="mm"
              :min="threshold"
              :step="1"
            />
            <BaseButton variant="ghost" size="sm" @click="emit('reset', point)">
              Réinitialiser
            </BaseButton>
          </div>
        </div>
      </div>
    </header>

    <p v-if="state.error" class="rain-card__error" role="alert">⚠ {{ state.error }}</p>

    <div class="rain-card__metrics">
      <MetricValue label="Tombé (24 h)" :value="fmtMm(totals.tombe)" unit="mm" />
      <MetricValue
        :label="`Prévu (${totals.horizon} h)`"
        :value="fmtMm(totals.prevu)"
        unit="mm"
        color="var(--rain-far)"
      />
    </div>

    <RainBarsChart
      :points="series"
      :window-start-ms="window.startMs"
      :window-end-ms="window.endMs"
      :now-ms="nowMs"
    />

    <p class="rain-card__total">Cumul total estimé : {{ fmtMm(totals.total) }} mm</p>
  </article>
</template>

<style scoped>
.rain-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  padding: 16px;
}

.rain-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.rain-card__titles {
  min-width: 0;
}

.rain-card__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rain-card__context {
  margin: 1px 0 0;
  color: var(--muted);
  font-size: 0.75rem;
}

.rain-card__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.rain-card__menu {
  position: relative;
  display: inline-flex;
}

.rain-card__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: var(--z-dropdown);
  display: grid;
  gap: 8px;
  min-width: 160px;
  padding: 10px;
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-dropdown);
}

.rain-card__error {
  margin: 0;
  color: var(--red);
  font-size: 0.78rem;
}

.rain-card__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.rain-card__total {
  margin: 0;
  padding-top: 10px;
  border-top: 1px solid var(--card-border);
  color: var(--muted);
  font-size: 0.72rem;
}
</style>
