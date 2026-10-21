import { afterAll, afterEach, beforeAll } from 'vitest'
import { installMatchMedia, setSystemTheme } from './matchMedia'
import { server } from './msw/server'

installMatchMedia()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  server.resetHandlers()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  setSystemTheme('dark')
})

afterAll(() => server.close())
