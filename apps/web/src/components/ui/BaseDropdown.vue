<script setup lang="ts" generic="T extends string | number">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import BaseIcon from './BaseIcon.vue'
import type { IconName } from './icons'
import type { SelectOption } from './types'

const props = defineProps<{
  options: SelectOption<T>[]
  label?: string
  icon?: IconName
  disabled?: boolean
  customText?: string
}>()

const selected = defineModel<T>({ required: true })

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const currentLabel = computed(
  () => props.customText ?? props.options.find((o) => o.value === selected.value)?.label ?? '—',
)

function choose(option: SelectOption<T>) {
  selected.value = option.value
  open.value = false
}

function onDocumentClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="ui-dropdown">
    <button
      type="button"
      class="ui-dropdown__trigger"
      :disabled="disabled"
      :aria-expanded="open"
      :aria-label="label"
      aria-haspopup="listbox"
      @click="open = !open"
    >
      <BaseIcon v-if="icon" :name="icon" />
      <div v-if="label" class="text-[color:var(--muted)] font-semibold whitespace-nowrap">{{label}}</div>
      <span class="ui-dropdown__value">{{ currentLabel }}</span>
      <BaseIcon name="chevDown" class="ui-dropdown__chevron" />
    </button>

    <ul v-if="open" class="ui-dropdown__menu" role="listbox" :aria-label="label">
      <li v-for="option in options" :key="String(option.value)" role="none">
        <button
          type="button"
          role="option"
          class="ui-dropdown__option"
          :aria-selected="option.value === selected"
          @click="choose(option)"
        >
          <span>{{ option.label }}</span>
          <small v-if="option.description">{{ option.description }}</small>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ui-dropdown {
  position: relative;
  display: inline-flex;
  min-width: 0;
}

.ui-dropdown__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--btn-radius, var(--radius-control));
  color: var(--text);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  box-sizing: border-box;
}

.ui-dropdown__trigger:hover:not(:disabled) {
  border-color: var(--accent);
}

.ui-dropdown__trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ui-dropdown__value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-dropdown__chevron {
  color: var(--muted);
  flex-shrink: 0;
}

.ui-dropdown__menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: var(--z-dropdown);
  min-width: 100%;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-dropdown);
}

.ui-dropdown__option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 6px 10px;
  background: none;
  border: none;
  border-radius: var(--radius-chip);
  color: var(--text);
  font: inherit;
  font-size: 0.8rem;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.ui-dropdown__option:hover {
  background: var(--hover-tint);
}

.ui-dropdown__option[aria-selected='true'] {
  color: var(--accent);
  font-weight: 600;
}

.ui-dropdown__option small {
  color: var(--muted);
  font-weight: 400;
}

@media (max-width: 640px) {
  .ui-dropdown__trigger {
    height: 40px;
  }
}
</style>
