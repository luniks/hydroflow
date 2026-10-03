<script setup lang="ts">
import { ref, useId } from 'vue'
import BaseIcon from './BaseIcon.vue'
import type { IconName } from './icons'

export interface TabDef {
  id: string
  label: string
  shortLabel?: string
  icon?: IconName
  count?: number
}

const props = defineProps<{ tabs: TabDef[]; label?: string }>()
const active = defineModel<string>({ required: true })

const uid = useId()
const tabRefs = ref<HTMLElement[]>([])

const tabId = (id: string) => `${uid}-tab-${id}`
const panelId = (id: string) => `${uid}-panel-${id}`

function focusAt(index: number) {
  const count = props.tabs.length
  const next = props.tabs[((index % count) + count) % count]
  if (!next) return
  active.value = next.id
  tabRefs.value[((index % count) + count) % count]?.focus()
}

function onKeydown(e: KeyboardEvent, index: number) {
  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault()
      focusAt(index + 1)
      break
    case 'ArrowLeft':
      e.preventDefault()
      focusAt(index - 1)
      break
    case 'Home':
      e.preventDefault()
      focusAt(0)
      break
    case 'End':
      e.preventDefault()
      focusAt(props.tabs.length - 1)
      break
  }
}
</script>

<template>
  <div class="ui-tabs">
    <div class="ui-tabs__list" role="tablist" :aria-label="label">
      <button
        v-for="(tab, index) in tabs"
        :key="tab.id"
        ref="tabRefs"
        type="button"
        role="tab"
        class="ui-tabs__tab"
        :id="tabId(tab.id)"
        :aria-selected="tab.id === active"
        :aria-controls="panelId(tab.id)"
        :tabindex="tab.id === active ? 0 : -1"
        @click="active = tab.id"
        @keydown="onKeydown($event, index)"
      >
        <BaseIcon v-if="tab.icon" :name="tab.icon" />
        <span v-if="tab.shortLabel" class="ui-tabs__label-short">{{ tab.shortLabel }}</span>
        <span :class="tab.shortLabel ? 'ui-tabs__label-full' : undefined">{{ tab.label }}</span>
        <span v-if="tab.count !== undefined" class="ui-tabs__count">{{ tab.count }}</span>
      </button>
    </div>

    <div
      v-for="tab in tabs"
      v-show="tab.id === active"
      :key="tab.id"
      role="tabpanel"
      class="ui-tabs__panel"
      :id="panelId(tab.id)"
      :aria-labelledby="tabId(tab.id)"
      tabindex="0"
    >
      <slot :name="tab.id" />
    </div>
  </div>
</template>

<style scoped>
.ui-tabs__list {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--card-border);
  overflow-x: auto;
}

.ui-tabs__panel {
  padding-top: var(--space-section);
}

.ui-tabs__tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.ui-tabs__tab:hover {
  color: var(--text);
}

.ui-tabs__tab[aria-selected='true'] {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.ui-tabs__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--tint);
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 700;
}

.ui-tabs__tab[aria-selected='true'] .ui-tabs__count {
  background: rgba(56, 189, 248, 0.15);
  color: var(--accent);
}

.ui-tabs__label-full {
  display: none;
}

@media (min-width: 560px) {
  .ui-tabs__label-short {
    display: none;
  }

  .ui-tabs__label-full {
    display: inline;
  }
}

.ui-tabs__panel {
  padding-top: var(--space-section);
}

.ui-tabs__panel:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
