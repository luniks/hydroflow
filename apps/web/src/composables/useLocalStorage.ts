import { ref, watch, type Ref } from 'vue'

interface Options<T> {
  /** Valide la valeur relue ; retourne `null` pour retomber sur la valeur par defaut. */
  parse?: (raw: unknown) => T | null
  serialize?: (value: T) => string
  deserialize?: (raw: string) => unknown
}

/**
 * Ref persistee en localStorage. Une valeur corrompue ou invalide est ignoree
 * silencieusement : l'app repart sur la valeur par defaut plutot que de planter.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options: Options<T> = {},
): Ref<T> {
  const { parse, serialize = JSON.stringify, deserialize = JSON.parse } = options

  const read = (): T => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return defaultValue
      const value = deserialize(raw)
      if (parse) return parse(value) ?? defaultValue
      return value as T
    } catch {
      return defaultValue
    }
  }

  const state = ref(read()) as Ref<T>

  watch(
    state,
    (value) => {
      try {
        localStorage.setItem(key, serialize(value))
      } catch {
        // Quota depasse ou stockage refuse : la session reste fonctionnelle, sans persistance.
      }
    },
    { deep: true },
  )

  return state
}

export function readNumber(key: string, defaultValue: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return defaultValue
    const v = Number.parseFloat(raw)
    return Number.isNaN(v) ? defaultValue : v
  } catch {
    return defaultValue
  }
}

export function writeNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // ignore
  }
}
