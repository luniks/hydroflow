import { describe, expect, it } from 'vitest'
import {
  isThemePreference,
  nextThemePreference,
  resolveTheme,
  THEME_CYCLE,
  THEME_ICONS,
  THEME_LABELS,
} from './theme'

describe('resolveTheme', () => {
  it('suit le système en mode automatique', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('ignore le système quand un thème est imposé', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('nextThemePreference', () => {
  it('enchaîne automatique → clair → sombre → automatique', () => {
    expect(nextThemePreference('system')).toBe('light')
    expect(nextThemePreference('light')).toBe('dark')
    expect(nextThemePreference('dark')).toBe('system')
  })

  it('revient au point de départ après un tour complet', () => {
    let p = THEME_CYCLE[0]!
    for (let i = 0; i < THEME_CYCLE.length; i++) p = nextThemePreference(p)
    expect(p).toBe(THEME_CYCLE[0])
  })
})

describe('isThemePreference', () => {
  it('accepte les trois réglages et rejette le reste', () => {
    for (const v of ['system', 'light', 'dark']) expect(isThemePreference(v)).toBe(true)
    for (const v of ['auto', '', null, undefined, 1, 'Dark']) expect(isThemePreference(v)).toBe(false)
  })
})

describe('libellés et icônes du bouton', () => {
  it('couvrent chaque réglage', () => {
    for (const p of THEME_CYCLE) {
      expect(THEME_LABELS[p]).toBeTruthy()
      expect(THEME_ICONS[p]).toBeTruthy()
    }
  })

  it('annoncent le réglage courant puis l’action du prochain clic', () => {
    expect(THEME_LABELS.system).toContain('automatique')
    expect(THEME_LABELS.system).toContain('passer en thème clair')
    expect(THEME_LABELS.light).toContain('passer en thème sombre')
    expect(THEME_LABELS.dark).toContain('revenir au thème automatique')
  })
})
