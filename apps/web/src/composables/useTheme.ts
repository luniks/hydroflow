import { watch } from 'vue'
import { STORAGE_KEYS } from '@/domain/constants'
import type { ThemeName } from '@/domain/types'
import { useLocalStorage } from './useLocalStorage'

const theme = useLocalStorage<ThemeName>(STORAGE_KEYS.theme, 'dark', {
  serialize: (v) => v,
  deserialize: (raw) => raw,
  parse: (raw) => (raw === 'light' || raw === 'dark' ? raw : null),
})

function apply(value: ThemeName) {
  document.documentElement.setAttribute('data-theme', value)
}

watch(theme, apply, { immediate: true, flush: 'sync' })

export function useTheme() {
  return {
    theme,
    toggle: () => {
      theme.value = theme.value === 'dark' ? 'light' : 'dark'
    },
    set: (value: ThemeName) => {
      theme.value = value
    },
  }
}
