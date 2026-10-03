<script setup lang="ts">
import { computed, ref } from 'vue'
import { errorMessage } from '@/api/http'
import { placeSubtitle, searchPlaces, type PlaceResult } from '@/api/openMeteo'
import { useStations } from '@/composables/useStations'
import { RAIN_EXTERNAL_MAX } from '@/domain/constants'
import { makeExternalRainDef, validateManualRainPoint } from '@/domain/rainPoints'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseNumberInput from '@/components/ui/BaseNumberInput.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import type { ConfigDraft } from '../useConfigDraft'

const props = defineProps<{ draft: ConfigDraft }>()

const { states } = useStations()

const stationRows = computed(() =>
  props.draft.stations.map((s) => ({
    key: `station_${s.code}`,
    name: states[s.code]?.name || s.fallbackName,
    code: s.code,
    label: s.label,
    located: typeof s.lat === 'number' && typeof s.lon === 'number',
  })),
)

const isVisible = (key: string) => !props.draft.rainHidden.includes(key)

function setVisible(key: string, visible: boolean) {
  const set = new Set(props.draft.rainHidden)
  if (visible) set.delete(key)
  else set.add(key)
  props.draft.rainHidden = [...set]
}

function removeExternal(key: string) {
  props.draft.rainExternal = props.draft.rainExternal.filter((d) => d.key !== key)
}

const full = computed(() => props.draft.rainExternal.length >= RAIN_EXTERNAL_MAX)

const query = ref('')
const searching = ref(false)
const searchMsg = ref<string | null>(null)
const results = ref<PlaceResult[]>([])

async function runSearch() {
  const q = query.value.trim()
  results.value = []
  if (q.length < 2) {
    searchMsg.value = 'Saisissez au moins 2 caractères.'
    return
  }
  searching.value = true
  searchMsg.value = 'Recherche en cours…'
  try {
    const found = await searchPlaces(q)
    results.value = found
    searchMsg.value = found.length ? null : `Aucun résultat pour « ${q} ».`
  } catch (e) {
    searchMsg.value = `Recherche impossible (${errorMessage(e)}). Vous pouvez saisir les coordonnées à la main.`
  } finally {
    searching.value = false
  }
}

function pick(place: PlaceResult) {
  const error = validateManualRainPoint(
    { name: place.name, lat: place.latitude, lon: place.longitude },
    props.draft.rainExternal,
  )
  if (error) {
    searchMsg.value = error
    return
  }
  props.draft.rainExternal = [
    ...props.draft.rainExternal,
    makeExternalRainDef(place.name, place.latitude, place.longitude, placeSubtitle(place)),
  ]
  results.value = []
  query.value = ''
  searchMsg.value = null
}

const manualName = ref('')
const manualLat = ref<number | null>(null)
const manualLon = ref<number | null>(null)
const manualError = ref<string | null>(null)

function addManual() {
  const input = { name: manualName.value, lat: manualLat.value, lon: manualLon.value }
  const error = validateManualRainPoint(input, props.draft.rainExternal)
  manualError.value = error
  if (error) return
  props.draft.rainExternal = [
    ...props.draft.rainExternal,
    makeExternalRainDef(input.name, input.lat!, input.lon!),
  ]
  manualName.value = ''
  manualLat.value = null
  manualLon.value = null
}

const showAddForm = ref(false)

function toggleAddForm() {
  showAddForm.value = !showAddForm.value
  if (!showAddForm.value) {
    query.value = ''
    results.value = []
    searchMsg.value = null
    manualError.value = null
  }
}
</script>

<template>
  <div class="rain-tab">
    <section v-if="!showAddForm" class="cfg-section">
      <h3 class="cfg-section__title">Sur vos stations</h3>
      <p v-if="!stationRows.length" class="cfg-section__hint">Aucune station suivie.</p>
      <ul v-else class="rc-list">
        <li v-for="row in stationRows" :key="row.key" class="rc-row">
          <div class="rc-row__main">
            <p class="rc-row__name">{{ row.name }}</p>
            <p class="rc-row__meta">
              <span>{{ row.code }}</span>
              <span>{{ row.label }}</span>
              <span v-if="!row.located" class="rc-row__note">Coordonnées indisponibles</span>
            </p>
          </div>
          <BaseToggle
            :model-value="isVisible(row.key)"
            :disabled="!row.located"
            :label="`Afficher la pluie de ${row.name}`"
            @update:model-value="setVisible(row.key, $event)"
          />
        </li>
      </ul>
    </section>

    <section class="cfg-section">
      <div class="cfg-section__head">
        <h3 class="cfg-section__title">Amont du bassin</h3>
        <BaseButton
          variant="ghost"
          size="sm"
          :icon="showAddForm ? 'x' : 'plus'"
          :disabled="full && !showAddForm"
          @click="toggleAddForm"
        >
          {{ showAddForm ? 'Fermer' : 'Ajouter' }}
        </BaseButton>
      </div>

      <p v-if="full" class="cfg-add__msg is-error">Maximum {{ RAIN_EXTERNAL_MAX }} points amont.</p>

      <ul v-if="!showAddForm && draft.rainExternal.length" class="rc-list">
        <li v-for="def in draft.rainExternal" :key="def.key" class="rc-row">
          <div class="rc-row__main">
            <p class="rc-row__name">{{ def.name }}</p>
            <p class="rc-row__meta">
              <span v-if="def.context">{{ def.context }}</span>
              <span>{{ def.lat.toFixed(3) }}, {{ def.lon.toFixed(3) }}</span>
            </p>
          </div>
          <BaseToggle
            :model-value="isVisible(def.key)"
            :label="`Afficher la pluie de ${def.name}`"
            @update:model-value="setVisible(def.key, $event)"
          />
          <BaseButton
            variant="icon"
            icon="trash"
            :aria-label="`Retirer ${def.name}`"
            @click="removeExternal(def.key)"
          />
        </li>
      </ul>

      <div v-if="showAddForm" class="cfg-add">
        <div class="rc-search">
          <BaseInput
            v-model="query"
            type="search"
            label="Rechercher une commune"
            placeholder="Commune (ex. Brassac)"
            :disabled="full"
            @keydown.enter="runSearch"
          />
          <BaseButton :loading="searching" :disabled="full" @click="runSearch">Rechercher</BaseButton>
        </div>

        <p v-if="searchMsg" class="cfg-add__msg" role="status" aria-live="polite">{{ searchMsg }}</p>

        <ul v-if="results.length" class="rc-results">
          <li v-for="place in results" :key="`${place.latitude},${place.longitude}`">
            <button type="button" class="rc-result" @click="pick(place)">
              <span class="rc-result__name">{{ place.name }}</span>
              <span class="rc-result__sub">{{ placeSubtitle(place) }}</span>
            </button>
          </li>
        </ul>

        <details class="rc-manual">
          <summary>Saisir des coordonnées</summary>
          <div class="rc-manual__grid">
            <BaseInput v-model="manualName" label="Nom du point" placeholder="ex. Brassac" class="rc-manual__full" />
            <BaseNumberInput v-model="manualLat" label="Latitude" :step="0.0001" placeholder="43.6047" />
            <BaseNumberInput v-model="manualLon" label="Longitude" :step="0.0001" placeholder="2.2417" />
          </div>
          <div class="cfg-add__actions">
            <p class="cfg-add__msg is-error" role="status" aria-live="polite">{{ manualError ?? '' }}</p>
            <BaseButton icon="plus" :disabled="full" @click="addManual">Ajouter le point</BaseButton>
          </div>
        </details>
      </div>

    </section>
  </div>
</template>

<style scoped>
.rain-tab {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.cfg-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.cfg-section__title {
  margin: 0 0 10px;
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cfg-section__head .cfg-section__title {
  margin: 0;
}

.cfg-section__hint {
  margin: 6px 0 10px;
  color: var(--muted);
  font-size: 0.74rem;
}

.rc-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
}

.rc-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--tint);
  border: 1px solid var(--card-border);
  border-radius: 10px;
}

.rc-row__main {
  min-width: 0;
}

.rc-row__name {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 600;
}

.rc-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 0.72rem;
}

.rc-row__note {
  color: var(--orange);
}

.cfg-add {
  padding: 14px;
  background: var(--tint);
  border: 1px solid var(--card-border);
  border-radius: 12px;
}

.cfg-add__title {
  margin: 0 0 10px;
  font-size: 0.8rem;
  font-weight: 600;
}

.cfg-add__msg {
  margin: 8px 0 0;
  min-height: 1em;
  color: var(--muted);
  font-size: 0.74rem;
}

.cfg-add__msg.is-error {
  color: var(--red);
}

.cfg-add__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
}

.rc-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 10px;
}

.rc-results {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.rc-result {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.rc-result:hover {
  background: var(--hover-tint);
}

.rc-result__sub {
  color: var(--muted);
  font-size: 0.72rem;
}

.rc-manual {
  margin-top: 12px;
}

.rc-manual summary {
  color: var(--muted);
  font-size: 0.76rem;
  cursor: pointer;
}

.rc-manual__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 10px;
}

.rc-manual__full {
  grid-column: 1 / -1;
}

@media (max-width: 640px) {
  .rc-manual__grid,
  .rc-search {
    grid-template-columns: 1fr;
  }
}
</style>
