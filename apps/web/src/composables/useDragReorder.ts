import { ref } from 'vue'

/**
 * Reordonnancement par glisser-deposer sur une liste identifiee par cle.
 * Le composant appelle `onReorder(from, to)` pour appliquer le deplacement.
 */
export function useDragReorder(getKeys: () => string[], onReorder: (from: number, to: number) => void) {
  const draggingKey = ref<string | null>(null)
  const overKey = ref<string | null>(null)

  function start(key: string, event: DragEvent) {
    draggingKey.value = key
    overKey.value = null
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', key)
    }
  }

  function over(key: string, event: DragEvent) {
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    if (draggingKey.value && key !== draggingKey.value) overKey.value = key
  }

  function leave(key: string) {
    if (overKey.value === key) overKey.value = null
  }

  function drop(key: string, event: DragEvent) {
    event.preventDefault()
    const source = draggingKey.value
    end()
    if (!source || source === key) return
    const keys = getKeys()
    const from = keys.indexOf(source)
    const to = keys.indexOf(key)
    if (from < 0 || to < 0) return
    onReorder(from, to)
  }

  function end() {
    draggingKey.value = null
    overKey.value = null
  }

  return { draggingKey, overKey, start, over, leave, drop, end }
}
