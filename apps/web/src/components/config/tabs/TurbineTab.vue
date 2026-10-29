<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStations } from '@/composables/useStations'
import { fmtQ } from '@/domain/format'
import { TURBINE_FIELDS, turbinePreview, validateTurbineModel, type SettingsGroup } from '@/domain/turbineSettings'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCollapse from '@/components/ui/BaseCollapse.vue'
import BaseNumberInput from '@/components/ui/BaseNumberInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import type { ConfigDraft } from '../useConfigDraft'
import TurbineField from './TurbineField.vue'

const props = defineProps<{ draft: ConfigDraft }>()
const emit = defineEmits<{ reset: [] }>()

const { states } = useStations()

const model = computed(() => props.draft.turbine)

const fieldsOf = (group: SettingsGroup) => TURBINE_FIELDS.filter((f) => f.group === group)
const install = fieldsOf('install')
const behavior = fieldsOf('behavior')
const advanced = fieldsOf('advanced')

const stationOptions = computed(() =>
  props.draft.stations.map((s) => ({
    value: s.code,
    label: `${states[s.code]?.name || s.fallbackName} (${s.code})`,
  })),
)
const downOptions = computed(() => [{ value: '', label: 'Aucune (valeurs par défaut)' }, ...stationOptions.value])

const refCode = computed<string>({
  get: () => model.value.refCode,
  set: (v) => {
    model.value.refCode = v
  },
})
const downCode = computed<string>({
  get: () => model.value.downCode,
  set: (v) => {
    model.value.downCode = v
  },
})

const error = computed(() => validateTurbineModel(model.value))
const preview = computed(() => (error.value ? null : turbinePreview(model.value)))

/** Le calage de la courbe de rendement : charge en %, rendement entre 0 et 1. */
const curve = computed(() => model.value.efficiencyCurve)

const finite = (v: number | undefined): number | null => (v !== undefined && Number.isFinite(v) ? v : null)

const loadPct = (i: number): number | null => {
  const v = finite(curve.value[i]?.[0])
  return v === null ? null : Math.round(v * 1000) / 10
}
const setLoad = (i: number, v: number | null) => {
  curve.value[i]![0] = v === null ? Number.NaN : v / 100
}
const effOf = (i: number): number | null => finite(curve.value[i]?.[1])
const setEff = (i: number, v: number | null) => {
  curve.value[i]![1] = v === null ? Number.NaN : v
}

function addPoint() {
  const last = curve.value[curve.value.length - 1]
  curve.value.push([Math.min(1, (last?.[0] ?? 0) + 0.1), last?.[1] ?? model.value.efficiency])
}

function removePoint(index: number) {
  if (curve.value.length > 1) curve.value.splice(index, 1)
}

const advancedCollapsed = ref(true)
</script>

<template>
  <div class="turbine-tab">
    <section class="cfg-block">
      <h3 class="cfg-block__title">Stations</h3>
      <div class="cfg-grid">
        <div>
          <BaseSelect v-model="refCode" label="Station amont (référence)" :options="stationOptions" :disabled="!stationOptions.length" />
          <p class="cfg-block__hint">Son débit alimente la prévision. Obligatoire.</p>
        </div>
        <div>
          <BaseSelect v-model="downCode" label="Station aval (facultative)" :options="downOptions" />
          <p class="cfg-block__hint">Sert à recaler le débit estimé au barrage.</p>
        </div>
      </div>
      <p v-if="!stationOptions.length" class="cfg-block__hint">
        Ajoutez d’abord une station dans l’onglet « Stations suivies ».
      </p>
    </section>

    <section class="cfg-block">
      <h3 class="cfg-block__title">Installation</h3>
      <div class="cfg-grid">
        <TurbineField v-for="f in install" :key="f.path" :model="model" :field="f" />
      </div>
    </section>

    <section class="cfg-block">
      <h3 class="cfg-block__title">Comportement</h3>
      <div class="cfg-grid">
        <TurbineField v-for="f in behavior" :key="f.path" :model="model" :field="f" />
      </div>
    </section>

    <section class="cfg-block cfg-preview" aria-live="polite">
      <h3 class="cfg-block__title">Valeurs déduites</h3>
      <dl v-if="preview" class="cfg-preview__list">
        <div><dt>Démarrage</dt><dd>{{ fmtQ(preview.startFlow) }} m³/s</dd></div>
        <div><dt>Arrêt sous</dt><dd>{{ fmtQ(preview.stopFlow) }} m³/s</dd></div>
        <div><dt>Arrêt en crue (chute minimale)</dt><dd>{{ fmtQ(preview.maxFlow) }} m³/s</dd></div>
        <div><dt>Puissance à pleine capacité</dt><dd>{{ Math.round(preview.fullPowerKw) }} kW</dd></div>
      </dl>
      <p v-else class="cfg-block__hint">Corrigez les réglages invalides pour les calculer.</p>
    </section>

    <BaseCollapse v-model="advancedCollapsed" title="Réglages avancés" class="cfg-advanced">
      <p class="cfg-block__hint">
        Calage du modèle (passage du débit amont au débit du barrage, délai de propagation, tarage aval, rendement). Les
        valeurs par défaut viennent de l’analyse des mesures et des événements d’exploitation.
      </p>
      <div class="cfg-grid">
        <TurbineField v-for="f in advanced" :key="f.path" :model="model" :field="f" />
      </div>

      <h4 class="cfg-block__subtitle">Rendement selon la charge</h4>
      <p class="cfg-block__hint">Charge = débit turbiné / capacité maximale. Le rendement est interpolé entre les points.</p>
      <ul class="cfg-curve">
        <li v-for="(_, i) in curve" :key="i" class="cfg-curve__row">
          <BaseNumberInput
            :model-value="loadPct(i)"
            label="Charge"
            unit="%"
            :min="1"
            :max="100"
            :step="1"
            @update:model-value="setLoad(i, $event)"
          />
          <BaseNumberInput
            :model-value="effOf(i)"
            label="Rendement"
            unit="0 à 1"
            :min="0"
            :max="1"
            :step="0.01"
            @update:model-value="setEff(i, $event)"
          />
          <BaseButton variant="ghost" :disabled="curve.length <= 1" :aria-label="`Supprimer le point ${i + 1}`" @click="removePoint(i)">
            Supprimer
          </BaseButton>
        </li>
      </ul>
      <BaseButton variant="ghost" @click="addPoint">Ajouter un point</BaseButton>
    </BaseCollapse>

    <p v-if="error" class="cfg-error" role="alert">{{ error }}</p>

    <div class="cfg-actions">
      <BaseButton variant="ghost" @click="emit('reset')">Rétablir les valeurs du modèle</BaseButton>
    </div>
  </div>
</template>

<style scoped>
.turbine-tab {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cfg-block {
  padding: 14px;
  background: var(--tint);
  border: 1px solid var(--card-border);
  border-radius: 12px;
}

.cfg-block__title {
  margin: 0 0 10px;
  font-size: 0.8rem;
  font-weight: 600;
}

.cfg-block__subtitle {
  margin: 16px 0 4px;
  font-size: 0.78rem;
  font-weight: 600;
}

.cfg-block__hint {
  margin: 6px 0;
  color: var(--muted);
  font-size: 0.74rem;
}

.cfg-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.cfg-preview__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 14px;
  margin: 0;
}

.cfg-preview__list div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cfg-preview__list dt {
  color: var(--muted);
  font-size: 0.72rem;
}

.cfg-preview__list dd {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.cfg-advanced {
  border: 1px solid var(--card-border);
  border-radius: 12px;
}

.cfg-curve {
  display: grid;
  gap: 10px;
  margin: 0 0 10px;
  padding: 0;
  list-style: none;
}

.cfg-curve__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: end;
  gap: 10px;
}

.cfg-error {
  margin: 0;
  min-height: 1em;
  color: var(--red);
  font-size: 0.74rem;
}

.cfg-actions {
  display: flex;
}

@media (max-width: 640px) {
  .cfg-grid,
  .cfg-preview__list {
    grid-template-columns: 1fr;
  }

  .cfg-curve__row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .cfg-curve__row > :last-child {
    grid-column: 1 / -1;
  }
}
</style>
