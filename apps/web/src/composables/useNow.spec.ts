import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, type EffectScope } from 'vue'
import { refreshNow, useNow } from './useNow'

const T0 = Date.parse('2026-11-14T10:00:00Z')
const MIN = 60_000
let scope: EffectScope

const setVisibility = (state: 'visible' | 'hidden') =>
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
  vi.useRealTimers()
})

describe('useNow', () => {
  it('avance d’une minute à chaque tick', () => {
    const { nowMs } = scope.run(() => useNow())!
    expect(nowMs.value).toBe(T0)
    vi.advanceTimersByTime(MIN)
    expect(nowMs.value).toBe(T0 + MIN)
  })

  it('est partagée : tous les appelants lisent la même valeur', () => {
    const a = scope.run(() => useNow())!
    const b = scope.run(() => useNow())!
    vi.setSystemTime(T0 + 30 * MIN)
    a.refreshNow()
    expect(b.nowMs.value).toBe(T0 + 30 * MIN)
  })

  it('refreshNow resynchronise sans attendre le tick (minuteur ralenti en arrière-plan)', () => {
    const { nowMs } = scope.run(() => useNow())!
    vi.setSystemTime(T0 + 25 * MIN) // l'horloge réelle avance, le minuteur ne tourne pas
    expect(nowMs.value).toBe(T0)
    refreshNow()
    expect(nowMs.value).toBe(T0 + 25 * MIN)
  })

  it('se resynchronise au retour sur l’onglet, au retour du réseau et au focus', () => {
    const { nowMs } = scope.run(() => useNow())!

    vi.setSystemTime(T0 + 10 * MIN)
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(nowMs.value).toBe(T0 + 10 * MIN)

    vi.setSystemTime(T0 + 20 * MIN)
    window.dispatchEvent(new Event('online'))
    expect(nowMs.value).toBe(T0 + 20 * MIN)

    vi.setSystemTime(T0 + 30 * MIN)
    window.dispatchEvent(new Event('focus'))
    expect(nowMs.value).toBe(T0 + 30 * MIN)
  })

  it('ignore visibilitychange quand l’onglet passe en arrière-plan', () => {
    const { nowMs } = scope.run(() => useNow())!
    vi.setSystemTime(T0 + 10 * MIN)
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(nowMs.value).toBe(T0)
    setVisibility('visible')
  })

  it('libère le minuteur et les écouteurs avec le dernier appelant', () => {
    const s2 = effectScope()
    scope.run(() => useNow())
    s2.run(() => useNow())
    expect(vi.getTimerCount()).toBe(1)
    scope.stop()
    expect(vi.getTimerCount()).toBe(1)
    s2.stop()
    expect(vi.getTimerCount()).toBe(0)
    scope = effectScope()
  })
})
