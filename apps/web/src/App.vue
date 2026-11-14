<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import { useRefreshOnReturn } from '@/composables/useRefreshOnReturn'
import { useDataLoader } from '@/composables/useDataLoader'
import { useNow } from '@/composables/useNow'
import { useTheme } from '@/composables/useTheme'
import { useTimeRange } from '@/composables/useTimeRange'
import AppFooter from '@/components/layout/AppFooter.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import ReloadPrompt from '@/components/ReloadPrompt.vue'
import ConfigModal from '@/components/config/ConfigModal.vue'
import ExploitZone from '@/components/exploitation/ExploitZone.vue'
import RainSection from '@/components/rain/RainSection.vue'
import StationGrid from '@/components/station/StationGrid.vue'

useTheme()

const { hours, offsetSteps } = useTimeRange()
const { loading, vigicrues, loadAll, refreshStation, refreshRainPoint } = useDataLoader()

// Un tick du minuteur pendant un chargement est inutile : celui-ci rafraichit deja les donnees.
useAutoRefresh(() => {
  if (!loading.value) void loadAll()
})
useRefreshOnReturn()

/** Horloge partagee (prevision turbine, graphiques de pluie), resynchronisee apres chaque chargement. */
const { nowMs } = useNow()

const configOpen = ref(false)
const configTab = ref('stations')

function openConfig(tab = 'stations') {
  configTab.value = tab
  configOpen.value = true
}

// Tout changement de fenetre temporelle impose un rechargement des series.
watch([hours, offsetSteps], () => void loadAll())

onMounted(() => void loadAll())
</script>

<template>
  <div class="app">

    <AppHeader
      :loading="loading"
      @refresh="loadAll"
      @open-config="openConfig()"
    />

    <main class="app__main">
      <ExploitZone :vigicrues="vigicrues" :now-ms="nowMs" />
      <StationGrid :now-ms="nowMs" @refresh="refreshStation" @open-config="openConfig" />
      <RainSection :now-ms="nowMs" @refresh="refreshRainPoint" @open-config="openConfig" />
    </main>

    <AppFooter />

    <ConfigModal
      :open="configOpen"
      :initial-tab="configTab"
      @close="configOpen = false"
      @saved="loadAll"
    />

    <ReloadPrompt />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 1640px;
  margin: 0 auto;
  padding: var(--space-page);
}

.app__main {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
</style>
