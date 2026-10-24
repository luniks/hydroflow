import { describe, expect, it } from 'vitest'
import {
  fmtClock,
  fmtDate,
  fmtDuration,
  fmtLevel,
  fmtMm,
  fmtQ,
  fmtTrend,
  levelRateToCmPerHour,
  pluralize,
} from './format'

describe('fmtMm', () => {
  it('arrondit au dixième de millimètre', () => {
    expect(fmtMm(12.34)).toBe('12.3')
    expect(fmtMm(12.35)).toBe('12.4')
    expect(fmtMm(0)).toBe('0.0')
  })
})

describe('fmtQ', () => {
  it('garde les entiers tels quels et fixe une décimale sinon', () => {
    expect(fmtQ(10)).toBe('10')
    expect(fmtQ(5.52)).toBe('5.5')
  })
})

describe('fmtLevel', () => {
  it('affiche deux décimales', () => {
    expect(fmtLevel(1.2)).toBe('1.20')
  })
})

describe('fmtDate', () => {
  it('retourne un tiret sans date', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDate(undefined)).toBe('—')
    expect(fmtDate('')).toBe('—')
  })

  it('retourne un tiret sur une date invalide', () => {
    expect(fmtDate('pas-une-date')).toBe('—')
  })

  it('formate en jour/mois heure:minute', () => {
    expect(fmtDate('2026-01-02T15:04:00Z')).toMatch(/^\d{2}\/\d{2}/)
  })
})

describe('fmtTrend', () => {
  it('préfixe les hausses d’un signe plus', () => {
    expect(fmtTrend(0.5, 'm³/s/h')).toBe('+0.50 m³/s/h')
    expect(fmtTrend(-0.5, 'm³/s/h')).toBe('-0.50 m³/s/h')
    expect(fmtTrend(0, 'm³/s/h')).toBe('0.00 m³/s/h')
  })
})

describe('levelRateToCmPerHour', () => {
  it('convertit les mètres par heure en centimètres par heure', () => {
    expect(levelRateToCmPerHour(0.05)).toBeCloseTo(5)
  })
})

describe('pluralize', () => {
  it('accorde au-delà de un', () => {
    expect(pluralize(1, 'point')).toBe('point')
    expect(pluralize(2, 'point')).toBe('points')
    expect(pluralize(0, 'point')).toBe('point')
    expect(pluralize(3, 'cheval', 'chevaux')).toBe('chevaux')
  })
})

describe('fmtDuration', () => {
  it('affiche les durées courtes en minutes', () => {
    expect(fmtDuration(0)).toBe('0 min')
    expect(fmtDuration(25)).toBe('25 min')
  })

  it('affiche les heures pleines et les heures avec minutes', () => {
    expect(fmtDuration(120)).toBe('2 h')
    expect(fmtDuration(80)).toBe('1 h 20')
    expect(fmtDuration(125)).toBe('2 h 05')
  })

  it('arrondit à la minute et ignore les durées négatives', () => {
    expect(fmtDuration(59.6)).toBe('1 h')
    expect(fmtDuration(-3)).toBe('0 min')
  })
})

describe('fmtClock', () => {
  it('donne l’heure locale sur deux chiffres', () => {
    const ms = Date.parse('2026-01-01T12:05:00Z')
    expect(fmtClock(ms)).toMatch(/^\d{2}:\d{2}$/)
    expect(fmtClock(ms)).toBe(new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
  })
})
