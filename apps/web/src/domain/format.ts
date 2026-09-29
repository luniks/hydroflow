/** Pluie : resolution 0,1 mm, celle d'Open-Meteo. */
export const fmtMm = (n: number): string => (Math.round(n * 10) / 10).toFixed(1)

export const fmtQ = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export const fmtLevel = (n: number): string => n.toFixed(2)

export function fmtDate(iso: string | null | undefined, format?: Object): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'

  return d.toLocaleString('fr-FR', format || {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtTrend(ratePerHour: number, unit: string): string {
  const sign = ratePerHour > 0 ? '+' : ''
  return `${sign}${ratePerHour.toFixed(2)} ${unit}`
}

/** Le niveau se lit en cm/h, plus parlant que des metres par heure. */
export const levelRateToCmPerHour = (metresPerHour: number): number => metresPerHour * 100

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count > 1 ? plural : singular
}
