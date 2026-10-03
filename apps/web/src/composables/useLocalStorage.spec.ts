import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { readNumber, useLocalStorage, writeNumber } from './useLocalStorage'

describe('useLocalStorage', () => {
  it('retourne la valeur par défaut sans entrée', () => {
    expect(useLocalStorage('k', 42).value).toBe(42)
  })

  it('relit une valeur persistée', () => {
    localStorage.setItem('k', JSON.stringify({ a: 1 }))
    expect(useLocalStorage('k', {}).value).toEqual({ a: 1 })
  })

  it('persiste les mutations, y compris en profondeur', async () => {
    const state = useLocalStorage('k', { a: 1 })
    state.value.a = 9
    await nextTick()
    expect(JSON.parse(localStorage.getItem('k')!)).toEqual({ a: 9 })
  })

  it('retombe sur la valeur par défaut si le JSON est corrompu', () => {
    localStorage.setItem('k', '{pas du json')
    expect(useLocalStorage('k', 'defaut').value).toBe('defaut')
  })

  it('retombe sur la valeur par défaut si la validation échoue', () => {
    localStorage.setItem('k', JSON.stringify('light'))
    const parse = (raw: unknown) => (raw === 'dark' ? 'dark' : null)
    expect(useLocalStorage('k', 'dark', { parse }).value).toBe('dark')
  })

  it('accepte une sérialisation personnalisée', async () => {
    const state = useLocalStorage<number>('k', 10, {
      serialize: String,
      deserialize: (raw) => Number.parseInt(raw, 10),
    })
    state.value = 30
    await nextTick()
    expect(localStorage.getItem('k')).toBe('30')
  })

  it('reste fonctionnel si l’écriture est refusée', async () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('quota')
    }
    const state = useLocalStorage('k', 1)
    state.value = 2
    await nextTick()
    expect(state.value).toBe(2)
    Storage.prototype.setItem = original
  })
})

describe('readNumber / writeNumber', () => {
  it('retourne la valeur par défaut sans entrée ou si non numérique', () => {
    expect(readNumber('k', 30)).toBe(30)
    localStorage.setItem('k', 'abc')
    expect(readNumber('k', 30)).toBe(30)
  })

  it('fait un aller-retour', () => {
    writeNumber('k', 12.5)
    expect(readNumber('k', 0)).toBe(12.5)
  })
})
