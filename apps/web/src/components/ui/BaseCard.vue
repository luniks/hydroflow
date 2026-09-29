<script setup lang="ts">
defineProps<{ title?: string; subtitle?: string }>()
</script>

<template>
  <section class="ui-card">
    <header v-if="title || $slots.actions || $slots.header" class="ui-card__head">
      <slot name="header">
        <div class="ui-card__titles">
          <h3 class="ui-card__title">{{ title }}</h3>
          <p v-if="subtitle" class="ui-card__subtitle">{{ subtitle }}</p>
        </div>
      </slot>
      <div v-if="$slots.actions" class="ui-card__actions"><slot name="actions" /></div>
    </header>
    <div class="ui-card__body"><slot /></div>
  </section>
</template>

<style scoped>
.ui-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  padding: var(--space-card);
  gap: var(--space-section);
}

.ui-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-inline);
}

.ui-card__titles {
  min-width: 0;
}

.ui-card__title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-card__subtitle {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 0.75rem;
}

.ui-card__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.ui-card__body {
  min-width: 0;
}
</style>
