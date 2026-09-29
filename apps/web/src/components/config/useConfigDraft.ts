import { reactive } from 'vue'
import { useExploit } from '@/composables/useExploit'
import { useRain } from '@/composables/useRain'
import { useStations } from '@/composables/useStations'
import { DEFAULT_EXTERNAL_RAIN_DEFS, DEFAULT_STATIONS } from '@/domain/constants'
import type { ExploitConfig, RainPointDef, Station } from '@/domain/types'

export interface ConfigDraft {
  stations: Station[]
  exploit: ExploitConfig
  rainHidden: string[]
  rainExternal: RainPointDef[]
}

function cloneStations(list: Station[]): Station[] {
  return list.map((s) => ({
    ...s,
    thresholds: { level: { ...s.thresholds.level }, flow: { ...s.thresholds.flow } },
  }))
}

/**
 * Etat brouillon de la modale : toutes les modifications sont locales jusqu'au
 * `commit()`. `cancel()` recharge simplement l'etat persiste.
 */
export function useConfigDraft() {
  const stationsStore = useStations()
  const exploitStore = useExploit()
  const rainStore = useRain()

  const draft = reactive<ConfigDraft>({
    stations: [],
    exploit: { ...exploitStore.exploit.value },
    rainHidden: [],
    rainExternal: [],
  })

  function reset() {
    draft.stations = cloneStations(stationsStore.stations.value)
    draft.exploit = { ...exploitStore.exploit.value }
    draft.rainHidden = [...rainStore.hiddenKeys.value]
    draft.rainExternal = rainStore.externalDefs.value.map((d) => ({ ...d }))
  }

  reset()

  function resetStations() {
    draft.stations = cloneStations(DEFAULT_STATIONS)
  }

  function resetRainExternal() {
    draft.rainExternal = DEFAULT_EXTERNAL_RAIN_DEFS.map((d) => ({ ...d }))
  }

  function setHidden(key: string, hidden: boolean) {
    const set = new Set(draft.rainHidden)
    if (hidden) set.add(key)
    else set.delete(key)
    draft.rainHidden = [...set]
  }

  /** Retourne le message d'erreur bloquant, ou `null` si la configuration est appliquee. */
  function commit(): string | null {
    const error = exploitStore.commit(draft.exploit)
    if (error) return error

    stationsStore.stations.value = cloneStations(draft.stations)
    stationsStore.syncStates()

    rainStore.externalDefs.value = draft.rainExternal.map((d) => ({ ...d }))
    rainStore.hiddenKeys.value = [...draft.rainHidden]
    rainStore.syncStates()

    reset()
    return null
  }

  return { draft, reset, cancel: reset, commit, resetStations, resetRainExternal, setHidden }
}
