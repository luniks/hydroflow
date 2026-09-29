import { computed, reactive } from 'vue'
import type { ApiHealth } from '@/domain/types'

export type HealthState = ApiHealth | 'unknown'
export type ApiKey = 'hubeau' | 'meteo' | 'vigicrues'

interface Entry {
  label: string
  state: HealthState
  detail: string
}

const health = reactive<Record<ApiKey, Entry>>({
  hubeau: { label: "Hub'Eau — niveaux & débits", state: 'unknown', detail: 'En attente…' },
  meteo: { label: 'Open-Meteo — pluviométrie', state: 'unknown', detail: 'En attente…' },
  vigicrues: { label: 'Vigicrues — vigilance crues', state: 'unknown', detail: 'En attente…' },
})

const STATE_LABEL: Record<HealthState, string> = {
  ok: 'opérationnelle',
  warn: 'partiellement indisponible',
  err: 'en échec',
  unknown: 'état inconnu',
}

const OVERALL_LABEL: Record<HealthState, string> = {
  ok: 'Toutes les sources ont répondu',
  warn: "Une source n'a pas répondu",
  err: "Aucune source n'a répondu",
  unknown: 'État des sources inconnu',
}

/** Agrege les succes/echecs d'un lot de requetes en un etat ok / warn / err. */
export function partialState(okCount: number, total: number): HealthState {
  if (!total) return 'unknown'
  if (okCount === total) return 'ok'
  return okCount === 0 ? 'err' : 'warn'
}

export function useApiHealth() {
  const overall = computed<HealthState>(() => {
    const states = Object.values(health)
      .map((e) => e.state)
      .filter((s) => s !== 'unknown')
    if (!states.length) return 'unknown'
    if (states.every((s) => s === 'ok')) return 'ok'
    if (states.every((s) => s === 'err')) return 'err'
    return 'warn'
  })

  return {
    health,
    overall,
    overallLabel: computed(() => OVERALL_LABEL[overall.value]),
    entries: computed(() =>
      (Object.entries(health) as Array<[ApiKey, Entry]>).map(([key, e]) => ({
        key,
        ...e,
        stateLabel: STATE_LABEL[e.state],
      })),
    ),
    set(key: ApiKey, state: HealthState, detail: string) {
      health[key].state = state
      health[key].detail = detail
    },
  }
}
