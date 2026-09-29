import { computed, ref } from 'vue'
import { DEFAULT_RANGE_HOURS, RANGES, STORAGE_KEYS } from '@/domain/constants'
import { computeWindow } from '@/domain/series'
import { useLocalStorage } from './useLocalStorage'

const hours = useLocalStorage<number>(STORAGE_KEYS.rangeHours, DEFAULT_RANGE_HOURS, {
  serialize: String,
  deserialize: (raw) => Number.parseInt(raw, 10),
  parse: (raw) =>
    typeof raw === 'number' && RANGES.some((r) => r.hours === raw) ? raw : null,
})

/** Nombre de pas (de la duree selectionnee) remontes dans le passe. 0 = direct. */
const offsetSteps = ref(0)

export function useTimeRange() {
  const range = computed(() => RANGES.find((r) => r.hours === hours.value) ?? RANGES[2])
  const isLive = computed(() => offsetSteps.value === 0)
  const window = computed(() => computeWindow(hours.value, offsetSteps.value))

  return {
    hours,
    offsetSteps,
    range,
    isLive,
    window,
    ranges: RANGES,
    setHours(value: number) {
      if (!RANGES.some((r) => r.hours === value)) return
      hours.value = value
      offsetSteps.value = 0
    },
    prev: () => {
      offsetSteps.value += 1
    },
    next: () => {
      if (offsetSteps.value > 0) offsetSteps.value -= 1
    },
    now: () => {
      offsetSteps.value = 0
    },
  }
}
