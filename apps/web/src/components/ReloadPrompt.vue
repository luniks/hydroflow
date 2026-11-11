<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW()

function close() {
  needRefresh.value = false
  offlineReady.value = false
}
</script>

<template>
  <div v-if="needRefresh || offlineReady" class="pwa-toast" role="status">
    <span v-if="needRefresh">Nouvelle version disponible</span>
    <span v-else>Prêt pour une utilisation hors ligne</span>
    <button v-if="needRefresh" type="button" @click="updateServiceWorker(true)">
      Mettre à jour
    </button>
    <button type="button" @click="close">Fermer</button>
  </div>
</template>

<style scoped>
.pwa-toast {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: var(--z-modal);
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 1rem;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-panel);
  background: var(--card);
  color: var(--text);
  box-shadow: var(--shadow-dropdown);
}
.pwa-toast button {
  border: 1px solid var(--card-border);
  background: transparent;
  color: inherit;
  border-radius: var(--radius-chip);
  padding: 0.25rem 0.6rem;
  cursor: pointer;
}
</style>
