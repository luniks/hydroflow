import { afterEach, describe, expect, it, vi } from 'vitest'
import indexHtml from '../../index.html?raw'
import { installMatchMedia, setSystemTheme } from '@/test/matchMedia'

/** Le script inline de index.html applique le thème avant le premier rendu : il doit rester aligné sur useTheme. */
const script = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)?.[1]
const run = () => new Function(script!)()
const attr = () => document.documentElement.getAttribute('data-theme')

afterEach(() => {
  vi.restoreAllMocks()
  installMatchMedia()
})

describe('script de démarrage (index.html)', () => {
  it('est présent et déclare le schéma de couleurs de la page', () => {
    expect(script).toBeTruthy()
    expect(indexHtml).toContain('<meta name="color-scheme" content="dark light"')
  })

  it('suit le thème du système sans réglage enregistré', () => {
    run()
    expect(attr()).toBe('dark')
    setSystemTheme('light')
    run()
    expect(attr()).toBe('light')
  })

  it('respecte un thème imposé, même opposé à celui du système', () => {
    localStorage.setItem('ui_theme', 'light')
    run()
    expect(attr()).toBe('light')

    setSystemTheme('light')
    localStorage.setItem('ui_theme', 'dark')
    run()
    expect(attr()).toBe('dark')
  })

  it('ignore une valeur enregistrée invalide ou « system »', () => {
    setSystemTheme('light')
    for (const saved of ['system', 'junk', '']) {
      localStorage.setItem('ui_theme', saved)
      run()
      expect(attr()).toBe('light')
    }
  })

  it('retombe sur le sombre sans matchMedia', () => {
    // @ts-expect-error simulation d'un navigateur sans matchMedia
    delete window.matchMedia
    run()
    expect(attr()).toBe('dark')
  })

  it('ne plante pas quand le stockage est inaccessible', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(run).not.toThrow()
    expect(attr()).toBeNull()
  })

  it('donne le même résultat que useTheme pour toutes les combinaisons', async () => {
    for (const saved of [null, 'light', 'dark', 'system', 'junk']) {
      for (const system of ['dark', 'light'] as const) {
        document.documentElement.removeAttribute('data-theme')
        localStorage.clear()
        if (saved !== null) localStorage.setItem('ui_theme', saved)
        setSystemTheme(system)

        run()
        const fromScript = attr()

        vi.resetModules()
        const { useTheme } = await import('./useTheme')
        expect(useTheme().theme.value, `saved=${saved} system=${system}`).toBe(fromScript)
      }
    }
  })
})
