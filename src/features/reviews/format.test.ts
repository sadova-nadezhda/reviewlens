import { describe, expect, it } from 'vitest'
import { formatCount, formatReviewDate } from './format'

// Intl разделяет части неразрывными пробелами — сравниваем с обычными
const spaces = (text: string) => text.replace(/\s/g, ' ')

describe('formatReviewDate', () => {
  it('форматирует дату без «г.» и время в заданном поясе', () => {
    const { date, time } = formatReviewDate('2026-09-14T12:30:00Z', 'Europe/Moscow')
    expect(spaces(date)).toBe('14 сент. 2026')
    expect(time).toBe('15:30')
  })

  it('учитывает переход даты в часовом поясе', () => {
    expect(spaces(formatReviewDate('2026-09-14T22:30:00Z', 'Europe/Moscow').date)).toBe('15 сент. 2026')
  })
})

describe('formatCount', () => {
  it('разделяет разряды', () => {
    expect(spaces(formatCount(5000))).toBe('5 000')
  })
})
