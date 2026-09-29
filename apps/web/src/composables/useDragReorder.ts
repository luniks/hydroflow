import { ref } from 'vue'

/**
 * Reordonnancement par glisser-deposer sur une liste identifiee par cle.
 * Base sur les Pointer Events (souris/tactile/stylet unifies) pour un suivi fiable du curseur,
 * plutot que le DnD HTML5 dont le ghost natif est peu controlable.
 * Le composant appelle `onReorder(from, to)` pour appliquer le deplacement.
 */
export function useDragReorder(getKeys: () => string[], onReorder: (from: number, to: number) => void) {
  const draggingKey = ref<string | null>(null)
  const overKey = ref<string | null>(null)
  const dragOffsetY = ref(0)
  let startY = 0

  function start(key: string, event: PointerEvent) {
    event.preventDefault()
    draggingKey.value = key
    overKey.value = null
    dragOffsetY.value = 0
    startY = event.clientY
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  }

  function move(event: PointerEvent) {
    if (!draggingKey.value) return
    dragOffsetY.value = event.clientY - startY
    // La capture du pointeur redirige les evenements vers la poignee : on cherche la ligne sous le curseur manuellement.
    const target = document.elementFromPoint(event.clientX, event.clientY)
    const row = target instanceof Element ? target.closest<HTMLElement>('[data-code]') : null
    const code = row?.dataset.code
    overKey.value = code && code !== draggingKey.value ? code : null
  }

  function end(event?: PointerEvent) {
    const source = draggingKey.value
    const target = overKey.value
    if (event) (event.currentTarget as Element).releasePointerCapture(event.pointerId)
    draggingKey.value = null
    overKey.value = null
    dragOffsetY.value = 0
    if (!source || !target || source === target) return
    const keys = getKeys()
    const from = keys.indexOf(source)
    const to = keys.indexOf(target)
    if (from < 0 || to < 0) return
    onReorder(from, to)
  }

  function cancel() {
    draggingKey.value = null
    overKey.value = null
    dragOffsetY.value = 0
  }

  return { draggingKey, overKey, dragOffsetY, start, move, end, cancel }
}

