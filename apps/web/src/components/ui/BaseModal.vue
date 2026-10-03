<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import BaseButton from './BaseButton.vue'
import BaseIcon from './BaseIcon.vue'
import type { IconName } from './icons'

const props = withDefaults(
  defineProps<{ open: boolean; title: string; subtitle?: string; icon?: IconName; width?: string }>(),
  { width: '720px' },
)

const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
const titleId = useId()
let previousFocus: HTMLElement | null = null

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  if (!panel.value) return []
  return Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE))
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
    return
  }
  if (e.key !== 'Tab') return
  const items = focusables()
  if (items.length === 0) return
  const first = items[0]!
  const last = items[items.length - 1]!
  const active = document.activeElement as HTMLElement | null
  if (e.shiftKey && (active === first || !panel.value?.contains(active))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

function lockScroll(locked: boolean) {
  document.body.style.overflow = locked ? 'hidden' : ''
}

watch(
  () => props.open,
  async (open) => {
    lockScroll(open)
    if (open) {
      previousFocus = document.activeElement as HTMLElement | null
      await nextTick()
      ;(focusables()[0] ?? panel.value)?.focus()
    } else {
      previousFocus?.focus()
      previousFocus = null
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => lockScroll(false))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="ui-modal" @keydown="onKeydown">
      <div class="ui-modal__overlay" @click="emit('close')" />
      <div
        ref="panel"
        class="ui-modal__panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :style="{ maxWidth: width }"
        tabindex="-1"
      >
        <header class="ui-modal__head">
          <div class="ui-modal__head-main">
            <div v-if="icon" class="ui-modal__icon"><BaseIcon :name="icon" :size="18" /></div>
            <div class="ui-modal__head-text">
              <h2 :id="titleId" class="ui-modal__title">{{ title }}</h2>
              <p v-if="subtitle" class="ui-modal__subtitle">{{ subtitle }}</p>
            </div>
          </div>
          <BaseButton variant="icon" icon="x" aria-label="Fermer" @click="emit('close')" />
        </header>
        <div class="ui-modal__body"><slot /></div>
        <footer v-if="$slots.footer" class="ui-modal__foot"><slot name="footer" /></footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ui-modal {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: 16px;
}

.ui-modal__overlay {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 55%);
}

.ui-modal__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  /* Hauteur fixe pour éviter que la modale ne redimensionne en changeant d'onglet. */
  height: min(680px, calc(100dvh - 32px));
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-dropdown);
}

.ui-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px var(--space-card);
  border-bottom: 1px solid var(--card-border);
}

.ui-modal__head-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.ui-modal__icon {
  display: flex;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: var(--accent);
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid var(--accent);
}

.ui-modal__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.ui-modal__subtitle {
  margin: 0;
  font-size: 0.72rem;
  color: var(--muted);
}

.ui-modal__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--space-card);
}

.ui-modal__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px var(--space-card);
  border-top: 1px solid var(--card-border);
}

/* Mobile : la modale occupe tout l'écran, comme dans legacy/index.html */
@media (max-width: 640px) {
  .ui-modal {
    padding: 0;
    place-items: stretch;
  }

  .ui-modal__panel {
    width: 100%;
    max-width: none !important;
    height: 100dvh;
    border: 0;
    border-radius: 0;
  }

  .ui-modal__subtitle {
    display: none;
  }

  .ui-modal__foot {
    position: sticky;
    bottom: 0;
    flex-wrap: wrap;
    padding: 12px var(--space-card) calc(12px + env(safe-area-inset-bottom, 0px));
    background: var(--card);
  }

  .ui-modal__foot button {
    flex: 1 1 0;
    height: 44px;
  }
}
</style>
