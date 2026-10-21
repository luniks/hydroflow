import { onScopeDispose } from 'vue'
import { needsRefresh } from '@/domain/refresh'
import { useAutoRefreshSetting } from './useAutoRefresh'
import { useDataLoader } from './useDataLoader'

/**
 * Relance un chargement quand l'utilisateur revient sur l'onglet (ou que le reseau revient) si les donnees
 * sont plus vieilles que l'intervalle de rafraichissement : les minuteurs sont suspendus en arriere-plan
 * et en veille, sans cela les graphiques restent figes jusqu'au prochain tick.
 */
export function useRefreshOnReturn() {
  const { minutes } = useAutoRefreshSetting()
  const { loading, lastUpdate, loadAll } = useDataLoader()

  const check = () => {
    if (loading.value) return
    if (needsRefresh(lastUpdate.value?.getTime() ?? null, minutes.value, Date.now())) void loadAll()
  }
  const onVisibility = () => {
    if (document.visibilityState === 'visible') check()
  }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('online', check)
  onScopeDispose(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('online', check)
  })
}
