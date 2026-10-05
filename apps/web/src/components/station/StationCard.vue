<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { LEVEL_FLAT_THRESHOLD, flowFlatThreshold } from '@/domain/constants'
import { fmtDate, fmtLevel, fmtQ, levelRateToCmPerHour, pluralize } from '@/domain/format'
import { mean, rangeStatus } from '@/domain/series'
import { computeTrend } from '@/domain/trend'
import type { Station, StationState, Thresholds, TimeWindow } from '@/domain/types'
import BaseBadge from '../ui/BaseBadge.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseIcon from '../ui/BaseIcon.vue'
import BaseNumberInput from '../ui/BaseNumberInput.vue'
import BaseSpinner from '../ui/BaseSpinner.vue'
import SparklineChart from '../charts/SparklineChart.vue'
import MetricValue from '../metric/MetricValue.vue'

const props = defineProps<{
  station: Station
  state: StationState
  thresholds: Thresholds
  window: TimeWindow
  hours: number
  isReference: boolean
}>()

const emit = defineEmits<{
  refresh: [code: string]
  'update:thresholds': [code: string, thresholds: Thresholds]
}>()

const menuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)

const name = computed(() => props.state.name || props.station.fallbackName)
const label = computed(() => props.station.label)

const windowEnd = computed(() => props.window.dateFin ?? new Date())

const levelMean = computed(() => mean(props.state.points.map((p) => p.y)))
const flowMean = computed(() => mean(props.state.flowPoints.map((p) => p.y)))
const lastFlow = computed(() => props.state.flowPoints.at(-1)?.y ?? null)

const levelTrend = computed(() => computeTrend(props.state.points, LEVEL_FLAT_THRESHOLD))
const flowTrend = computed(() =>
  computeTrend(props.state.flowPoints, flowFlatThreshold(lastFlow.value ?? 0)),
)

const levelStatus = computed(() => rangeStatus(levelMean.value, props.thresholds.level))
const flowStatus = computed(() => rangeStatus(flowMean.value, props.thresholds.flow))

const lastMeasure = computed(() => props.state.points.at(-1)?.t ?? props.state.flowPoints.at(-1)?.t)

const countLabel = computed(() => {
  const n = props.state.points.length || props.state.flowPoints.length
  return `${n} ${pluralize(n, 'mesure')} — ${props.hours} h`
})

/** Les seuils réglables suivent la mesure principale affichée : débit si disponible, niveau sinon. */
const thresholdsKey = computed<'flow' | 'level'>(() => (flowMean.value !== null ? 'flow' : 'level'))
const thresholdsLabel = computed(() => (thresholdsKey.value === 'flow' ? 'Seuils de débit' : 'Seuils de niveau'))
const thresholdsUnit = computed(() => (thresholdsKey.value === 'flow' ? 'm³/s' : 'm'))
const thresholdsStep = computed(() => (thresholdsKey.value === 'flow' ? 1 : 0.1))

const rangeLow = computed({
  get: () => props.thresholds[thresholdsKey.value].low,
  set: (low) => commit({ low: low ?? 0, high: props.thresholds[thresholdsKey.value].high }),
})

const rangeHigh = computed({
  get: () => props.thresholds[thresholdsKey.value].high,
  set: (high) => commit({ low: props.thresholds[thresholdsKey.value].low, high: high ?? 0 }),
})

function commit(range: { low: number; high: number }) {
  emit('update:thresholds', props.station.code, { ...props.thresholds, [thresholdsKey.value]: range })
}

function onDocumentClick(event: MouseEvent) {
  if (menuRoot.value && !menuRoot.value.contains(event.target as Node)) menuOpen.value = false
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <article :class="['card', isReference ? 'reference-card' : '']">
    <header class="card__head">
      <div class="card__titles">
        <h3 class="card__title">{{ name }}</h3>
        <div class="card__sub-row">
          <BaseBadge v-if="isReference" tone="accent" class="card__ref-badge"><BaseIcon name="star" /> Référence</BaseBadge>
          <p class="card__subtitle">{{ station.code }} · {{ label }}</p>
        </div>
      </div>
      <div class="card__actions">
        <BaseSpinner v-if="state.fetching" />
        <BaseButton
          variant="icon"
          icon="refresh"
          aria-label="Rafraîchir cette station"
          :disabled="state.fetching"
          @click="emit('refresh', station.code)"
        />
        <div ref="menuRoot" class="card__menu">
          <BaseButton
            variant="icon"
            icon="kebab"
            aria-label="Réglages des seuils"
            :aria-expanded="menuOpen"
            @click="menuOpen = !menuOpen"
          />
          <div v-if="menuOpen" class="card__dropdown">
            <p class="card__dropdown-title">{{ thresholdsLabel }}</p>
            <BaseNumberInput v-model="rangeLow" label="Bas" :unit="thresholdsUnit" :step="thresholdsStep" />
            <BaseNumberInput v-model="rangeHigh" label="Haut" :unit="thresholdsUnit" :step="thresholdsStep" />
          </div>
        </div>
      </div>
    </header>

    <p v-if="state.error" class="card__error" role="alert">⚠ {{ state.error }}</p>

    <div class="card__metrics">
      <MetricValue
        v-if="flowMean !== null"
        label="Débit moyen"
        :value="fmtQ(flowMean)"
        unit="m³/s"
        color="var(--flow)"
        :status="flowStatus"
        :trend="flowTrend"
        trend-unit="m³/s par h"
      />
      <MetricValue
        v-if="levelMean !== null"
        label="Niveau moyen"
        :value="levelMean !== null ? fmtLevel(levelMean) : null"
        unit="m"
        :status="flowMean !== null ? null : levelStatus"
        :trend="levelTrend"
        trend-unit="cm/h"
        :trend-rate="levelTrend ? levelRateToCmPerHour(levelTrend.ratePerHour) : undefined"
      />
    </div>

    <p class="card__meta">
      <span>Dernière mesure : {{ fmtDate(lastMeasure) }}</span>
      <span>{{ countLabel }}</span>
    </p>

    <SparklineChart
      v-if="flowMean !== null"
      :points="state.flowPoints"
      :window-start="window.dateDebut"
      :window-end="windowEnd"
      color="var(--flow)"
      unit="m³/s"
      :decimals="0"
      aria-label="Évolution du débit"
      :companion="state.points.length ? { label: 'Niveau', unit: 'm', points: state.points, decimals: 2 } : null"
    />
    <SparklineChart
      v-else
      :points="state.points"
      :window-start="window.dateDebut"
      :window-end="windowEnd"
      unit="m"
      :decimals="2"
      aria-label="Évolution du niveau"
      :companion="null"
    />

    <a class="card__link" :href="station.url" target="_blank" rel="noopener noreferrer">
      Fiche Hydroportail <BaseIcon name="ext" />
    </a>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  padding: var(--space-card);
}

.reference-card {
  border: 1px solid var(--accent);
}

.card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-inline);
}

.card__titles {
  min-width: 0;
}

.card__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card__sub-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.card__ref-badge {
  flex-shrink: 0;
}

.card__subtitle {
  margin: 2px 0 0;
  min-width: 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.card__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.card__menu {
  position: relative;
  display: inline-flex;
}

.card__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: var(--z-dropdown);
  display: grid;
  gap: 8px;
  min-width: 170px;
  padding: 10px;
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-dropdown);
}

.card__dropdown-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.card__error {
  margin: 0;
  padding: 10px 14px;
  background: color-mix(in srgb, var(--red) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--red) 40%, transparent);
  border-radius: var(--radius-control);
  color: var(--red);
  font-size: 0.85rem;
}

.card__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.card__meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-inline);
  margin: 0;
  color: var(--muted);
  font-size: 0.78rem;
}

.card__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: auto;
  color: var(--accent);
  font-size: 0.78rem;
  text-decoration: none;
  width: fit-content;
}

.card__link:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .card__meta {
    flex-direction: column;
    gap: 2px;
  }
}
</style>
