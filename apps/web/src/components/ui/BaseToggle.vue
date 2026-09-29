<script setup lang="ts">
withDefaults(defineProps<{ label?: string; disabled?: boolean }>(), { disabled: false })
const checked = defineModel<boolean>({ required: true })
</script>

<template>
  <button
    type="button"
    role="switch"
    class="ui-toggle"
    :aria-checked="checked"
    :aria-label="label"
    :disabled="disabled"
    @click="checked = !checked"
  >
    <span class="ui-toggle__track"><span class="ui-toggle__thumb" /></span>
    <span v-if="$slots.default" class="ui-toggle__label"><slot /></span>
  </button>
</template>

<style scoped>
.ui-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.ui-toggle:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ui-toggle__track {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 20px;
  background: var(--card-border);
  transition: background-color 0.15s;
  flex-shrink: 0;
}

.ui-toggle[aria-checked='true'] .ui-toggle__track {
  background: var(--accent);
}

.ui-toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s;
}

.ui-toggle[aria-checked='true'] .ui-toggle__thumb {
  transform: translateX(16px);
}

@media (prefers-reduced-motion: reduce) {
  .ui-toggle__track,
  .ui-toggle__thumb {
    transition: none;
  }
}
</style>
