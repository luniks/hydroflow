<script setup lang="ts">
withDefaults(defineProps<{ label?: string; size?: number }>(), {
  label: 'Chargement…',
  size: 16,
})
</script>

<template>
  <span
    class="ui-spinner"
    role="status"
    :aria-label="label"
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
</template>

<style scoped>
.ui-spinner {
  display: inline-block;
  border: 2px solid var(--card-border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: ui-spin 0.8s linear infinite;
}

@keyframes ui-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-spinner {
    animation-duration: 2.4s;
  }
}
</style>
