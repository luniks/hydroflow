<script setup lang="ts">
import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import { useDataLoader } from '@/composables/useDataLoader'
import { useTheme } from '@/composables/useTheme'
import { useTimeRange } from '@/composables/useTimeRange'
import AppFooter from '@/components/layout/AppFooter.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import ConfigModal from '@/components/config/ConfigModal.vue'
import ExploitPanel from '@/components/exploitation/ExploitPanel.vue'
import RainSection from '@/components/rain/RainSection.vue'
import StationGrid from '@/components/station/StationGrid.vue'

useTheme()

const { hours, offsetSteps } = useTimeRange()
const { loading, vigicrues, loadAll, refreshStation, refreshRainPoint } = useDataLoader()

useAutoRefresh(loadAll)

/** Horloge partagee par les graphiques de pluie (barres passees/futures). */
const nowMs = ref(Date.now())
const clock = setInterval(() => {
  nowMs.value = Date.now()
}, 60_000)
onScopeDispose(() => clearInterval(clock))

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
      <ExploitPanel :vigicrues="vigicrues" :now-ms="nowMs" />
      <StationGrid @refresh="refreshStation" @open-config="openConfig" />
      <RainSection :now-ms="nowMs" @refresh="refreshRainPoint" @open-config="openConfig" />
    </main>

    <AppFooter />

    <ConfigModal
      :open="configOpen"
      :initial-tab="configTab"
      @close="configOpen = false"
      @saved="loadAll"
    />
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
