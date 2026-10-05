<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const theme = useTheme()
const githubIcon = computed(() => (theme.theme.value === "light" ? "https://cdn.simpleicons.org/github/0f172a" : "https://cdn.simpleicons.org/github/e2e8f0"))
</script>

<template>
  <footer class="app-footer">
    <a
      class="footer-link flex items-center gap-2 rounded-lg transition px-4 py-2"
      href="https://github.com/luniks/hydroflow"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View this project on GitHub"
      >
      <img alt="GitHub" height="24" width="24" :src="githubIcon" />
      <span class="text-base font-bold">HydroFlow <span class="ml-[5px] mr-[1px]">v</span>0.2</span>
    </a>
    <div class="footer-links flex items-center gap-2 flex-wrap justify-center">
      <span>Données ouvertes</span>
      <span class="flex items-center gap-2 flex-wrap justify-center">
        <a class="footer-link rounded-lg transition px-1 py-1" href="https://hubeau.eaufrance.fr/page/api-hydrometrie" target="_blank" rel="noopener noreferrer"><strong>Hub'Eau Hydrométrie</strong></a> •
        <a class="footer-link rounded-lg transition px-1 py-1" href="https://www.vigicrues.gouv.fr/" target="_blank" rel="noopener noreferrer"><strong>Vigicrues</strong></a> •
        <a class="footer-link rounded-lg transition px-1 py-1" href="https://meteofrance.com/" target="_blank" rel="noopener noreferrer"><strong>Météo-France</strong></a>
      </span>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px 16px;
  padding-top: var(--space-section);
  border-top: 1px solid var(--card-border);
  color: var(--muted);
  font-size: 0.75rem;
}

@media (max-width: 640px) {
  .app-footer {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .footer-links {
    flex-direction: column;
    gap: 4px;
  }
}

.app-footer p {
  margin: 0;
}

.app-footer a {
  color: var(--accent);
  text-decoration: none;
}

.footer-link {
  color: var(--muted);
  text-decoration: none;
}

.footer-link:hover {
  color: var(--accent);
  background: var(--hover-tint);
  text-decoration: none;
}
</style>
