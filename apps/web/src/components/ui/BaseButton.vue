<script setup lang="ts">
import BaseIcon from './BaseIcon.vue'
import type { IconName } from './icons'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost' | 'danger' | 'icon'
    size?: 'sm' | 'md'
    icon?: IconName
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  { variant: 'primary', size: 'md', type: 'button', loading: false, disabled: false },
)

defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <button
    :type="type"
    :class="['ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, { 'is-loading': loading }]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    @click="$emit('click', $event)"
  >
    <BaseIcon v-if="icon" :name="icon" />
    <span v-if="$slots.default" class="ui-btn__label"><slot /></span>
  </button>
</template>

<style scoped>
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: var(--btn-radius, var(--radius-control));
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s, background-color 0.15s, border-color 0.15s;
}

.ui-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ui-btn:not(:disabled):hover {
  filter: brightness(1.1);
}

.ui-btn--md {
  height: 34px;
  padding: 0 12px;
  font-size: 0.8rem;
}

.ui-btn--sm {
  height: 28px;
  padding: 0 9px;
  font-size: 0.75rem;
}

.ui-btn--primary {
  background: var(--accent);
  color: var(--accent-contrast);
}

.ui-btn--ghost {
  background: transparent;
  border-color: var(--card-border);
  color: var(--text);
}

.ui-btn--ghost:not(:disabled):hover {
  border-color: var(--accent);
  background: var(--hover-tint);
}

.ui-btn--danger {
  background: transparent;
  border-color: var(--card-border);
  color: var(--red);
}

.ui-btn--danger:not(:disabled):hover {
  border-color: var(--red);
  background: var(--hover-tint);
}

.ui-btn--icon {
  width: 34px;
  height: 34px;
  padding: 0;
  background: transparent;
  border-color: var(--card-border);
  color: var(--muted);
  font-size: 15px;
}

.ui-btn--icon:not(:disabled):hover {
  color: var(--text);
  border-color: var(--accent);
}

.ui-btn.is-loading :deep(.base-icon) {
  animation: ui-btn-spin 0.9s linear infinite;
}

@keyframes ui-btn-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-btn.is-loading :deep(.base-icon) {
    animation: none;
  }
}

@media (max-width: 640px) {
  .ui-btn--md {
    height: 40px;
  }
}
</style>
