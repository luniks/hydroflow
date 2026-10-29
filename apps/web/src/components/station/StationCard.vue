<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { LEVEL_ANALYZE_OPTIONS, flowAnalyzeOptions } from '@/domain/constants'
import { fmtDate, fmtLevel, fmtQ, fmtTrend, levelRateToCmPerHour, pluralize } from '@/domain/format'
import { mean, rangeStatus } from '@/domain/series'
import { stationBands, stationLine, turbineBands } from '@/domain/stationTrend'
import { analyzeSeries } from '@/domain/trend'
import type { ExploitConfig, SeriesPoint, Station, StationState, Thresholds, TimeWindow } from '@/domain/types'
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
  /** Seuils d'exploitation : ceux de la station de reference, en lecture seule. */
  exploit: ExploitConfig
  /** Horloge de l'application (ms), pour l'age de la derniere mesure. */
  nowMs: number
}>()

const emit = defineEmits<{
  refresh: [code: string]
  'update:thresholds': [code: string, thresholds: Thresholds]
  openConfig: [tab: string]
}>()

const menuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)

const name = computed(() => props.state.name || props.station.fallbackName)
const label = computed(() => props.station.label)

// Fin de fenetre deduite du debut : en direct elle vaut « debut + duree », et suit donc la fenetre recalculee a chaque chargement
// (un `new Date()` ici serait fige par le cache du computed et laisserait les nouvelles mesures hors du graphique).
const windowEnd = computed(() => props.window.dateFin ?? new Date(props.window.dateDebut.getTime() + props.hours * 3_600_000))

const levelMean = computed(() => mean(props.state.points.map((p) => p.y)))
const flowMean = computed(() => mean(props.state.flowPoints.map((p) => p.y)))
const lastFlow = computed(() => props.state.flowPoints.at(-1)?.y ?? null)

const lastLevel = computed(() => props.state.points.at(-1)?.y ?? null)

/** Age (min) de la derniere mesure ; sans objet en navigation dans le passe. */
function ageMin(points: SeriesPoint[]): number | null {
  const last = points.at(-1)
  if (!last || props.window.dateFin) return null
  return Math.max(0, (props.nowMs - Date.parse(last.t)) / 60_000)
}

// Mesure principale (debit, sinon niveau) : la ligne annonce le prochain seuil franchi. Station de reference :
// seuils d'exploitation. L'autre mesure garde une ligne simple.
const flowBands = computed(() =>
  props.isReference ? turbineBands(props.exploit) : stationBands(props.thresholds.flow),
)
const flowLine = computed(() =>
  lastFlow.value === null
    ? null
    : stationLine(analyzeSeries(props.state.flowPoints, flowAnalyzeOptions(lastFlow.value)), lastFlow.value, {
        bands: flowBands.value,
        formatRate: (r) => fmtTrend(r, 'm³/s/h'),
        ageMin: ageMin(props.state.flowPoints),
      }),
)
const levelLine = computed(() =>
  lastLevel.value === null
    ? null
    : stationLine(analyzeSeries(props.state.points, LEVEL_ANALYZE_OPTIONS), lastLevel.value, {
        bands: lastFlow.value === null ? stationBands(props.thresholds.level) : [],
        formatRate: (r) => fmtTrend(levelRateToCmPerHour(r), 'cm/h'),
        ageMin: ageMin(props.state.points),
      }),
)

/** Badge « Bas / Haut » sur la derniere valeur (pas la moyenne) ; la reference n'en a pas : sa zone est dans le suivi d'exploitation. */
const flowStatus = computed(() =>
  props.isReference || lastFlow.value === null ? null : rangeStatus(lastFlow.value, props.thresholds.flow),
)
const levelStatus = computed(() => (lastLevel.value === null ? null : rangeStatus(lastLevel.value, props.thresholds.level)))
const flowStatusTitle = computed(() =>
  flowStatus.value && flowStatus.value !== 'ok'
    ? `Dernière mesure ${fmtQ(lastFlow.value ?? 0)} m³/s : ${flowStatus.value === 'high' ? 'au-dessus' : 'en dessous'} du seuil`
    : undefined,
)

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

function openConfig() {
  menuOpen.value = false
  emit('openConfig', 'turbine')
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
          v-if="!state.fetching"
          variant="icon"
          icon="refresh"
          aria-label="Rafraîchir cette station"
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
            <template v-if="isReference">
              <p class="card__dropdown-title">Seuils de la turbine (vus d’ici)</p>
              <dl class="card__readonly">
                <div><dt>Arrêt sous</dt><dd>{{ fmtQ(exploit.minFlow) }} m³/s</dd></div>
                <div><dt>Démarrage</dt><dd>{{ fmtQ(exploit.startFlow) }} m³/s</dd></div>
                <div><dt>Crue (arrêt)</dt><dd>{{ fmtQ(exploit.maxFlow) }} m³/s</dd></div>
              </dl>
              <button type="button" class="card__link" @click="openConfig">Modifier dans la configuration</button>
            </template>
            <template v-else>
              <p class="card__dropdown-title">{{ thresholdsLabel }}</p>
              <BaseNumberInput v-model="rangeLow" label="Bas" :unit="thresholdsUnit" :step="thresholdsStep" />
              <BaseNumberInput v-model="rangeHigh" label="Haut" :unit="thresholdsUnit" :step="thresholdsStep" />
            </template>
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
        :status-title="flowStatusTitle"
        :line="flowLine"
      />
      <MetricValue
        v-if="levelMean !== null"
        label="Niveau moyen"
        :value="levelMean !== null ? fmtLevel(levelMean) : null"
        unit="m"
        :status="flowMean !== null ? null : levelStatus"
        :line="levelLine"
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
      :title="name"
      :subtitle="`Évolution du débit · ${station.code} · ${label}`"
      aria-label="Évolution du débit"
      y-title="Débit (m³/s)"
      :companion="state.points.length ? { label: 'Niveau', unit: 'm', points: state.points, decimals: 2 } : null"
    />
    <SparklineChart
      v-else
      :points="state.points"
      :window-start="window.dateDebut"
      :window-end="windowEnd"
      unit="m"
      :decimals="2"
      :title="name"
      :subtitle="`Évolution du niveau · ${station.code} · ${label}`"
      aria-label="Évolution du niveau"
      y-title="Niveau (m)"
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

.card__readonly {
  display: grid;
  gap: 4px;
  margin: 0 0 8px;
  font-size: 0.78rem;
}

.card__readonly > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.card__readonly dt {
  color: var(--muted);
}

.card__readonly dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.card__link {
  padding: 0;
  background: none;
  border: none;
  color: var(--accent);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
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
