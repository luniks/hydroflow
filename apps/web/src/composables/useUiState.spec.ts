import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { partialState, useApiHealth } from './useApiHealth'
import { useAutoRefresh } from './useAutoRefresh'
import { installMatchMedia, setSystemTheme } from '@/test/matchMedia'
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
  const attr = () => document.documentElement.getAttribute('data-theme')

  beforeEach(() => theme.set('system'))

  it('suit le thème du système par défaut', () => {
    expect(theme.preference.value).toBe('system')
    expect(theme.theme.value).toBe('dark')
  })

  it('réagit en direct aux changements du système', () => {
    setSystemTheme('light')
    expect(theme.theme.value).toBe('light')
    expect(attr()).toBe('light')
    setSystemTheme('dark')
    expect(attr()).toBe('dark')
  })

  it('ignore le système quand un thème est imposé', () => {
    theme.set('light')
    setSystemTheme('dark')
    expect(theme.theme.value).toBe('light')
    expect(attr()).toBe('light')
  })

  it('reprend le thème du système en repassant en automatique', () => {
    theme.set('dark')
    setSystemTheme('light')
    expect(attr()).toBe('dark')
    theme.set('system')
    expect(attr()).toBe('light')
  })

  it('enchaîne automatique → clair → sombre → automatique', () => {
    theme.toggle()
    expect(theme.preference.value).toBe('light')
    expect(attr()).toBe('light')
    theme.toggle()
    expect(theme.preference.value).toBe('dark')
    expect(attr()).toBe('dark')
    theme.toggle()
    expect(theme.preference.value).toBe('system')
  })

  it('persiste le réglage sous la clé legacy', async () => {
    theme.set('light')
    await nextTick()
    expect(localStorage.getItem('ui_theme')).toBe('light')
    theme.set('system')
    await nextTick()
    expect(localStorage.getItem('ui_theme')).toBe('system')
  })
})

describe('useTheme · démarrage', () => {
  afterEach(() => {
    vi.resetModules()
    installMatchMedia()
  })

  const fresh = async () => (await import('./useTheme')).useTheme()

  it('conserve le thème imposé par un utilisateur existant', async () => {
    localStorage.setItem('ui_theme', 'light')
    vi.resetModules()
    const t = await fresh()
    expect(t.preference.value).toBe('light')
    expect(t.theme.value).toBe('light')
  })

  it('retombe sur l’automatique quand la valeur enregistrée est invalide', async () => {
    localStorage.setItem('ui_theme', 'auto')
    vi.resetModules()
    const t = await fresh()
    expect(t.preference.value).toBe('system')
  })

  it('démarre sur le thème clair du système', async () => {
    setSystemTheme('light')
    vi.resetModules()
    const t = await fresh()
    expect(t.theme.value).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('retombe sur le sombre quand le navigateur ne sait pas lire le thème du système', async () => {
    // @ts-expect-error simulation d'un navigateur sans matchMedia
    delete window.matchMedia
    vi.resetModules()
    const t = await fresh()
    expect(t.theme.value).toBe('dark')
  })
})
