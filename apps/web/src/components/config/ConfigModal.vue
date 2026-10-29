<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DEFAULT_TURBINE_MODEL } from '@/domain/constants'
import { cloneTurbineModel } from '@/domain/turbineModel'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseTabs from '@/components/ui/BaseTabs.vue'
import { useConfigDraft } from './useConfigDraft'
import StationsTab from './tabs/StationsTab.vue'
import TurbineTab from './tabs/TurbineTab.vue'
import RainTab from './tabs/RainTab.vue'

const props = withDefaults(defineProps<{ open: boolean; initialTab?: string }>(), {
  initialTab: 'stations',
})
const emit = defineEmits<{ close: []; saved: [] }>()

const { draft, cancel, commit, resetStations, resetRainExternal } = useConfigDraft()

const TABS = computed(() => [
  {
    id: 'stations',
    label: 'Stations suivies',
    shortLabel: 'Stations',
    icon: 'pin' as const,
    count: draft.stations.length,
  },
  { id: 'turbine', label: 'Turbine', icon: 'bolt' as const },
  { id: 'pluie', label: 'Pluviométrie', icon: 'cloud' as const },
])

const activeTab = ref('stations')
const saveError = ref<string | null>(null)

/** A chaque ouverture, on repart de la configuration persistee. */
watch(
  () => props.open,
  (open) => {
    if (!open) return
    cancel()
    saveError.value = null
    activeTab.value = TABS.value.some((t) => t.id === props.initialTab) ? props.initialTab : 'stations'
  },
)

const refCode = computed(() => draft.turbine.refCode)

function onCancel() {
  cancel()
  emit('close')
}

function onSave() {
  const error = commit()
  if (error) {
    saveError.value = error
    activeTab.value = 'turbine'
    return
  }
  saveError.value = null
  emit('saved')
  emit('close')
}

/** Les valeurs du modele, en conservant les stations choisies. */
function resetTurbine() {
  draft.turbine = { ...cloneTurbineModel(DEFAULT_TURBINE_MODEL), refCode: draft.turbine.refCode, downCode: draft.turbine.downCode }
}

function resetAll() {
  resetStations()
  resetRainExternal()
}
</script>

<template>
  <BaseModal
    :open="open"
    title="Configuration & Paramètres"
    subtitle="Gestion des stations Hub'Eau & paramètres de la turbine"
    icon="gear"
    width="820px"
    @close="onCancel"
  >
    <BaseTabs v-model="activeTab" :tabs="TABS" label="Sections de configuration">
      <template #stations>
        <StationsTab :draft="draft" :ref-code="refCode" @reset="resetAll" />
      </template>
      <template #turbine>
        <TurbineTab :draft="draft" @reset="resetTurbine" />
      </template>
      <template #pluie>
        <RainTab :draft="draft" />
      </template>
    </BaseTabs>

    <template #footer>
      <p class="cfg-foot__error" role="alert">{{ saveError ?? '' }}</p>
      <div class="cfg-foot__btns">
        <BaseButton variant="ghost" @click="onCancel">Annuler</BaseButton>
        <BaseButton icon="check" @click="onSave">
          <span class="cfg-save-label--short">Enregistrer</span>
          <span class="cfg-save-label--full">Enregistrer les modifications</span>
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.cfg-save-label--full {
  display: none;
}

@media (min-width: 560px) {
  .cfg-save-label--short {
    display: none;
  }

  .cfg-save-label--full {
    display: inline;
  }
}

.cfg-foot__error {
  margin: 0;
  flex: 1;
  min-width: 0;
  color: var(--red);
  font-size: 0.74rem;
}

.cfg-foot__btns {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

@media (max-width: 640px) {
  .cfg-foot__error {
    flex-basis: 100%;
  }

  .cfg-foot__btns {
    width: 100%;
    margin-left: 0;
  }

  .cfg-foot__btns :deep(button) {
    flex: 1 1 0;
    height: 44px;
  }
}
</style>
