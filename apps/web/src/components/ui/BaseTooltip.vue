<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'

withDefaults(defineProps<{ placement?: 'top' | 'bottom' }>(), { placement: 'bottom' })

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const shiftX = ref(0)
const id = useId()

const style = computed(() => ({ transform: `translateX(calc(-50% + ${shiftX.value}px))` }))

/** Décale l'infobulle pour qu'elle reste dans la fenêtre (auto-flip horizontal). */
function reposition() {
  shiftX.value = 0
  requestAnimationFrame(() => {
    const el = root.value?.querySelector<HTMLElement>('.ui-tooltip__bubble')
    if (!el) return
    const rect = el.getBoundingClientRect()
    const margin = 8
    // Dans une modale, on borne par le panneau (la bulle ne doit pas le déborder) ; sinon par la fenêtre.
    const bounds = root.value?.closest('[role="dialog"]')?.getBoundingClientRect()
    const minX = (bounds?.left ?? 0) + margin
    const maxX = (bounds?.right ?? window.innerWidth) - margin
    if (rect.left < minX) shiftX.value = minX - rect.left
    else if (rect.right > maxX) shiftX.value = maxX - rect.right
  })
}

function show() {
  open.value = true
  reposition()
}

/** Tactile : un tap hors de l'infobulle ne retire pas toujours le focus (Safari), on ferme explicitement. */
function onOutsidePointer(e: Event) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}
function onEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', onOutsidePointer)
    document.addEventListener('keydown', onEscape)
  } else {
    document.removeEventListener('pointerdown', onOutsidePointer)
    document.removeEventListener('keydown', onEscape)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsidePointer)
  document.removeEventListener('keydown', onEscape)
})
</script>

<template>
  <span
    ref="root"
    class="ui-tooltip"
    @mouseenter="show"
    @mouseleave="open = false"
    @focusin="show"
    @focusout="open = false"
  >
    <span class="ui-tooltip__anchor" :aria-describedby="open ? id : undefined">
      <slot />
    </span>
    <span
      v-if="open"
      :id="id"
      role="tooltip"
      class="ui-tooltip__bubble"
      :class="`ui-tooltip__bubble--${placement}`"
      :style="style"
    >
      <slot name="content" />
    </span>
  </span>
</template>

<style scoped>
.ui-tooltip {
  position: relative;
  display: inline-flex;
}

.ui-tooltip__bubble {
  position: absolute;
  left: 50%;
  z-index: var(--z-tooltip);
  min-width: 160px;
  max-width: min(280px, 90vw);
  padding: 8px 10px;
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-tooltip);
  color: var(--text);
  font-size: 0.74rem;
  font-weight: 400;
  line-height: 1.45;
  text-align: left;
  pointer-events: none;
}

.ui-tooltip__bubble--bottom {
  top: calc(100% + 6px);
}

.ui-tooltip__bubble--top {
  bottom: calc(100% + 6px);
}
</style>
