<script setup lang="ts">
import { useId } from 'vue'
import BaseIcon from './BaseIcon.vue'

defineProps<{ title: string }>()
const collapsed = defineModel<boolean>({ required: true })
const id = useId()
</script>

<template>
  <div class="ui-collapse" :class="{ 'is-collapsed': collapsed }" @click="collapsed = !collapsed">
    <div class="ui-collapse__head">
      <button
        type="button"
        class="ui-collapse__toggle"
        :aria-expanded="!collapsed"
        :aria-controls="id"
      >
        <BaseIcon name="chevDown" class="ui-collapse__chevron" />
        <span>{{ title }}</span>
      </button>
      <div v-if="$slots.actions" class="ui-collapse__actions"><slot name="actions" /></div>
    </div>
    <div v-if="$slots.subtitle" class="ui-collapse__subtitle"><slot name="subtitle" /></div>
    <div v-show="!collapsed" :id="id" class="ui-collapse__body"><slot /></div>
  </div>
</template>

<style scoped>
.ui-collapse {
  cursor: pointer;
  padding: var(--space-card);
}
.ui-collapse__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  row-gap: 8px;
  column-gap: var(--space-inline);
}

.ui-collapse__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  background: none;
  border: none;
  color: var(--text);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.ui-collapse__chevron {
  color: var(--muted);
  transition: transform 0.15s;
}

.is-collapsed .ui-collapse__chevron {
  transform: rotate(-90deg);
}

.ui-collapse__actions {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
  gap: 8px 12px;
}

.ui-collapse__subtitle {
  margin-top: 6px;
}

.ui-collapse__body {
  padding-top: var(--space-section);
}

/* Wide screens: title, subtitle and actions share the same row. */
@media (min-width: 641px) {
  .ui-collapse:has(.ui-collapse__subtitle) {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: baseline;
    column-gap: 24px;
  }

  .ui-collapse:has(.ui-collapse__subtitle) .ui-collapse__head {
    display: contents;
  }

  .ui-collapse:has(.ui-collapse__subtitle) .ui-collapse__toggle {
    align-items: baseline;
    grid-column: 1;
    grid-row: 1;
  }

  .ui-collapse:has(.ui-collapse__subtitle) .ui-collapse__chevron {
    align-self: center;
  }

  .ui-collapse:has(.ui-collapse__subtitle) .ui-collapse__subtitle {
    grid-column: 2;
    grid-row: 1;
    margin-top: 0;
  }

  .ui-collapse:has(.ui-collapse__subtitle) .ui-collapse__actions {
    grid-column: 3;
    grid-row: 1;
  }

  .ui-collapse:has(.ui-collapse__subtitle) .ui-collapse__body {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-collapse__chevron {
    transition: none;
  }
}
</style>
