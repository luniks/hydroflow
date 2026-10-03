<script setup lang="ts">
import { useId } from 'vue'

withDefaults(
  defineProps<{
    label?: string
    type?: 'text' | 'search'
    placeholder?: string
    unit?: string
    error?: string | null
    disabled?: boolean
  }>(),
  { type: 'text', error: null, disabled: false },
)

const value = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <div class="ui-field">
    <label v-if="label" class="ui-field__label" :for="id">{{ label }}</label>
    <div class="ui-input__wrap" :class="{ 'has-error': !!error }">
      <input
        :id="id"
        v-model="value"
        class="ui-input"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-invalid="!!error || undefined"
        :aria-describedby="error ? `${id}-error` : undefined"
      />
      <span v-if="unit" class="ui-input__unit">{{ unit }}</span>
    </div>
    <p v-if="error" :id="`${id}-error`" class="ui-field__error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.ui-field {
  display: flex;
  flex-direction: column;
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

.ui-field__error {
  margin: 0;
  color: var(--red);
  font-size: 0.74rem;
}

.ui-input__wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  background: var(--bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-control);
}

.ui-input__wrap:focus-within {
  border-color: var(--accent);
}

.ui-input__wrap.has-error {
  border-color: var(--red);
}

.ui-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  background: none;
  border: none;
  color: var(--text);
  font: inherit;
  font-size: 0.82rem;
}

.ui-input:focus {
  outline: none;
}

.ui-input__unit {
  color: var(--muted);
  font-size: 0.75rem;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .ui-input {
    height: 38px;
    font-size: 16px;
  }
}
</style>
