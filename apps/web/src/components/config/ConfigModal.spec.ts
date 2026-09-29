import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { config } from '@/config/env'
import { useExploit } from '@/composables/useExploit'
import { useRain } from '@/composables/useRain'
import { useStations } from '@/composables/useStations'
import { DEFAULT_STATIONS, EXPLOIT_DEFAULTS, RAIN_EXTERNAL_MAX } from '@/domain/constants'
import { server } from '@/test/msw/server'
import ConfigModal from './ConfigModal.vue'
import type { ConfigDraft } from './useConfigDraft'

/** Les onglets recoivent tous la meme instance de brouillon. */
function draftOf(wrapper: VueWrapper, name = 'StationsTab'): ConfigDraft {
  return wrapper.findComponent({ name }).props('draft') as ConfigDraft
}

const stations = useStations()
const exploit = useExploit()
const rain = useRain()

const mounted: VueWrapper[] = []

function factory() {
  const wrapper = mount(ConfigModal, { props: { open: true }, attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}

/** Les composants sont teleportes dans `body` : on cible le DOM global. */
function tab(wrapper: VueWrapper, label: string) {
  const btn = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((el) =>
    [...el.querySelectorAll('span')].some((span) => span.textContent?.trim() === label),
  )
  if (!btn) throw new Error(`Onglet introuvable : ${label}`)
  btn.click()
  return wrapper.vm.$nextTick()
}

function footerButton(label: string) {
  const btn = [...document.querySelectorAll<HTMLElement>('.ui-modal__foot button')].find((el) =>
    el.textContent?.includes(label),
  )
  if (!btn) throw new Error(`Bouton introuvable : ${label}`)
  return btn
}

function openRainAddForm() {
  const btn = [...document.querySelectorAll<HTMLElement>('.cfg-section__head button')].find((el) =>
    el.textContent?.includes('Ajouter'),
  )!
  btn.click()
}

beforeEach(async () => {
  for (const w of mounted.splice(0)) w.unmount()
  document.body.innerHTML = ''
  stations.reset()
  exploit.reset()
  rain.resetExternal()
  rain.hiddenKeys.value = []
  await nextTick()
})

describe('ConfigModal', () => {
  it('affiche les trois onglets', () => {
    factory()
    expect(
      [...document.querySelectorAll<HTMLElement>('[role="tab"]')].map((el) => {
        const spans = [...el.querySelectorAll('span')].filter(
          (s) => !s.classList.contains('ui-tabs__label-short') && !s.classList.contains('ui-tabs__count'),
        )
        return spans[0]?.textContent?.trim()
      }),
    ).toEqual(['Stations suivies', "Seuils d'exploitation", 'Pluviométrie'])
  })

  it('annuler ne persiste aucune modification', async () => {
    const wrapper = factory()
    const modal = wrapper.findComponent(ConfigModal)
    const stationsTab = modal.findComponent({ name: 'StationsTab' })
    stationsTab.props('draft').stations = []
    await nextTick()

    footerButton('Annuler').click()
    await nextTick()

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(stations.codes.value).toEqual(DEFAULT_STATIONS.map((s) => s.code))
  })

  it('enregistrer applique le brouillon et émet saved', async () => {
    const wrapper = factory()
    const draft = draftOf(wrapper)
    draft.stations = draft.stations.filter((s) => s.code !== 'O460251001')
    await nextTick()

    footerButton('Enregistrer').click()
    await nextTick()

    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(stations.codes.value).not.toContain('O460251001')
  })

  it('bloque l’enregistrement sur une configuration de seuils invalide', async () => {
    const wrapper = factory()
    const draft = draftOf(wrapper)
    draft.exploit.optMax = draft.exploit.optMin - 1
    await nextTick()

    footerButton('Enregistrer').click()
    await nextTick()

    expect(wrapper.emitted('close')).toBeUndefined()
    expect(document.querySelector('.cfg-foot__error')?.textContent).toContain('« De »')
    expect(exploit.exploit.value.optMax).toBe(EXPLOIT_DEFAULTS.optMax)
  })

  describe('onglet Stations', () => {
    it('ajoute une station après vérification Hub’Eau', async () => {
      const wrapper = factory()
      const input = document.querySelector<HTMLInputElement>('.cfg-add input[type="text"]')!
      input.value = 'o480252009'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()

      const addBtn = [...document.querySelectorAll<HTMLElement>('.cfg-add__btns button')].find((el) =>
        el.textContent?.includes('Ajouter'),
      )!
      addBtn.click()
      await new Promise((r) => setTimeout(r, 0))
      await nextTick()

      const draft = draftOf(wrapper)
      expect(draft.stations.map((s) => s.code)).toContain('O480252009')
    })

    it('refuse un code déjà présent', async () => {
      factory()
      const input = document.querySelector<HTMLInputElement>('.cfg-add input[type="text"]')!
      input.value = 'O460251001'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()

      const addBtn = [...document.querySelectorAll<HTMLElement>('.cfg-add__btns button')].find((el) =>
        el.textContent?.includes('Ajouter'),
      )!
      addBtn.click()
      await nextTick()

      expect(document.querySelector('.cfg-add__msg')?.textContent).toContain('déjà dans la liste')
    })

    it('signale un code introuvable', async () => {
      server.use(
        http.get(`${config.hubeauUrl}/referentiel/stations`, () => HttpResponse.json({ data: [] })),
      )
      factory()
      const input = document.querySelector<HTMLInputElement>('.cfg-add input[type="text"]')!
      input.value = 'XXXX'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()

      const addBtn = [...document.querySelectorAll<HTMLElement>('.cfg-add__btns button')].find((el) =>
        el.textContent?.includes('Ajouter'),
      )!
      addBtn.click()
      await new Promise((r) => setTimeout(r, 0))
      await nextTick()

      expect(document.querySelector('.cfg-add__msg')?.textContent).toContain('Code introuvable')
    })

    it('retire une station du brouillon sans toucher à la configuration', async () => {
      const wrapper = factory()
      const removeBtn = document.querySelector<HTMLElement>(
        '.st-row [aria-label="Retirer O460251001"]',
      )!
      removeBtn.click()
      await nextTick()

      const draft = draftOf(wrapper)
      expect(draft.stations.map((s) => s.code)).not.toContain('O460251001')
      expect(stations.codes.value).toContain('O460251001')
    })

    it('réordonne les stations par glisser-déposer', async () => {
      const wrapper = factory()
      const rows = [...document.querySelectorAll<HTMLElement>('.st-row')]
      const grip = rows[0]!.querySelector<HTMLElement>('.st-row__grip')!
      grip.setPointerCapture = () => {}
      grip.releasePointerCapture = () => {}

      const originalElementFromPoint = document.elementFromPoint
      document.elementFromPoint = () => rows[2]!

      const point = (type: string, clientY: number) =>
        Object.assign(new Event(type, { bubbles: true, cancelable: true }), { pointerId: 1, clientY })

      grip.dispatchEvent(point('pointerdown', 0))
      grip.dispatchEvent(point('pointermove', 80))
      grip.dispatchEvent(point('pointerup', 80))
      await nextTick()

      document.elementFromPoint = originalElementFromPoint

      const draft = draftOf(wrapper)
      expect(draft.stations.map((s) => s.code)).toEqual([
        'O469251003',
        'O480252002',
        'O460251001',
      ])
    })
  })

  describe('onglet Seuils', () => {
    it('affiche le message de validation et masque la jauge', async () => {
      const wrapper = factory()
      const draft = draftOf(wrapper)
      draft.exploit.dmin = 50
      await tab(wrapper, 'Seuils')

      expect(document.querySelector('.cfg-error')?.textContent).toBeTruthy()
      expect(document.querySelector('.gauge__bar')).toBeNull()
    })

    it('ne signale aucune erreur quand la configuration est valide', async () => {
      const wrapper = factory()
      await tab(wrapper, 'Seuils')
      expect(document.querySelector('.cfg-error')).toBeNull()
    })

    it('liste les stations du brouillon comme références possibles', async () => {
      const wrapper = factory()
      await tab(wrapper, 'Seuils')
      const options = [...document.querySelectorAll('.ui-select option')].map((o) => o.textContent)
      expect(options.join(' ')).toContain('O469251003')
    })
  })

  describe('onglet Pluviométrie', () => {
    it('bascule la visibilité d’un point sans persister avant enregistrement', async () => {
      const wrapper = factory()
      await tab(wrapper, 'Pluviométrie')

      const rainTab = wrapper.findComponent({ name: 'RainTab' })
      await rainTab.find('[role="switch"]').trigger('click')

      const draft = rainTab.props('draft') as ConfigDraft
      expect(draft.rainHidden).toHaveLength(1)
      expect(rain.hiddenKeys.value).toHaveLength(0)
    })

    it('ajoute une commune issue du géocodage', async () => {
      server.use(
        http.get(config.openMeteoGeocodingUrl, () =>
          HttpResponse.json({
            results: [{ name: 'Brassac', latitude: 43.63, longitude: 2.49, admin2: 'Tarn' }],
          }),
        ),
      )
      const wrapper = factory()
      await tab(wrapper, 'Pluviométrie')
      openRainAddForm()
      await nextTick()

      const search = document.querySelector<HTMLInputElement>('input[type="search"]')!
      search.value = 'Brassac'
      search.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()
      ;[...document.querySelectorAll<HTMLElement>('.rc-search button')][0]!.click()
      await new Promise((r) => setTimeout(r, 0))
      await nextTick()

      document.querySelector<HTMLElement>('.rc-result')!.click()
      await nextTick()

      const draft = draftOf(wrapper, 'RainTab')
      expect(draft.rainExternal.map((d) => d.name)).toContain('Brassac')
    })

    it('signale une recherche trop courte', async () => {
      const wrapper = factory()
      await tab(wrapper, 'Pluviométrie')
      openRainAddForm()
      await nextTick()
      ;[...document.querySelectorAll<HTMLElement>('.rc-search button')][0]!.click()
      await nextTick()

      expect(document.body.textContent).toContain('Saisissez au moins 2 caractères.')
    })

    it('refuse une saisie manuelle invalide', async () => {
      const wrapper = factory()
      await tab(wrapper, 'Pluviométrie')
      openRainAddForm()
      await nextTick()
      const addBtn = [...document.querySelectorAll<HTMLElement>('.rc-manual button')].find((el) =>
        el.textContent?.includes('Ajouter le point'),
      )!
      addBtn.click()
      await nextTick()

      expect(document.querySelector('.rc-manual .cfg-add__msg')?.textContent).toContain(
        'Indiquez un nom.',
      )
    })

    it('bloque l’ajout au-delà du maximum de points amont', async () => {
      const wrapper = factory()
      await tab(wrapper, 'Pluviométrie')
      openRainAddForm()
      await nextTick()
      const draft = draftOf(wrapper, 'RainTab')
      draft.rainExternal = Array.from({ length: RAIN_EXTERNAL_MAX }, (_, i) => ({
        key: `p${i}`,
        name: `P${i}`,
        context: '',
        lat: 10 + i,
        lon: 10 + i,
      }))
      await nextTick()

      expect(document.body.textContent).toContain(`Maximum ${RAIN_EXTERNAL_MAX} points amont.`)
      expect(document.querySelector<HTMLInputElement>('input[type="search"]')!.disabled).toBe(true)
    })

    it('rétablit les points par défaut via la réinitialisation globale', async () => {
      const wrapper = factory()
      const draft = draftOf(wrapper)
      draft.rainExternal = []
      await nextTick()

      const resetBtn = [...document.querySelectorAll<HTMLElement>('.st-reset button')].find((el) =>
        el.textContent?.includes('Rétablir les stations par défaut'),
      )!
      resetBtn.click()
      await nextTick()

      expect(draft.rainExternal.length).toBeGreaterThan(0)
    })
  })
})
