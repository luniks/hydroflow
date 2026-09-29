<script setup lang="ts">
import { computed, ref, useId } from 'vue'

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
    if (rect.left < margin) shiftX.value = margin - rect.left
    else if (rect.right > window.innerWidth - margin)
      shiftX.value = window.innerWidth - margin - rect.right
  })
}

function show() {
  open.value = true
  reposition()
}
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
