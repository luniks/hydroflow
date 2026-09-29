<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="chart__empty">
    <svg class="chart__empty-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"></path><path d="M7 15l4-4 3 3 5-6" stroke-dasharray="2 3"></path></svg>
    <div class="chart__empty-label">{{ label }}</div>
  </div>
</template>

<style scoped>
.chart__empty {
  display: grid;
  place-items: center;
  min-height: 92px;
  border: 1px dashed var(--card-border);
  border-radius: var(--radius-panel);
  color: var(--muted);
  font-size: 0.8rem;
  text-align: center;
  padding: 8px;
}
.chart__empty-ico {
  width:26px;
  height:26px;
  opacity:0.7;
  cursor:default;
}
</style>
