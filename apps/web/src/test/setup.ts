import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './msw/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  server.resetHandlers()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterAll(() => server.close())
