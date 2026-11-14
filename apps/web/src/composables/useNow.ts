import { getCurrentScope, onScopeDispose, readonly, ref } from 'vue'

/** Intervalle du tick : l'état de prévision (marche/arrêt, délais, courbe) se recalcule à la minute. */
const TICK_MS = 60_000

const now = ref(Date.now())
let users = 0
let timer: ReturnType<typeof setInterval> | null = null

/** Resynchronise l'horloge partagée sur l'heure réelle (à appeler dès que des données fraîches arrivent). */
export function refreshNow(): void {
  now.value = Date.now()
}

const onVisibility = () => {
  if (document.visibilityState === 'visible') refreshNow()
}

function start() {
  refreshNow()
  timer = setInterval(refreshNow, TICK_MS)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('online', refreshNow)
  window.addEventListener('focus', refreshNow)
}

function stop() {
  if (timer) clearInterval(timer)
  timer = null
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('online', refreshNow)
  window.removeEventListener('focus', refreshNow)
}

/**
 * Horloge partagée (singleton). Les minuteurs sont ralentis en arrière-plan : on la resynchronise aussi au
 * retour sur l'onglet, au retour du réseau et au focus, et après chaque chargement (`refreshNow`), pour que
 * les données fraîches ne soient jamais lues avec un instant périmé.
 */
export function useNow() {
  if (users++ === 0) start()
  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (--users === 0) stop()
    })
  }
  return { nowMs: readonly(now), refreshNow }
}
