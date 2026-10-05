<script setup lang="ts">
import { computed } from 'vue'
import { useRain } from '@/composables/useRain'
import type { RainPoint } from '@/domain/types'
import RainGroup from './RainGroup.vue'

defineProps<{ nowMs: number }>()
const emit = defineEmits<{ refresh: [point: RainPoint]; openConfig: [tab: string] }>()

const rain = useRain()

const visible = computed(() => rain.visiblePoints.value)
const stationPoints = computed(() => visible.value.filter((p) => p.origin === 'station'))
const externalPoints = computed(() => visible.value.filter((p) => p.origin === 'external'))
</script>

<template>
  <section class="rain" aria-labelledby="rain-title">
    <div class="text-[1.05rem] font-bold m-[0_0_2px_0] block md:flex items-center gap-[8px]">
      <h2 id="rain-title" class="rain__title">
        <svg class="ico ico-md ico-lead text-[color:var(--accent)]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z"/></svg>
        Pluviométrie
      </h2>
      <div class="text-[color:var(--muted)] text-[0.78rem]"> — Historique et prévision à 48h · Météo-France</div>
    </div>

    <RainGroup
      title="Stations"
      origin="station"
      :points="stationPoints"
      :now-ms="nowMs"
      empty-title="Aucune station suivie"
      empty-description="Ajoutez une station géolocalisée pour suivre la pluie à son emplacement."
      empty-action="Ajouter une station"
      @refresh="emit('refresh', $event)"
      @open-config="emit('openConfig', $event)"
    />

    <RainGroup
      title="Bassin amont"
      origin="external"
      :points="externalPoints"
      :now-ms="nowMs"
      empty-title="Aucun point amont"
      empty-description="Ajoutez un point en amont du bassin pour anticiper les apports."
      empty-action="Ajouter un point amont"
      @refresh="emit('refresh', $event)"
      @open-config="emit('openConfig', $event)"
    />
  </section>
</template>

<style scoped>
.rain {
  display: grid;
  gap: 22px;
}

.rain__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
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
