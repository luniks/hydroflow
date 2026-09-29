<script setup lang="ts">
import { computed } from 'vue'
import { useRain } from '@/composables/useRain'
import type { RainOrigin, RainPoint } from '@/domain/types'
import BaseCollapse from '../ui/BaseCollapse.vue'
import BaseState from '../ui/BaseState.vue'
import RainCard from './RainCard.vue'

const props = defineProps<{
  title: string
  origin: RainOrigin
  points: RainPoint[]
  nowMs: number
  emptyTitle: string
  emptyDescription: string
  emptyAction: string
}>()

const emit = defineEmits<{ refresh: [point: RainPoint]; openConfig: [tab: string] }>()

const rain = useRain()

const collapsed = computed({
  get: () => rain.groupsCollapsed.value[props.origin] === true,
  set: (value) => {
    rain.groupsCollapsed.value = { ...rain.groupsCollapsed.value, [props.origin]: value }
  },
})

/** L'etat d'un point n'existe qu'apres `syncStates()` : on attend avant de rendre sa carte. */
const ready = computed(() => props.points.filter((p) => rain.states[p.key]))
</script>

<template>
  <BaseCollapse v-model="collapsed" :title="title" class="rain-group">
    <BaseState
      v-if="points.length === 0"
      :title="emptyTitle"
      :description="emptyDescription"
      icon="cloud"
      :action-label="emptyAction"
      @action="emit('openConfig', origin === 'station' ? 'stations' : 'pluie')"
    />
    <div v-else class="rain-group__grid">
      <RainCard
        v-for="point in ready"
        :key="point.key"
        :point="point"
        :state="rain.states[point.key]!"
        :now-ms="nowMs"
        @refresh="emit('refresh', $event)"
        @threshold="rain.setThreshold"
        @alert="rain.setAlertThreshold"
        @reset="rain.resetThresholds"
      />
    </div>
  </BaseCollapse>
</template>

<style scoped>
.rain-group__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}
</style>
