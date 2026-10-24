import type { AnalyzeOptions, SeriesAnalysis, SeriesPoint, Trend } from './types'

const ONE_HOUR_MS = 3_600_000

/**
 * Tendance sur ~1 h : compare la derniere mesure au point le plus recent anterieur
 * a `last - 1h` (a defaut, le point le plus ancien disponible).
 */
export function computeTrend(points: SeriesPoint[], flatThreshold: number): Trend {
  if (points.length < 2) return { dir: 'flat', ratePerHour: 0 }

  const last = points[points.length - 1]!
  const targetTime = new Date(last.t).getTime() - ONE_HOUR_MS

  let ref = points[0]!
  for (let i = points.length - 2; i >= 0; i--) {
    ref = points[i]!
    if (new Date(ref.t).getTime() <= targetTime) break
  }

  const delta = last.y - ref.y
  const deltaH = Math.max(
    (new Date(last.t).getTime() - new Date(ref.t).getTime()) / ONE_HOUR_MS,
    0.01,
  )
  const ratePerHour = delta / deltaH

  let dir: Trend['dir'] = 'flat'
  if (ratePerHour > flatThreshold) dir = 'up'
  else if (ratePerHour < -flatThreshold) dir = 'down'

  return { dir, ratePerHour }
}

// ---------------------------------------------------------------------------
// Analyse par regression : robuste au bruit, sans le retard de la pente sur 1 h.
// ---------------------------------------------------------------------------

const MINUTE_MS = 60_000
/** En dessous, la serie est trop courte pour une regression : repli sur `computeTrend`. */
const MIN_POINTS = 5
/** Fenetres de pente essayees, de la plus reactive a la plus stable. */
const SLOPE_WINDOWS_MIN = [30, 60] as const
/** Une pente n'est retenue que si elle depasse ce nombre d'erreurs-types. */
const SIGNIFICANCE = 3
/** Un palier dure au moins ce nombre de minutes. */
const PLATEAU_MIN_MINUTES = 15
/** Au-dela de ce bruit relatif, seule la fenetre la plus longue est fiable. */
const NOISY_RATIO = 0.015
const CURVE_WINDOW_MIN = 45
const CURVE_MIN_POINTS = 6
/** La courbure n'est extrapolee que sur cette duree ; ensuite on prolonge la pente. */
export const CURVE_HORIZON_MIN = 30

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** Mediane glissante sur 3 points (efface les creux isoles) ; la derniere mesure, la plus utile, n'est pas lissee. */
function medianFilter(ys: number[]): number[] {
  return ys.map((y, i) => (i === ys.length - 1 ? y : median(ys.slice(Math.max(0, i - 1), i + 2))))
}

/**
 * Bruit de mesure (ecart-type) sur la derniere heure, estime par les differences secondes :
 * contrairement aux residus d'une droite, elles ignorent les tendances lisses (une courbe en cloche n'est pas du bruit).
 * Precondition : la derniere heure compte au moins `MIN_POINTS` mesures (verifie par `analyzeSeries`).
 */
function noiseSigma(times: number[], ys: number[]): number {
  const lastT = times[times.length - 1]!
  const recent = ys.filter((_, i) => lastT - times[i]! <= 3_600_000)
  const second: number[] = []
  for (let i = 1; i < recent.length - 1; i++) second.push(Math.abs(recent[i + 1]! - 2 * recent[i]! + recent[i - 1]!))
  return (1.4826 * median(second)) / Math.sqrt(6)
}

/** Duree (min) pendant laquelle la serie reste dans une bande de largeur `tol` jusqu'a la derniere mesure. */
function plateauMinutes(times: number[], ys: number[], tol: number): number {
  const lastIdx = ys.length - 1
  let lo = ys[lastIdx]!
  let hi = lo
  let start = times[lastIdx]!
  for (let i = lastIdx - 1; i >= 0; i--) {
    const nextLo = Math.min(lo, ys[i]!)
    const nextHi = Math.max(hi, ys[i]!)
    if (nextHi - nextLo > tol) break
    lo = nextLo
    hi = nextHi
    start = times[i]!
  }
  return (times[lastIdx]! - start) / MINUTE_MS
}

/** Abscisses (heures avant la derniere mesure, <= 0) et valeurs des mesures des `minutes` dernieres minutes. */
function recentWindow(times: number[], ys: number[], minutes: number) {
  const lastT = times[times.length - 1]!
  const x: number[] = []
  const y: number[] = []
  times.forEach((t, i) => {
    if (lastT - t <= minutes * MINUTE_MS) {
      x.push((t - lastT) / 3_600_000)
      y.push(ys[i]!)
    }
  })
  return { x, y }
}

function linearFit(x: number[], y: number[]): { slope: number; se: number } {
  const n = x.length
  const mx = x.reduce((a, b) => a + b, 0) / n
  const my = y.reduce((a, b) => a + b, 0) / n
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    sxx += (x[i]! - mx) ** 2
    sxy += (x[i]! - mx) * (y[i]! - my)
  }
  const slope = sxy / sxx
  let sse = 0
  for (let i = 0; i < n; i++) sse += (y[i]! - (my + slope * (x[i]! - mx))) ** 2
  return { slope, se: Math.sqrt(sse / (n - 2)) / Math.sqrt(sxx) }
}

function inverse3(m: number[][]): number[][] {
  const [[a, b, c], [d, e, f], [g, h, i]] = m as [number[], number[], number[]] as [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ]
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
  return [
    [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ]
}

/** Ajustement quadratique y = c + b·x + a·x² : pente `b` et courbure `a` au dernier instant, avec l'erreur-type de `a`. */
function quadraticFit(x: number[], y: number[]) {
  const power = (k: number) => x.reduce((acc, xi) => acc + xi ** k, 0)
  const moment = (k: number) => x.reduce((acc, xi, i) => acc + xi ** k * y[i]!, 0)
  const inv = inverse3([
    [power(0), power(1), power(2)],
    [power(1), power(2), power(3)],
    [power(2), power(3), power(4)],
  ])
  const rhs = [moment(0), moment(1), moment(2)]
  const [c, b, a] = inv.map((row) => row.reduce((acc, v, k) => acc + v * rhs[k]!, 0)) as [number, number, number]
  let sse = 0
  x.forEach((xi, i) => (sse += (y[i]! - (c + b * xi + a * xi * xi)) ** 2))
  return { b, a, seA: Math.sqrt(sse / (x.length - 3)) * Math.sqrt(inv[2]![2]!) }
}

/**
 * Lit une serie (debit ou niveau, plus ancien -> plus recent) :
 * 1. un **palier** (15 min dans la tolerance de bruit) prime : la serie est stable, quelle que soit l'heure ecoulee ;
 * 2. sinon la **pente** de la fenetre la plus courte ou elle est significative (3 erreurs-types) ;
 * 3. sinon aucune tendance.
 * La tolerance suit le bruit mesure de la station, pas un pourcentage fixe. La courbure n'est retenue que si elle est
 * significative et materielle : c'est elle qui corrige l'ETA d'une courbe qui accelere.
 * En dessous de `MIN_POINTS` mesures, on retombe sur la pente 2 points de `computeTrend`.
 */
export function analyzeSeries(points: SeriesPoint[], opts: AnalyzeOptions): SeriesAnalysis {
  const times = points.map((p) => Date.parse(p.t))
  const raw = points.map((p) => p.y)
  const ys = medianFilter(raw)
  const hour = recentWindow(times, ys, 60)

  if (points.length < MIN_POINTS || hour.x.length < MIN_POINTS) {
    const trend = computeTrend(points, opts.legacyFlat)
    const ratePerHour = trend.dir === 'flat' ? 0 : trend.ratePerHour
    return { dir: trend.dir, ratePerHour, windowMin: null, stableMin: null, curve: null, method: 'legacy' }
  }

  const level = Math.abs(raw[raw.length - 1]!)
  const sigma = noiseSigma(times, raw)
  const tol = Math.max(opts.relFloor * level, 3 * sigma, opts.absFloor)

  const stable = plateauMinutes(times, raw, tol)
  if (stable >= PLATEAU_MIN_MINUTES) {
    return { dir: 'flat', ratePerHour: 0, windowMin: null, stableMin: stable, curve: null, method: 'regression' }
  }

  const noisy = level > 0 && sigma / level > NOISY_RATIO
  let dir: SeriesAnalysis['dir'] = 'flat'
  let ratePerHour = 0
  let windowMin: number | null = null
  for (const minutes of noisy ? [60] : SLOPE_WINDOWS_MIN) {
    const w = recentWindow(times, ys, minutes)
    if (w.x.length < MIN_POINTS) continue
    const fit = linearFit(w.x, w.y)
    if (Math.abs(fit.slope) > SIGNIFICANCE * fit.se) {
      dir = fit.slope > 0 ? 'up' : 'down'
      ratePerHour = fit.slope
      windowMin = minutes
      break
    }
  }

  let curve: SeriesAnalysis['curve'] = null
  const cw = recentWindow(times, ys, CURVE_WINDOW_MIN)
  if (cw.x.length >= CURVE_MIN_POINTS) {
    const q = quadraticFit(cw.x, cw.y)
    const reach = (CURVE_HORIZON_MIN / 60) ** 2
    if (Math.abs(q.a) > SIGNIFICANCE * q.seA && Math.abs(q.a) * reach > tol) curve = { b: q.b, a: q.a }
  }

  return { dir, ratePerHour, windowMin, stableMin: null, curve, method: 'regression' }
}

/** Valeur attendue `dtHours` apres la derniere mesure `lastY` : courbure sur 30 min, puis prolongement de la pente. */
export function projectSeries(analysis: SeriesAnalysis, lastY: number, dtHours: number): number {
  if (dtHours <= 0) return lastY
  const { curve } = analysis
  if (!curve) return Math.max(0, lastY + analysis.ratePerHour * dtHours)
  const horizon = CURVE_HORIZON_MIN / 60
  const dt = Math.min(dtHours, horizon)
  const atHorizon = lastY + curve.b * dt + curve.a * dt * dt
  return Math.max(0, atHorizon + analysis.ratePerHour * Math.max(0, dtHours - horizon))
}

/** Minutes avant que la serie franchisse `target` (dans le sens ou elle se deplace), `null` au-dela de `horizonMin`. */
export function minutesToReach(
  analysis: SeriesAnalysis,
  lastY: number,
  target: number,
  horizonMin: number,
): number | null {
  const side = Math.sign(lastY - target)
  if (side === 0) return 0
  for (let m = 1; m <= horizonMin; m++) {
    if (Math.sign(projectSeries(analysis, lastY, m / 60) - target) !== side) return m
  }
  return null
}
