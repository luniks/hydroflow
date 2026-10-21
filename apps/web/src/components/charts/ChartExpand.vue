<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'

const props = withDefaults(defineProps<{ title: string; subtitle?: string; heightRatio?: number; minHeight?: number }>(), {
  heightRatio: 0.5,
  minHeight: 240,
})

// La modale expose ses dimensions réelles : le graphique est recalculé en pixels (viewBox 1:1),
// à partir des mêmes données, donc sans appel API ni déformation.
const dialogRef = ref<HTMLDialogElement | null>(null)
const bodyRef = ref<HTMLElement | null>(null)
const open = ref(false)
const size = ref({ width: 0, height: 0 })
let observer: ResizeObserver | null = null
let opener: HTMLElement | null = null

function measure() {
  const el = bodyRef.value
  if (!el) return
  const width = Math.floor(el.clientWidth)
  const height = Math.floor(Math.min(width * props.heightRatio, window.innerHeight * 0.65))
  size.value = { width, height: Math.max(height, props.minHeight) }
}

async function show(event: Event) {
  opener = event.currentTarget as HTMLElement
  open.value = true
  await nextTick()
  dialogRef.value?.showModal()
  measure()
  if (bodyRef.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure)
    observer.observe(bodyRef.value)
  }
}

function close() {
  dialogRef.value?.close()
}

function onClosed() {
  observer?.disconnect()
  observer = null
  open.value = false
  opener?.focus()
}

function onBackdrop(event: MouseEvent) {
  if (event.target === dialogRef.value) close()
}

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <button type="button" class="chart__expand" aria-label="Agrandir le graphique" title="Agrandir" @click.stop="show">
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9.5 2H14v4.5M6.5 14H2V9.5M14 2 9 7M2 14l5-5" />
    </svg>
  </button>

  <dialog v-if="open" ref="dialogRef" class="chart__dialog" :aria-label="title" @close="onClosed" @click.stop="onBackdrop">
    <header class="chart__dialog-head">
      <div class="chart__dialog-titles">
        <h2>{{ title }}</h2>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <button type="button" class="chart__expand chart__expand--static" aria-label="Fermer" title="Fermer (Échap)" @click.stop="close">
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <path d="M3 3l10 10M13 3 3 13" />
        </svg>
      </button>
    </header>
    <div ref="bodyRef" class="chart__dialog-body">
      <slot v-if="size.width > 0" :width="size.width" :height="size.height" />
    </div>
  </dialog>
</template>

<style scoped>
.chart__expand {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  color: var(--muted);
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-chip);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}

@media (hover: none) {
  .chart__expand {
    opacity: 0.85;
  }
}

.chart__expand--static {
  position: static;
  opacity: 1;
}

.chart__dialog {
  width: min(1100px, 94vw);
  max-width: none;
  max-height: 94vh;
  margin: auto;
  inset: 0;
  padding: 16px;
  color: inherit;
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: 12px;
}

.chart__dialog::backdrop {
  background: rgb(0 0 0 / 0.55);
}

.chart__dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.chart__dialog-head h2 {
  margin: 0;
  font-size: 1rem;
}

.chart__dialog-head p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 0.8rem;
}
</style>

<style>
.chart__wrap:hover > .chart__expand,
.chart__wrap > .chart__expand:focus-visible {
  opacity: 1;
}
</style>
