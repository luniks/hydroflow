<script setup lang="ts" generic="T extends string | number">
import { useId } from 'vue'
import BaseHint from './BaseHint.vue'
import type { SelectOption } from './types'

const props = defineProps<{
  options: SelectOption<T>[]
  label?: string
  hint?: string
  disabled?: boolean
}>()

const selected = defineModel<T>({ required: true })
const id = useId()

function onChange(e: Event) {
  const raw = (e.target as HTMLSelectElement).value
  const match = props.options.find((o) => String(o.value) === raw)
  if (match) selected.value = match.value
}
</script>

<template>
  <div class="ui-field">
    <div v-if="label" class="ui-field__labelrow">
      <label class="ui-field__label" :for="id">{{ label }}</label>
      <BaseHint v-if="hint" :text="hint" :label="label" />
    </div>
    <select
      :id="id"
      class="ui-select"
      :value="String(selected)"
      :disabled="disabled"
      @change="onChange"
    >
      <option
        v-for="option in options"
        :key="String(option.value)"
        :value="String(option.value)"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.ui-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ui-field__labelrow {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.ui-field__label {
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ui-select {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  text-overflow: ellipsis;
  height: 34px;
  padding: 0 8px;
  background: var(--bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-control);
  color: var(--text);
  font: inherit;
  font-size: 0.82rem;
}

.ui-select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.ui-select:disabled {
  opacity: 0.55;
}

@media (max-width: 640px) {
  .ui-select {
    height: 38px;
    font-size: 15px;
  }
}
</style>
