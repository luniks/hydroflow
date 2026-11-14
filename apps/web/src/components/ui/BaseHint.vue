<script setup lang="ts">
import { ref } from 'vue'
import BaseIcon from './BaseIcon.vue'
import BaseTooltip from './BaseTooltip.vue'

defineProps<{ text: string; label?: string }>()

const button = ref<HTMLButtonElement | null>(null)

/** Safari ne donne pas le focus à un bouton au tap : on le force pour ouvrir l'infobulle. */
function onClick() {
  button.value?.focus()
}
</script>

<template>
  <BaseTooltip>
    <button
      ref="button"
      type="button"
      class="ui-hint"
      :aria-label="label ? `Aide : ${label}` : 'Aide'"
      @click="onClick"
    >
      <BaseIcon name="info" :size="14" />
    </button>
    <template #content>{{ text }}</template>
  </BaseTooltip>
</template>

<style scoped>
.ui-hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: none;
  border: none;
  border-radius: 50%;
  color: var(--muted);
  cursor: help;
}

.ui-hint:hover {
  color: var(--text);
}

.ui-hint:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
</style>
