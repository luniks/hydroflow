import { onScopeDispose, watch } from 'vue'
import { AUTO_REFRESH_OPTIONS, STORAGE_KEYS } from '@/domain/constants'
import { useLocalStorage } from './useLocalStorage'

const minutes = useLocalStorage<number>(STORAGE_KEYS.autoRefresh, 10, {
  serialize: String,
  deserialize: (raw) => Number.parseInt(raw, 10),
  parse: (raw) =>
    typeof raw === 'number' && (AUTO_REFRESH_OPTIONS as readonly number[]).includes(raw)
      ? raw
      : null,
})

/** Intervalle partagé, sans minuteur : pour les composants qui ne font que le lire/l'écrire. */
export function useAutoRefreshSetting() {
  return {
    minutes,
    options: AUTO_REFRESH_OPTIONS,
    set: (value: number) => {
      minutes.value = value
    },
  }
}

/** `callback` est relance a chaque changement d'intervalle ; 0 desactive le rafraichissement. */
export function useAutoRefresh(callback: () => void) {
  let timer: ReturnType<typeof setInterval> | null = null

  const stop = () => {
    if (timer !== null) clearInterval(timer)
    timer = null
  }

  const restart = () => {
    stop()
    if (minutes.value > 0) timer = setInterval(callback, minutes.value * 60_000)
  }

  watch(minutes, restart, { immediate: true, flush: 'sync' })
  onScopeDispose(stop)

  return {
    minutes,
    options: AUTO_REFRESH_OPTIONS,
    set: (value: number) => {
      minutes.value = value
    },
    stop,
  }
}
