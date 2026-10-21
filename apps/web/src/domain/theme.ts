import type { ThemeName, ThemePreference } from './types'

/** Ordre du bouton : automatique (systeme) -> clair -> sombre -> automatique. */
export const THEME_CYCLE: readonly ThemePreference[] = ['system', 'light', 'dark']

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

/** Theme effectivement affiche : le theme impose, ou celui du systeme. */
export function resolveTheme(preference: ThemePreference, systemDark: boolean): ThemeName {
  if (preference === 'system') return systemDark ? 'dark' : 'light'
  return preference
}

export function nextThemePreference(preference: ThemePreference): ThemePreference {
  return THEME_CYCLE[(THEME_CYCLE.indexOf(preference) + 1) % THEME_CYCLE.length]!
}

/** Libelle du bouton : etat courant, puis action du prochain clic. */
export const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Thème automatique (suit le système) · passer en thème clair',
  light: 'Thème clair · passer en thème sombre',
  dark: 'Thème sombre · revenir au thème automatique',
}

export const THEME_ICONS = { system: 'monitor', light: 'sun', dark: 'moon' } as const
