import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseButton from './BaseButton.vue'
import BaseToggle from './BaseToggle.vue'
import BaseBadge from './BaseBadge.vue'
import BaseIcon from './BaseIcon.vue'
import BaseSpinner from './BaseSpinner.vue'
import BaseState from './BaseState.vue'
import BaseCard from './BaseCard.vue'
import BaseCollapse from './BaseCollapse.vue'

describe('BaseButton', () => {
  it('applique la variante et la taille demandées', () => {
    const wrapper = mount(BaseButton, {
      props: { variant: 'danger', size: 'sm' },
      slots: { default: 'Supprimer' },
    })
    expect(wrapper.classes()).toContain('ui-btn--danger')
    expect(wrapper.classes()).toContain('ui-btn--sm')
    expect(wrapper.text()).toBe('Supprimer')
  })

  it('émet un clic quand il est actif', async () => {
    const wrapper = mount(BaseButton)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('est désactivé et silencieux pendant le chargement', async () => {
    const wrapper = mount(BaseButton, { props: { loading: true, icon: 'refresh' } })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('ne rend pas de libellé sans contenu de slot', () => {
    const wrapper = mount(BaseButton, { props: { variant: 'icon', icon: 'x' } })
    expect(wrapper.find('.ui-btn__label').exists()).toBe(false)
    expect(wrapper.findComponent(BaseIcon).exists()).toBe(true)
  })
})

describe('BaseToggle', () => {
  it('expose le rôle switch et son état', () => {
    const wrapper = mount(BaseToggle, { props: { modelValue: true, label: 'Afficher' } })
    expect(wrapper.attributes('role')).toBe('switch')
    expect(wrapper.attributes('aria-checked')).toBe('true')
    expect(wrapper.attributes('aria-label')).toBe('Afficher')
  })

  it('inverse la valeur au clic', async () => {
    const wrapper = mount(BaseToggle, { props: { modelValue: false } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })

  it('ne bascule pas quand il est désactivé', async () => {
    const wrapper = mount(BaseToggle, { props: { modelValue: false, disabled: true } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('BaseBadge', () => {
  it('reflète la tonalité et affiche la pastille optionnelle', () => {
    const wrapper = mount(BaseBadge, {
      props: { tone: 'warn', dot: true },
      slots: { default: 'Vigilance' },
    })
    expect(wrapper.classes()).toContain('ui-badge--warn')
    expect(wrapper.find('.ui-badge__dot').exists()).toBe(true)
    expect(wrapper.text()).toBe('Vigilance')
  })

  it('est neutre et sans pastille par défaut', () => {
    const wrapper = mount(BaseBadge)
    expect(wrapper.classes()).toContain('ui-badge--neutral')
    expect(wrapper.find('.ui-badge__dot').exists()).toBe(false)
  })
})

describe('BaseIcon', () => {
  it('rend le tracé du dictionnaire et reste décoratif', () => {
    const wrapper = mount(BaseIcon, { props: { name: 'chevDown', size: 18 } })
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.attributes('width')).toBe('18')
    expect(wrapper.html()).toContain('<path')
  })
})

describe('BaseSpinner', () => {
  it('annonce le chargement aux lecteurs d’écran', () => {
    const wrapper = mount(BaseSpinner)
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-label')).toBe('Chargement…')
  })
})

describe('BaseState', () => {
  it('utilise le rôle alert en tonalité danger', () => {
    const wrapper = mount(BaseState, {
      props: { title: 'Échec', description: 'Réessayez', tone: 'danger', icon: 'x' },
    })
    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.text()).toContain('Réessayez')
  })

  it('émet l’action quand le bouton est présent', async () => {
    const wrapper = mount(BaseState, { props: { title: 'Vide', actionLabel: 'Ajouter' } })
    expect(wrapper.attributes('role')).toBe('status')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })
})

describe('BaseCard', () => {
  it('rend titre, sous-titre, actions et corps', () => {
    const wrapper = mount(BaseCard, {
      props: { title: 'Vielmur', subtitle: 'Agout' },
      slots: { default: 'contenu', actions: '<button>menu</button>' },
    })
    expect(wrapper.find('.ui-card__title').text()).toBe('Vielmur')
    expect(wrapper.find('.ui-card__subtitle').text()).toBe('Agout')
    expect(wrapper.find('.ui-card__actions').exists()).toBe(true)
    expect(wrapper.find('.ui-card__body').text()).toBe('contenu')
  })

  it('omet l’entête sans titre ni actions', () => {
    const wrapper = mount(BaseCard, { slots: { default: 'x' } })
    expect(wrapper.find('.ui-card__head').exists()).toBe(false)
  })
})

describe('BaseCollapse', () => {
  it('lie le bouton au panneau via aria-controls', () => {
    const wrapper = mount(BaseCollapse, {
      props: { title: 'Pluviométrie', modelValue: false },
      slots: { default: 'corps' },
    })
    const button = wrapper.find('.ui-collapse__toggle')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(button.attributes('aria-controls')).toBe(wrapper.find('.ui-collapse__body').attributes('id'))
  })

  it('demande le repli au clic', async () => {
    const wrapper = mount(BaseCollapse, { props: { title: 'Pluviométrie', modelValue: false } })
    await wrapper.find('.ui-collapse__toggle').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })

  it('masque le corps quand il est replié', () => {
    const wrapper = mount(BaseCollapse, {
      props: { title: 'Pluviométrie', modelValue: true },
      slots: { default: 'corps' },
    })
    expect(wrapper.find('.ui-collapse__body').isVisible()).toBe(false)
  })
})
