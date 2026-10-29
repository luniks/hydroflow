<script setup lang="ts">
import { computed } from 'vue'
import BaseNumberInput from '@/components/ui/BaseNumberInput.vue'
import { getSetting, setSetting, type SettingField } from '@/domain/turbineSettings'
import type { TurbineModel } from '@/domain/types'

const props = defineProps<{ model: TurbineModel; field: SettingField }>()

/** BaseNumberInput modelise `number | null` : un champ vide devient NaN pour la validation. */
const value = computed<number | null>({
  get: () => {
    const v = getSetting(props.model, props.field.path)
    return Number.isFinite(v) ? v : null
  },
  set: (v) => setSetting(props.model, props.field.path, v === null ? Number.NaN : v),
})
</script>

<template>
  <div class="tfield">
    <BaseNumberInput
      v-model="value"
      :label="field.label"
      :unit="field.unit"
      :min="field.min"
      :max="field.max"
      :step="field.step"
    />
    <p v-if="field.hint" class="tfield__hint">{{ field.hint }}</p>
  </div>
</template>

<style scoped>
.tfield {
  min-width: 0;
}

.tfield__hint {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.3;
}
</style>
