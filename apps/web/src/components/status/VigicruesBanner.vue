<script setup lang="ts">
import { computed } from 'vue'
import { bassinUrl, VIGICRUES_TERRITORY_PARENT, type VigicruesInfo } from '@/api/vigicrues'
import BaseIcon from '../ui/BaseIcon.vue'

const props = defineProps<{ info: VigicruesInfo | null }>()

const level = computed(() => props.info?.level ?? null)
const tone = computed(() => level.value?.key ?? 'unknown')
const url = computed(() => bassinUrl(props.info?.parentCode ?? VIGICRUES_TERRITORY_PARENT))
</script>

<template>
  <div class="exploit__cell exploit__cell--vigi">
    <div class="flex flex-col gap-1">
      <div class="flex flex-row justify-between">
        <span class="exploit__cell-label">Vigicrues</span>
        <a class="vigicrues-banner__link" :href="url" target="_blank" rel="noopener noreferrer">
          Voir sur Vigicrues
          <BaseIcon name="ext" />
        </a>
      </div>
      <div class="vigicrues-banner" :class="`vigicrues-banner--${tone}`">
        <span class="vigicrues-banner__dot" />
        <span class="vigicrues-banner__text">
          <template v-if="info && level">
            <strong>{{ level.label }}</strong> — tronçon {{ info.name }}
            <em v-if="info.stale" class="vigicrues-banner__stale">(données en cache)</em>
          </template>
          <template v-else>Vigilance crues indisponible</template>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vigicrues-banner {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 2px 10px;
  color: var(--text);
  font-size: 0.8rem;
  line-height: 1.45;
}

.vigicrues-banner__dot {
  width: 9px;
  height: 9px;
  margin-top: 0.4em;
  border-radius: 50%;
  background: var(--muted);
  flex-shrink: 0;
}

.vigicrues-banner--green .vigicrues-banner__dot {
  background: var(--green);
}

.vigicrues-banner--yellow .vigicrues-banner__dot {
  background: var(--yellow);
}

.vigicrues-banner--orange .vigicrues-banner__dot {
  background: var(--orange);
}

.vigicrues-banner--red .vigicrues-banner__dot {
  background: var(--red);
  box-shadow: 0 0 8px var(--red);
}

.vigicrues-banner--unknown {
  color: var(--muted);
}

.vigicrues-banner__stale {
  color: var(--muted);
  font-style: normal;
}

.vigicrues-banner__link {
  grid-column: 2;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent);
  font-size: 0.75rem;
  text-decoration: none;
  width: fit-content;
}

.vigicrues-banner__link:hover {
  text-decoration: underline;
}
</style>
