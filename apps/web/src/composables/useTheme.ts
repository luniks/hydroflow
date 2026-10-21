import { computed, ref, watch } from 'vue'
import { STORAGE_KEYS } from '@/domain/constants'
import { isThemePreference, nextThemePreference, resolveTheme } from '@/domain/theme'
import type { ThemePreference } from '@/domain/types'
import { useLocalStorage } from './useLocalStorage'

/**
 * Un theme enregistre (« light » / « dark », choisi avec le bouton) reste impose ; sans reglage,
 * le theme suit celui du systeme, y compris quand celui-ci change pendant que l'app est ouverte.
 */
const preference = useLocalStorage<ThemePreference>(STORAGE_KEYS.theme, 'system', {
  serialize: (v) => v,
  deserialize: (raw) => raw,
  parse: (raw) => (isThemePreference(raw) ? raw : null),
})

// Sans matchMedia (navigateur tres ancien), on retombe sur le sombre, ancien theme par defaut.
const systemQuery =
  typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const systemDark = ref(systemQuery?.matches ?? true)
systemQuery?.addEventListener('change', (e) => {
  systemDark.value = e.matches
})

/** Theme effectivement affiche (jamais « system »). */
const theme = computed(() => resolveTheme(preference.value, systemDark.value))

watch(
  theme,
  (value) => document.documentElement.setAttribute('data-theme', value),
  { immediate: true, flush: 'sync' },
)

export function useTheme() {
  return {
    theme,
    preference,
    toggle: () => {
      preference.value = nextThemePreference(preference.value)
    },
    set: (value: ThemePreference) => {
      preference.value = value
    },
  }
}
