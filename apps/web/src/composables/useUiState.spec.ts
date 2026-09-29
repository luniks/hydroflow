import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { partialState, useApiHealth } from './useApiHealth'
import { useAutoRefresh } from './useAutoRefresh'
import { useTheme } from './useTheme'
import { useTimeRange } from './useTimeRange'

describe('partialState', () => {
  it('agrège les succès en ok / warn / err', () => {
    expect(partialState(0, 0)).toBe('unknown')
    expect(partialState(3, 3)).toBe('ok')
    expect(partialState(1, 3)).toBe('warn')
    expect(partialState(0, 3)).toBe('err')
  })
})

describe('useApiHealth', () => {
  const api = useApiHealth()

  beforeEach(() => {
    for (const key of ['hubeau', 'meteo', 'vigicrues'] as const)
      api.set(key, 'unknown', 'En attente…')
  })

  it('reste inconnu tant qu’aucune source n’a répondu', () => {
    expect(api.overall.value).toBe('unknown')
    expect(api.overallLabel.value).toBe('État des sources inconnu')
  })

  it('passe en ok quand toutes les sources connues répondent', () => {
    api.set('hubeau', 'ok', 'ok')
    expect(api.overall.value).toBe('ok')
  })

  it('passe en warn dès qu’une source diverge', () => {
    api.set('hubeau', 'ok', 'ok')
    api.set('meteo', 'err', 'ko')
    expect(api.overall.value).toBe('warn')
  })

  it('passe en err quand toutes les sources connues échouent', () => {
    api.set('hubeau', 'err', 'ko')
    api.set('meteo', 'err', 'ko')
    expect(api.overall.value).toBe('err')
  })

  it('expose un libellé lisible par source', () => {
    api.set('hubeau', 'warn', '1 station en erreur')
    const entry = api.entries.value.find((e) => e.key === 'hubeau')!
    expect(entry.stateLabel).toBe('partiellement indisponible')
    expect(entry.detail).toBe('1 station en erreur')
  })
})

describe('useTimeRange', () => {
  const range = useTimeRange()

  beforeEach(() => {
    range.setHours(24)
  })

  it('démarre en direct sur la plage par défaut', () => {
    expect(range.hours.value).toBe(24)
    expect(range.isLive.value).toBe(true)
    expect(range.window.value.dateFin).toBeNull()
  })

  it('ignore une plage non proposée', () => {
    range.setHours(7)
    expect(range.hours.value).toBe(24)
  })

  it('navigue dans le passé et revient au direct', () => {
    range.prev()
    range.prev()
    expect(range.offsetSteps.value).toBe(2)
    expect(range.isLive.value).toBe(false)
    range.next()
    expect(range.offsetSteps.value).toBe(1)
    range.now()
    expect(range.offsetSteps.value).toBe(0)
  })

  it('ne dépasse pas le présent', () => {
    range.next()
    expect(range.offsetSteps.value).toBe(0)
  })

  it('remet l’offset à zéro au changement de plage', () => {
    range.prev()
    range.setHours(72)
    expect(range.offsetSteps.value).toBe(0)
    expect(range.range.value.label).toBe('3j')
  })

  it('persiste la plage sous la clé legacy', async () => {
    range.setHours(168)
    await nextTick()
    expect(localStorage.getItem('range_hours')).toBe('168')
  })
})

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('déclenche le rappel à l’intervalle choisi', () => {
    const scope = effectScope()
    const cb = vi.fn()
    scope.run(() => {
      const auto = useAutoRefresh(cb)
      auto.set(5)
    })
    vi.advanceTimersByTime(5 * 60_000)
    expect(cb).toHaveBeenCalledTimes(1)
    scope.stop()
    vi.useRealTimers()
  })

  it('arrête le minuteur quand l’intervalle est désactivé', () => {
    const scope = effectScope()
    const cb = vi.fn()
    let auto!: ReturnType<typeof useAutoRefresh>
    scope.run(() => {
      auto = useAutoRefresh(cb)
      auto.set(5)
    })
    auto.set(0)
    vi.advanceTimersByTime(60 * 60_000)
    expect(cb).not.toHaveBeenCalled()
    scope.stop()
    vi.useRealTimers()
  })

  it('arrête le minuteur à la destruction du scope', () => {
    const scope = effectScope()
    const cb = vi.fn()
    scope.run(() => useAutoRefresh(cb).set(5))
    scope.stop()
    vi.advanceTimersByTime(60 * 60_000)
    expect(cb).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('useTheme', () => {
  const theme = useTheme()

  it('bascule entre sombre et clair', () => {
    theme.set('dark')
    theme.toggle()
    expect(theme.theme.value).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    theme.toggle()
    expect(theme.theme.value).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('persiste le thème en clair sous la clé legacy', async () => {
    theme.set('light')
    await nextTick()
    expect(localStorage.getItem('ui_theme')).toBe('light')
    theme.set('dark')
  })
})
