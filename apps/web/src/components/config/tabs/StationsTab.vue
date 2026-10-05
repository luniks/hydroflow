<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { fetchStationInfo } from '@/api/hubeau'
import { useDragReorder } from '@/composables/useDragReorder'
import { useStations, makeStation } from '@/composables/useStations'
import type { StationLabel } from '@/domain/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseState from '@/components/ui/BaseState.vue'
import type { ConfigDraft } from '../useConfigDraft'

const props = defineProps<{ draft: ConfigDraft; refCode: string }>()
const emit = defineEmits<{ reset: [] }>()

const { states } = useStations()

const LABEL_OPTIONS = [
  { value: 'Amont' as StationLabel, label: 'Amont' },
  { value: 'Aval' as StationLabel, label: 'Aval' },
]

const nameOf = (code: string, fallback: string) => states[code]?.name || fallback

const drag = useDragReorder(
  () => props.draft.stations.map((s) => s.code),
  (from, to) => {
    const next = [...props.draft.stations]
    const [moved] = next.splice(from, 1)
    if (!moved) return
    next.splice(to, 0, moved)
    props.draft.stations = next
  },
)

const newCode = ref('')
const newLabel = ref<StationLabel>('Amont')
const addError = ref<string | null>(null)
const addStatus = ref<string | null>(null)
const adding = ref(false)
const editingCode = ref<string | null>(null)
const flashCode = ref<string | null>(null)
const formEl = ref<HTMLElement | null>(null)
const rowEls = new Map<string, HTMLElement>()

const canReset = computed(() => props.draft.stations.length > 0)

const editingStationName = computed(() => {
  const station = props.draft.stations.find((s) => s.code === editingCode.value)
  return station ? nameOf(station.code, station.fallbackName) : ''
})

function setRowEl(code: string, el: Element | null) {
  if (el instanceof HTMLElement) rowEls.set(code, el)
  else rowEls.delete(code)
}

function scrollIntoViewSoft(el: HTMLElement | null) {
  if (!el) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' })
}

function flashRow(code: string) {
  flashCode.value = null
  nextTick(() => {
    flashCode.value = code
  })
}

async function startEdit(code: string) {
  const station = props.draft.stations.find((s) => s.code === code)
  if (!station) return
  editingCode.value = code
  newCode.value = station.code
  newLabel.value = station.label
  addError.value = null
  addStatus.value = null
  await nextTick()
  scrollIntoViewSoft(formEl.value)
}

function cancelEdit() {
  editingCode.value = null
  newCode.value = ''
  newLabel.value = 'Amont'
  addError.value = null
  addStatus.value = null
}

async function addStation() {
  addError.value = null
  addStatus.value = null

  // Mode edition : le code est verrouillé, seule l'étiquette peut être modifiée.
  if (editingCode.value) {
    const station = props.draft.stations.find((s) => s.code === editingCode.value)
    const editedCode = editingCode.value
    if (station) station.label = newLabel.value
    cancelEdit()
    await nextTick()
    scrollIntoViewSoft(rowEls.get(editedCode) ?? null)
    flashRow(editedCode)
    return
  }

  const code = newCode.value.trim().toUpperCase()
  if (!code) {
    addError.value = 'Indiquez un code de station Hub’Eau.'
    return
  }
  if (props.draft.stations.some((s) => s.code === code)) {
    addError.value = 'Cette station est déjà dans la liste.'
    return
  }
  adding.value = true
  addStatus.value = 'Vérification du code auprès de Hub’Eau…'
  try {
    const info = await fetchStationInfo(code)
    if (!info) {
      addError.value = 'Code introuvable dans le référentiel Hub’Eau. Vérifiez le code (ex. O480252002).'
      return
    }
    props.draft.stations = [...props.draft.stations, makeStation(code, newLabel.value, info)]
    newCode.value = ''
    newLabel.value = 'Amont'
  } finally {
    adding.value = false
    addStatus.value = null
  }
}

function remove(code: string) {
  if (code === editingCode.value) cancelEdit()
  props.draft.stations = props.draft.stations.filter((s) => s.code !== code)
}
</script>


<template>
  <div class="stations-tab">
    <BaseState
      v-if="!draft.stations.length"
      title="Aucune station suivie"
      description="Ajoutez une station Hub’Eau avec son code hydrométrique ci-dessous."
      icon="pin"
    />

    <ul v-else class="st-list">
      <li
        v-for="station in draft.stations"
        :key="station.code"
        :ref="(el) => setRowEl(station.code, el as Element | null)"
        class="st-row"
        :class="{
          'is-dragging': drag.draggingKey.value === station.code,
          'is-drag-over': drag.overKey.value === station.code,
          'is-reference': station.code === refCode,
          'is-editing': station.code === editingCode,
          'is-flash': station.code === flashCode,
        }"
        :style="
          drag.draggingKey.value === station.code
            ? { transform: `translateY(${drag.dragOffsetY.value}px) scale(1.02)` }
            : undefined
        "
        :data-code="station.code"
      >
        <span
          class="st-row__grip"
          role="button"
          :aria-label="`Déplacer ${nameOf(station.code, station.fallbackName)}`"
          @pointerdown="drag.start(station.code, $event)"
          @pointermove="drag.move($event)"
          @pointerup="drag.end($event)"
          @pointercancel="drag.cancel()"
        >
          <BaseIcon name="grip" :size="16" />
        </span>

        <div class="st-row__main">
          <p class="st-row__name">{{ nameOf(station.code, station.fallbackName) }}</p>
          <p class="st-row__meta">
            <span class="st-row__code">{{ station.code }}</span>
            <BaseBadge size="sm">{{ station.label }}</BaseBadge>
            <BaseBadge v-if="station.code === refCode" tone="accent" size="sm">
              <BaseIcon name="star" :size="10" /> Référence
            </BaseBadge>
          </p>
        </div>

        <div class="st-row__actions">
          <BaseButton
            class="st-row__action-btn"
            variant="ghost"
            icon="pencil"
            :aria-label="`Éditer ${station.code}`"
            @click="startEdit(station.code)"
          >
            <span class="st-row__action-label">Éditer</span>
          </BaseButton>
          <BaseButton
            class="st-row__action-btn"
            variant="danger"
            icon="trash"
            :aria-label="`Retirer ${station.code}`"
            @click="remove(station.code)"
          >
            <span class="st-row__action-label">Retirer</span>
          </BaseButton>
        </div>
      </li>
    </ul>

    <section ref="formEl" class="cfg-add" :class="{ 'is-editing': editingCode }">
      <h4 class="cfg-add__title">
        {{ editingCode ? `Modifier la station · ${editingStationName}` : 'Ajouter une station (code Hub’Eau)' }}
      </h4>
      <div class="cfg-add__fields">
        <BaseInput
          v-model="newCode"
          label="Code station hydrométrique"
          placeholder="ex. O480252002"
          :disabled="adding || !!editingCode"
          @keydown.enter="addStation"
        />
        <BaseSelect v-model="newLabel" label="Étiquette" :options="LABEL_OPTIONS" :disabled="adding" />
      </div>
      <div class="cfg-add__actions">
        <p class="cfg-add__msg" :class="{ 'is-error': !!addError }" role="status" aria-live="polite">
          {{ addError ?? addStatus ?? '' }}
        </p>
        <div class="cfg-add__btns">
          <BaseButton v-if="editingCode" variant="ghost" @click="cancelEdit">Annuler</BaseButton>
          <BaseButton
            variant="ghost"
            :icon="editingCode ? 'pencil' : 'plus'"
            :loading="adding"
            @click="addStation"
          >
            {{ editingCode ? 'Modifier' : 'Ajouter la station' }}
          </BaseButton>
        </div>
      </div>
    </section>

    <div v-if="canReset" class="st-reset">
      <BaseButton variant="ghost" @click="emit('reset')">Rétablir les stations par défaut</BaseButton>
    </div>
  </div>
</template>

<style scoped>
.stations-tab {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cfg-section__title {
  margin: 0;
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.st-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.st-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--tint);
  border: 1px solid var(--card-border);
  border-radius: 10px;
}

.st-row.is-dragging {
  position: relative;
  z-index: 2;
  opacity: 0.85;
  box-shadow: 0 10px 22px rgb(0 0 0 / 0.22);
  transition: transform 0.05s linear;
  /* Laisse passer le survol vers la ligne sous le curseur pour detecter la cible de drop. */
  pointer-events: none;
}

.st-row.is-drag-over {
  border: 2px solid var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent);
}

.st-row.is-reference {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.st-row.is-editing {
  outline: 2px solid color-mix(in srgb, var(--flow) 55%, transparent);
  outline-offset: 2px;
}

.st-row.is-flash {
  animation: st-row-flash 1.2s ease-out;
}

@keyframes st-row-flash {
  0% {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
  }
}

.st-row__grip {
  display: inline-flex;
  color: var(--muted);
  cursor: grab;
  touch-action: none;
}

.st-row__main {
  min-width: 0;
}

.st-row__name {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.st-row__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 0.72rem;
}

.st-row__code {
  font-variant-numeric: tabular-nums;
}

.st-row__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.st-row__action-label {
  display: none;
}

@media (min-width: 641px) {
  .st-row__action-label {
    display: inline;
  }
}

@media (max-width: 640px) {
  .st-row {
    align-items: flex-start;
  }

  .st-row__meta {
    flex-wrap: wrap;
  }

  .st-row__actions {
    gap: 6px;
  }

  .st-row__action-btn {
    width: 32px;
    height: 32px;
    padding: 0;
  }

  /* The label wrapper from BaseButton stays in the flex flow even when empty, skewing icon centering. */
  .st-row__action-btn :deep(.ui-btn__label) {
    display: none;
  }
}

.cfg-add {
  padding: 14px;
  background: var(--tint);
  border: 1px solid var(--card-border);
  border-radius: 12px;
}

.cfg-add.is-editing {
  border-color: var(--flow);
}

.cfg-add__title {
  margin: 0 0 10px;
  font-size: 0.8rem;
  font-weight: 600;
}

.cfg-add__fields {
  display: grid;
  grid-template-columns: 1fr 140px;
  gap: 12px;
}

.cfg-add__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
}

.cfg-add__msg {
  margin: 0;
  min-height: 1em;
  color: var(--muted);
  font-size: 0.74rem;
}

.cfg-add__msg.is-error {
  color: var(--red);
}

.cfg-add__btns {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.st-reset {
  display: flex;
}

@media (max-width: 640px) {
  .cfg-add__fields {
    grid-template-columns: 1fr;
  }
}
</style>
