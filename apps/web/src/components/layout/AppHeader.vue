<script setup lang="ts">
import { computed } from 'vue'
import { fmtDate } from '@/domain/format'
import ApiStatusIndicator from '../status/ApiStatusIndicator.vue'
import { useAutoRefreshSetting } from '@/composables/useAutoRefresh'
import { useTimeRange } from '@/composables/useTimeRange'
import { useTheme } from '@/composables/useTheme'
import BaseButton from '../ui/BaseButton.vue'
import BaseDropdown from '../ui/BaseDropdown.vue'
import type { SelectOption } from '../ui/types'

const props = defineProps<{ loading: boolean }>()
const emit = defineEmits<{ refresh: []; openConfig: [] }>()

const theme = useTheme()
const themeIcon = computed(() => (theme.theme.value === 'dark' ? 'sun' : 'moon'))
const themeLabel = computed(() =>
  theme.theme.value === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre',
)
const { hours, isLive, window, ranges, setHours, prev, next, now } = useTimeRange()
const auto = useAutoRefreshSetting()

const rangeOptions = computed<SelectOption<number>[]>(() =>
  ranges.map((r) => ({ value: r.hours, label: r.longLabel })),
)

const autoOptions = computed<SelectOption<number>[]>(() =>
  auto.options.map((m) => ({ value: m, label: m === 0 ? 'Désactivé' : `${m} min` })),
)

const selectedRange = computed({ get: () => hours.value, set: setHours })
const selectedAuto = computed({ get: () => auto.minutes.value, set: auto.set })

const windowLabel = computed(() =>
  !isLive.value
    ? `${fmtDate(window.value.dateDebut.toISOString())} → ${
        window.value.dateFin
          ? fmtDate(window.value.dateFin.toISOString())
          : fmtDate(new Date().toISOString())
      }`
    : undefined,
)
</script>

<template>
  <header class="flex justify-between items-center flex-wrap gap-[12px] mb-1 max-[640px]:flex-col max-[640px]:items-stretch max-[640px]:gap-[14px]">
    <div class="flex gap-[10px] flex-wrap">
      <div class="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
        </svg>
      </div>
      <div class="app-header__brand">
        <h1 class="app-header__title">Monitoring St-Jean-de-Rives</h1>
        <p class="app-header__tagline">Bassin de l'Agout - Vielmur-sur-Agout / Lavaur / St-Lieux-lès-Lavaur</p>
      </div>
    </div>
    <div class="flex flex-col gap-2 items-end flex-wrap [flex-grow:1] max-[640px]:items-stretch max-[640px]:w-[100%] max-[640px]:[flex-direction:column-reverse]">
      <ApiStatusIndicator />
      <div class="flex flex-wrap items-center gap-2 justify-end max-[640px]:justify-stretch">
        <div class="flex items-center gap-2 flex-wrap max-[640px]:w-full max-[640px]:flex-nowrap">
          <BaseButton variant="ghost" size="md" v-if="!isLive" icon="calendar" @click="now">
            {{new Date().getDate()}}
          </BaseButton>
  
          <div class="app-header__nav max-[640px]:flex-1 max-[640px]:min-w-0" role="group" aria-label="Navigation temporelle">
            <BaseButton
              style="--btn-radius: 8px 0 0 8px"
              variant="icon"
              icon="chevL"
              aria-label="Période précédente"
              @click="prev"
            />
            <BaseDropdown
              style="--btn-radius: 0"
              class="app-header__range-dropdown max-[640px]:flex-1 max-[640px]:min-w-0"
              v-model="selectedRange"
              :options="rangeOptions"
              icon="calendar"
              :customText="windowLabel"
            />
            <BaseButton
              style="--btn-radius: 0 8px 8px 0"
              variant="icon"
              icon="chevR"
              aria-label="Période suivante"
              :disabled="isLive"
              @click="next"
            />
          </div>
        </div>

        <div class="flex items-center gap-2 max-[640px]:w-full">
          <BaseButton
            class="max-[640px]:flex-1"
            icon="refresh"
            aria-label="Rafraîchir"
            :loading="loading"
            @click="emit('refresh')"
          >
            Rafraichir
          </BaseButton>
          <BaseDropdown
            class="max-[640px]:flex-1 max-[640px]:min-w-0"
            v-model="selectedAuto"
            :options="autoOptions"
            label="Auto :"
          />
          <BaseButton variant="icon" :icon="themeIcon" :aria-label="themeLabel" @click="theme.toggle" />
          <BaseButton variant="icon" icon="gear" aria-label="Configuration" @click="emit('openConfig')" />
        </div>

      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.app-header__tagline {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.app-header__nav {
  display: inline-flex;
  align-items: center;
  gap: 0;
}

@media (max-width: 640px) {
  .app-header__range-dropdown :deep(.ui-dropdown__trigger) {
    justify-content: center;
  }
}

.app-header__window,
.app-header__update {
  margin: 0;
  color: var(--muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
</style>
