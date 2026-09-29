<script setup lang="ts">
import { computed } from 'vue'
import { useStations } from '@/composables/useStations'
import { validateExploit } from '@/domain/exploitation'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseNumberInput from '@/components/ui/BaseNumberInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import type { ConfigDraft } from '../useConfigDraft'

const props = defineProps<{ draft: ConfigDraft }>()
const emit = defineEmits<{ reset: [] }>()

const { states } = useStations()

/** BaseNumberInput modelise `number | null` : un champ vide devient NaN pour la validation. */
function field(key: 'dmin' | 'max' | 'optMin' | 'optMax') {
  return computed<number | null>({
    get: () => (Number.isFinite(props.draft.exploit[key]) ? props.draft.exploit[key] : null),
    set: (v) => {
      props.draft.exploit[key] = v === null ? Number.NaN : v
    },
  })
}

const dmin = field('dmin')
const max = field('max')
const optMin = field('optMin')
const optMax = field('optMax')

const refCode = computed<string>({
  get: () => props.draft.exploit.refCode,
  set: (v) => {
    props.draft.exploit.refCode = v
  },
})

const refOptions = computed(() =>
  props.draft.stations.map((s) => ({
    value: s.code,
    label: `${states[s.code]?.name || s.fallbackName} (${s.code})`,
  })),
)

const error = computed(() => validateExploit(props.draft.exploit))

</script>

<template>
  <div class="thresholds-tab">
    <section class="cfg-block">
      <h3 class="cfg-block__title">Station de référence</h3>
      <BaseSelect v-model="refCode" :options="refOptions" :disabled="!refOptions.length" />
      <p v-if="!refOptions.length" class="cfg-block__hint">
        Ajoutez d’abord une station dans l’onglet « Stations suivies ».
      </p>
    </section>

    <div class="cfg-grid">
      <section class="cfg-block">
        <h3 class="cfg-block__title">Débit de réserve</h3>
        <BaseNumberInput v-model="dmin" unit="m³/s" :min="0" :step="0.5" />
      </section>
      <section class="cfg-block">
        <h3 class="cfg-block__title">Capacité maximum</h3>
        <BaseNumberInput v-model="max" unit="m³/s" :min="0" :step="0.5" />
      </section>
    </div>

    <section class="cfg-block">
      <h3 class="cfg-block__title">Plage de rendement optimal</h3>
      <div class="cfg-grid cfg-grid--inline-labels">
        <BaseNumberInput v-model="optMin" label="De" unit="m³/s" :min="0" :step="0.5" />
        <BaseNumberInput v-model="optMax" label="À" unit="m³/s" :min="0" :step="0.5" />
      </div>
    </section>

    <p v-if="error" class="cfg-error" role="alert">{{ error }}</p>

    <div class="cfg-actions">
      <BaseButton variant="ghost" @click="emit('reset')">Rétablir les seuils par défaut</BaseButton>
    </div>
  </div>
</template>

<style scoped>
.thresholds-tab {
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

.cfg-block__hint {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 0.74rem;
}

.cfg-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.cfg-grid--inline-labels :deep(.ui-field) {
  display: flex !important;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  background: var(--bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-control);
}

.cfg-grid--inline-labels :deep(.ui-field__label) {
  white-space: nowrap;
}

.cfg-grid--inline-labels :deep(.ui-input__wrap) {
  flex: 1;
  padding: 0;
  background: none;
  border: none;
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
  .cfg-grid {
    grid-template-columns: 1fr;
  }
}
</style>
