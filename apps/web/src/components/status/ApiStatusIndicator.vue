<script setup lang="ts">
import { computed } from 'vue'
import { fmtDate } from '@/domain/format'
import BaseTooltip from '../ui/BaseTooltip.vue'
import { useApiHealth } from '@/composables/useApiHealth'
import { useDataLoader } from '@/composables/useDataLoader'

const { overall, overallLabel, entries } = useApiHealth()
const dateFormat = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};
const { lastUpdate } = useDataLoader()
const updateLabel = computed(() => 
  lastUpdate.value ? `Dernière mise à jour : ${fmtDate(lastUpdate.value.toISOString(), dateFormat)}` : 'Récupération des données en cours',
)
</script>

<template>
  <div class="api-status-bar">
    <BaseTooltip class="api-status">
      <span class="api-status__trigger" tabindex="0" role="status" :aria-label="overallLabel">
        <span class="api-dot" :class="`api-dot--${overall}`" />
      </span>

      <template #content>
        <ul class="api-status__list">
          <li class="api-status__item" v-for="entry in entries" :key="entry.key">
            <span class="api-dot" :class="`api-dot--${entry.state}`" />
            <div class="api-status__col">
              <span class="api-status__name">{{ entry.label }}</span>
              <span class="api-status__detail">{{ entry.detail }}</span>
            </div>
          </li>
        </ul>
      </template>
    </BaseTooltip>
    <p class="app-header__update">{{ updateLabel }}</p>
  </div>
</template>

<style scoped>
.api-status-bar {
  display: flex;
  align-items: center;
}

.api-status :deep(.ui-tooltip__bubble) {
  min-width: 260px;
  max-width: min(480px, 90vw);
}

.api-status__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 15px;
  color: var(--muted);
  font-size: 0.78rem;
  cursor: pointer;
}

.api-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--muted);
  flex-shrink: 0;
}

.api-dot--ok {
  background: var(--green);
}

.api-dot--warn {
  background: var(--yellow);
}

.api-dot--err {
  background: var(--red);
  box-shadow: 0 0 8px var(--red);
}

.api-status__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  margin: 0;
  padding: 8px;
  list-style: none;
}

.api-status__item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.api-status__item .api-dot {
  margin-top: 5px;
}

.api-status__col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.api-status__name {
  font-weight: 700;
}

.api-status__detail {
  width: 100%;
  color: var(--muted);
  overflow-wrap: break-word;
  word-break: break-word;
}
</style>
