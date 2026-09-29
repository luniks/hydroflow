<script setup lang="ts">
import { computed } from 'vue'
import { loadStationThresholds, saveStationThresholds, useStations } from '@/composables/useStations'
import { useExploit } from '@/composables/useExploit'
import { useTimeRange } from '@/composables/useTimeRange'
import type { Thresholds } from '@/domain/types'
import BaseState from '../ui/BaseState.vue'
import StationCard from './StationCard.vue'

const emit = defineEmits<{ refresh: [code: string]; openConfig: [tab: string] }>()

const { stations, stateOf } = useStations()
const { exploit } = useExploit()
const { hours, window } = useTimeRange()

// Les seuils vivent hors du composable (une clé localStorage par station) ; on les relit à chaque rendu.
const thresholds = computed(() =>
  Object.fromEntries(stations.value.map((s) => [s.code, loadStationThresholds(s)])),
)

const revision = computed(() => stations.value.map((s) => s.code).join('|'))

function onThresholds(code: string, next: Thresholds) {
  const station = stations.value.find((s) => s.code === code)
  if (!station) return
  saveStationThresholds(station, next)
  stations.value = [...stations.value]
}
</script>

<template>
  <div class="text-[1.05rem] font-bold m-[0_0_2px_0] block md:flex items-center gap-[8px]">
    <h2>
      <svg class="ico ico-md ico-lead text-[color:var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" aria-hidden="true"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
      Niveau & débit
    </h2>
    <div class="text-[color:var(--muted)] text-[0.78rem]">— Hauteur d'eau et débit en direct · Hub'Eau / Vigicrues</div>
  </div>
  <section class="station-grid" :key="revision">
    <BaseState
      v-if="stations.length === 0"
      title="Aucune station suivie"
      description="Ajoutez une station Hub'Eau pour afficher ses niveaux et débits."
      icon="pin"
      action-label="Ajouter une station"
      @action="emit('openConfig', 'stations')"
    />
    <StationCard
      v-for="station in stations"
      v-else
      :key="station.code"
      :station="station"
      :state="stateOf(station.code)"
      :thresholds="thresholds[station.code]!"
      :window="window"
      :hours="hours"
      :is-reference="station.code === exploit.refCode"
      @refresh="emit('refresh', $event)"
      @update:thresholds="onThresholds"
    />
  </section>
</template>

<style scoped>
.station-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-section);
}
.station__header {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 0.8rem;
}
.ico {
  width:16px;
  height:16px;
  flex:none;
  display:inline-block;
  vertical-align:-2px;
  cursor:inherit;
  transition:none;
}
</style>
