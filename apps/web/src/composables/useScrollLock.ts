/**
 * Verrou de défilement de la page, avec compteur (modales imbriquées).
 * `html` a `overflow-x: auto` : `body` n'est alors plus propagé au viewport,
 * il faut donc verrouiller les deux éléments.
 */
let locks = 0
let saved: { html: string; body: string } | null = null

/** Verrouille le défilement ; renvoie une fonction de libération idempotente. */
export function acquireScrollLock(): () => void {
  if (locks === 0) {
    const html = document.documentElement
    const body = document.body
    saved = { html: html.style.overflow, body: body.style.overflow }
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
  }
  locks++
  let released = false
  return () => {
    if (released) return
    released = true
    locks--
    if (locks === 0 && saved) {
      document.documentElement.style.overflow = saved.html
      document.body.style.overflow = saved.body
      saved = null
    }
  }
}
