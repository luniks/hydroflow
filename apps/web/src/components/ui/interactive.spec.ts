import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseDropdown from './BaseDropdown.vue'
import BaseSelect from './BaseSelect.vue'
import BaseInput from './BaseInput.vue'
import BaseNumberInput from './BaseNumberInput.vue'
import BaseTabs from './BaseTabs.vue'
import BaseModal from './BaseModal.vue'
import BaseHint from './BaseHint.vue'
import BaseTooltip from './BaseTooltip.vue'

const OPTIONS = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B', description: 'seconde' },
]

describe('BaseDropdown', () => {
  it('affiche le libellé de la valeur courante', () => {
    const wrapper = mount(BaseDropdown, { props: { options: OPTIONS, modelValue: 'b' } })
    expect(wrapper.find('.ui-dropdown__value').text()).toBe('Option B')
  })

  it('affiche un tiret si la valeur est inconnue', () => {
    const wrapper = mount(BaseDropdown, { props: { options: OPTIONS, modelValue: 'z' } })
    expect(wrapper.find('.ui-dropdown__value').text()).toBe('—')
  })

  it('ouvre la liste et sélectionne une option', async () => {
    const wrapper = mount(BaseDropdown, {
      props: { options: OPTIONS, modelValue: 'a' },
      attachTo: document.body,
    })
    await wrapper.find('.ui-dropdown__trigger').trigger('click')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)

    const options = wrapper.findAll('[role="option"]')
    expect(options[0]!.attributes('aria-selected')).toBe('true')
    await options[1]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('se ferme sur Échap et sur un clic extérieur', async () => {
    const wrapper = mount(BaseDropdown, {
      props: { options: OPTIONS, modelValue: 'a' },
      attachTo: document.body,
    })
    await wrapper.find('.ui-dropdown__trigger').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)

    await wrapper.find('.ui-dropdown__trigger').trigger('click')
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('BaseSelect', () => {
  it('associe le libellé au champ', () => {
    const wrapper = mount(BaseSelect, {
      props: { options: OPTIONS, modelValue: 'a', label: 'Station' },
    })
    expect(wrapper.find('label').attributes('for')).toBe(wrapper.find('select').attributes('id'))
  })

  it('émet la valeur typée de l’option choisie', async () => {
    const numeric = [
      { value: 1, label: 'Un' },
      { value: 24, label: 'Vingt-quatre' },
    ]
    const wrapper = mount(BaseSelect, { props: { options: numeric, modelValue: 1 } })
    await wrapper.find('select').setValue('24')
    expect(wrapper.emitted('update:modelValue')).toEqual([[24]])
  })

  it('ignore une valeur absente des options', async () => {
    const wrapper = mount(BaseSelect, { props: { options: OPTIONS, modelValue: 'a' } })
    const select = wrapper.find('select').element as HTMLSelectElement
    select.value = 'inconnu'
    await wrapper.find('select').trigger('change')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('BaseInput', () => {
  it('propage la saisie', async () => {
    const wrapper = mount(BaseInput, { props: { modelValue: '' } })
    await wrapper.find('input').setValue('Castres')
    expect(wrapper.emitted('update:modelValue')).toEqual([['Castres']])
  })

  it('expose l’erreur via aria-describedby', () => {
    const wrapper = mount(BaseInput, { props: { modelValue: '', error: 'Champ requis' } })
    const input = wrapper.find('input')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('[role="alert"]').attributes('id')).toBe(
      input.attributes('aria-describedby'),
    )
  })
})

describe('BaseNumberInput', () => {
  it('convertit la saisie en nombre', async () => {
    const wrapper = mount(BaseNumberInput, { props: { modelValue: null } })
    await wrapper.find('input').setValue('12.5')
    expect(wrapper.emitted('update:modelValue')).toEqual([[12.5]])
  })

  it('renvoie null quand le champ est vidé', async () => {
    const wrapper = mount(BaseNumberInput, { props: { modelValue: 3 } })
    await wrapper.find('input').setValue('')
    expect(wrapper.emitted('update:modelValue')).toEqual([[null]])
  })

  it('affiche l’unité fournie', () => {
    const wrapper = mount(BaseNumberInput, { props: { modelValue: 3, unit: 'm³/s' } })
    expect(wrapper.find('.ui-input__unit').text()).toBe('m³/s')
  })
})

describe('BaseTabs', () => {
  const tabs = [
    { id: 'stations', label: 'Stations' },
    { id: 'seuils', label: 'Seuils' },
    { id: 'pluie', label: 'Pluviométrie' },
  ]

  it('respecte le patron ARIA tablist', () => {
    const wrapper = mount(BaseTabs, { props: { tabs, modelValue: 'seuils' } })
    const items = wrapper.findAll('[role="tab"]')
    expect(items).toHaveLength(3)
    expect(items[1]!.attributes('aria-selected')).toBe('true')
    expect(items[1]!.attributes('tabindex')).toBe('0')
    expect(items[0]!.attributes('tabindex')).toBe('-1')
    expect(items[1]!.attributes('aria-controls')).toBe(
      wrapper.findAll('[role="tabpanel"]')[1]!.attributes('id'),
    )
  })

  it('n’affiche que le panneau actif', () => {
    const wrapper = mount(BaseTabs, {
      props: { tabs, modelValue: 'stations' },
      slots: { stations: 'A', seuils: 'B', pluie: 'C' },
    })
    const panels = wrapper.findAll('[role="tabpanel"]')
    expect(panels[0]!.isVisible()).toBe(true)
    expect(panels[1]!.isVisible()).toBe(false)
  })

  it('navigue au clavier avec les flèches, Début et Fin', async () => {
    const wrapper = mount(BaseTabs, {
      props: { tabs, modelValue: 'stations' },
      attachTo: document.body,
    })
    const items = wrapper.findAll('[role="tab"]')

    await items[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['seuils'])

    await items[0]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['pluie'])

    await items[0]!.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['pluie'])

    await items[2]!.trigger('keydown', { key: 'Home' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['stations'])

    const emitted = wrapper.emitted('update:modelValue')!.length
    await items[0]!.trigger('keydown', { key: 'a' })
    expect(wrapper.emitted('update:modelValue')).toHaveLength(emitted)
    wrapper.unmount()
  })

  it('sélectionne un onglet au clic', async () => {
    const wrapper = mount(BaseTabs, { props: { tabs, modelValue: 'stations' } })
    await wrapper.findAll('[role="tab"]')[2]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['pluie']])
  })
})

describe('BaseModal', () => {
  const factory = (open = true) =>
    mount(BaseModal, {
      props: { open, title: 'Configuration' },
      slots: { default: '<button class="first">ok</button>', footer: '<button>Valider</button>' },
      attachTo: document.body,
    })

  it('ne rend rien tant qu’il est fermé', () => {
    const wrapper = factory(false)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })

  it('est un dialogue modal étiqueté par son titre', () => {
    const wrapper = factory()
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe(
      'Configuration',
    )
    wrapper.unmount()
  })

  it('bloque le défilement de html et body puis le restaure', async () => {
    document.documentElement.style.overflow = 'auto'
    const wrapper = factory()
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')
    await wrapper.setProps({ open: false })
    expect(document.documentElement.style.overflow).toBe('auto')
    expect(document.body.style.overflow).toBe('')
    wrapper.unmount()
    document.documentElement.style.overflow = ''
  })

  it('ne déverrouille pas depuis une modale qui n’a jamais verrouillé', () => {
    const a = factory()
    const b = factory(false)
    b.unmount()
    expect(document.body.style.overflow).toBe('hidden')
    a.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('garde le verrou tant qu’une modale reste ouverte', async () => {
    const a = factory()
    const b = factory()
    await a.setProps({ open: false })
    expect(document.body.style.overflow).toBe('hidden')
    b.unmount()
    expect(document.documentElement.style.overflow).toBe('')
    a.unmount()
  })

  it('demande la fermeture sur Échap, le voile et la croix', async () => {
    const wrapper = factory()
    const modal = document.querySelector('.ui-modal')!
    modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    document.querySelector('.ui-modal__overlay')!.dispatchEvent(new MouseEvent('click'))
    document.querySelector<HTMLElement>('[aria-label="Fermer"]')!.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toHaveLength(3)
    wrapper.unmount()
  })

  it('piège le focus en boucle avec Tab', async () => {
    const wrapper = factory()
    await wrapper.vm.$nextTick()
    const modal = document.querySelector('.ui-modal')!
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('.ui-modal__panel button'))
    const first = buttons[0]!
    const last = buttons[buttons.length - 1]!

    last.focus()
    modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(first)

    first.focus()
    modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(last)
    wrapper.unmount()
  })
})

describe('BaseTooltip', () => {
  it('affiche la bulle au survol et la retire à la sortie', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const wrapper = mount(BaseTooltip, {
      slots: { default: 'cible', content: 'Détail' },
    })
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)

    await wrapper.trigger('mouseenter')
    expect(wrapper.find('[role="tooltip"]').text()).toBe('Détail')
    expect(wrapper.find('.ui-tooltip__anchor').attributes('aria-describedby')).toBe(
      wrapper.find('[role="tooltip"]').attributes('id'),
    )

    await wrapper.trigger('mouseleave')
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
    vi.unstubAllGlobals()
  })

  it('s’ouvre aussi au focus clavier', async () => {
    const wrapper = mount(BaseTooltip, { slots: { content: 'Détail' } })
    await wrapper.trigger('focusin')
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(true)
    await wrapper.trigger('focusout')
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
  })
})

describe('BaseTooltip (tactile)', () => {
  it('se ferme sur un tap extérieur et sur Échap', async () => {
    const wrapper = mount(BaseTooltip, { slots: { content: 'Détail' }, attachTo: document.body })
    await wrapper.trigger('focusin')
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(true)
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)

    await wrapper.trigger('focusin')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('reste ouverte sur un tap à l’intérieur', async () => {
    const wrapper = mount(BaseTooltip, { slots: { default: '<button>x</button>', content: 'Détail' }, attachTo: document.body })
    await wrapper.trigger('focusin')
    wrapper.find('button').element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('BaseHint', () => {
  it('expose un bouton focusable avec libellé et ouvre l’infobulle au focus', async () => {
    const wrapper = mount(BaseHint, { props: { text: 'Explication', label: 'Débit' }, attachTo: document.body })
    const btn = wrapper.find('button')
    expect(btn.attributes('type')).toBe('button')
    expect(btn.attributes('aria-label')).toBe('Aide : Débit')
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)

    await btn.trigger('click') // tap : le bouton prend le focus
    expect(document.activeElement).toBe(btn.element)
    await btn.trigger('focusin')
    expect(wrapper.find('[role="tooltip"]').text()).toBe('Explication')
    wrapper.unmount()
  })

  it('est rendu à droite du label des champs numériques et des listes', async () => {
    const { default: BaseNumberInput } = await import('./BaseNumberInput.vue')
    const { default: BaseSelect } = await import('./BaseSelect.vue')
    const num = mount(BaseNumberInput, { props: { modelValue: 1, label: 'Débit', hint: 'Aide' } })
    expect(num.find('.ui-field__labelrow .ui-hint').exists()).toBe(true)
    const sel = mount(BaseSelect, { props: { modelValue: 'a', label: 'Station', hint: 'Aide', options: [{ value: 'a', label: 'A' }] } })
    expect(sel.find('.ui-field__labelrow .ui-hint').exists()).toBe(true)
    const none = mount(BaseNumberInput, { props: { modelValue: 1, label: 'Débit' } })
    expect(none.find('.ui-hint').exists()).toBe(false)
  })
})

describe('BaseCollapse (zone de clic)', () => {
  it('ne replie que depuis la ligne de titre, pas depuis le contenu', async () => {
    const { default: BaseCollapse } = await import('./BaseCollapse.vue')
    const wrapper = mount(BaseCollapse, {
      props: { title: 'Stations', modelValue: false },
      slots: { default: '<p class="inner">contenu</p>' },
    })
    await wrapper.find('.inner').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await wrapper.find('.ui-collapse__toggle').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })
})
