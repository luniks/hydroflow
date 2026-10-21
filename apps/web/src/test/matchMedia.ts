type Listener = (event: { matches: boolean }) => void

let systemDark = true
const listeners = new Set<Listener>()

/** jsdom n'a pas matchMedia : simulation de `(prefers-color-scheme: dark)`, pilotable depuis les tests. */
export function installMatchMedia(): void {
  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      return query.includes('prefers-color-scheme: dark') ? systemDark : false
    },
    addEventListener: (_: string, fn: Listener) => listeners.add(fn),
    removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
  })) as unknown as typeof window.matchMedia
}

/** Change le theme du « systeme » et previent les abonnes, comme le ferait le navigateur. */
export function setSystemTheme(theme: 'dark' | 'light'): void {
  systemDark = theme === 'dark'
  for (const fn of listeners) fn({ matches: systemDark })
}
