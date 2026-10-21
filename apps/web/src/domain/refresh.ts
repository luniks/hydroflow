const MINUTE_MS = 60_000

/**
 * Faut-il relancer un chargement (retour sur l'onglet, reseau retabli) ?
 * Oui si le rafraichissement automatique est actif et que les donnees ont au moins l'age d'un intervalle,
 * ou n'ont jamais pu etre chargees. Un intervalle a 0 desactive tout rechargement automatique.
 */
export function needsRefresh(lastUpdateMs: number | null, intervalMin: number, nowMs: number): boolean {
  if (intervalMin <= 0) return false
  if (lastUpdateMs === null) return true
  return nowMs - lastUpdateMs >= intervalMin * MINUTE_MS
}
