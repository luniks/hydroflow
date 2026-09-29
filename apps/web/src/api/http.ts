import { REQUEST_TIMEOUT_MS } from '@/domain/constants'

export class ApiError extends Error {
  readonly kind: 'http' | 'timeout' | 'network' | 'payload'
  readonly status?: number

  constructor(message: string, kind: ApiError['kind'], status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ApiError(
        `délai d'attente dépassé (${Math.round(timeoutMs / 1000)}s)`,
        'timeout',
      )
    }
    throw new ApiError(e instanceof Error ? e.message : String(e), 'network')
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchJson<T>(url: string, timeoutMs?: number): Promise<T> {
  const res = await fetchWithTimeout(url, {}, timeoutMs)
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, 'http', res.status)
  try {
    return (await res.json()) as T
  } catch {
    throw new ApiError('réponse illisible (JSON invalide)', 'payload', res.status)
  }
}

/** Hub'Eau refuse les millisecondes dans les bornes de dates. */
export function isoNoMillis(date: Date): string {
  return `${date.toISOString().split('.')[0]}Z`
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
