import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useTheme } from '@/composables/useTheme'
import BaseButton from '../ui/BaseButton.vue'
import AppHeader from './AppHeader.vue'

const theme = useTheme()

beforeEach(() => theme.set('system'))

function themeButton(wrapper: ReturnType<typeof mount>) {
  const found = wrapper.findAllComponents(BaseButton).find((b) => b.attributes('aria-label')?.startsWith('Thème'))
  expect(found).toBeDefined()
  return found!
}

describe('AppHeader · bouton de thème', () => {
  it('démarre en automatique avec l’icône écran', () => {
    const button = themeButton(mount(AppHeader))
    expect(button.props('icon')).toBe('monitor')
    expect(button.attributes('aria-label')).toContain('automatique')
    expect(button.attributes('title')).toBe(button.attributes('aria-label'))
  })

  it('enchaîne automatique → clair → sombre → automatique en adaptant icône et libellé', async () => {
    const wrapper = mount(AppHeader)

    await themeButton(wrapper).trigger('click')
    expect(theme.preference.value).toBe('light')
    expect(themeButton(wrapper).props('icon')).toBe('sun')
    expect(themeButton(wrapper).attributes('aria-label')).toContain('passer en thème sombre')

    await themeButton(wrapper).trigger('click')
    expect(theme.preference.value).toBe('dark')
    expect(themeButton(wrapper).props('icon')).toBe('moon')
    expect(themeButton(wrapper).attributes('aria-label')).toContain('revenir au thème automatique')

    await themeButton(wrapper).trigger('click')
    expect(theme.preference.value).toBe('system')
    expect(themeButton(wrapper).props('icon')).toBe('monitor')
  })
})
