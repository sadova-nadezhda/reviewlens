// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { WINDOW_DAYS, createDatePicker, isAppIncident, isSaleSeason } from './dates.ts'
import { createRng } from './random.ts'
import type { Sentiment, Topic } from './topics.ts'

const NOW = new Date('2026-09-14T12:00:00Z')
const DAY_MS = 86_400_000

describe('isSaleSeason', () => {
  it.each([
    ['2025-11-19T20:59:59Z', false], // 19 ноября 23:59 по Москве
    ['2025-11-19T21:00:00Z', true], // 20 ноября 00:00 по Москве
    ['2025-12-31T20:59:59Z', true],
    ['2025-12-31T21:00:00Z', false], // 1 января по Москве
    ['2026-06-15T12:00:00Z', false],
  ])('%s → %s', (iso, expected) => {
    expect(isSaleSeason(new Date(iso))).toBe(expected)
  })
})

describe('createDatePicker', () => {
  const pick = createDatePicker(NOW)

  function draw(topic: Topic, sentiment: Sentiment, count = 20_000): Date[] {
    const rng = createRng(5)
    return Array.from({ length: count }, () => pick(rng, topic, sentiment))
  }

  const shareOf = (dates: Date[], predicate: (date: Date) => boolean) =>
    dates.filter(predicate).length / dates.length

  it('даты не старше WINDOW_DAYS дней и не позже now', () => {
    const times = draw('price', 'positive').map((date) => date.getTime())
    expect(Math.max(...times)).toBeLessThanOrEqual(NOW.getTime())
    expect(Math.min(...times)).toBeGreaterThanOrEqual(NOW.getTime() - WINDOW_DAYS * DAY_MS)
  })

  it('негатив о доставке чаще попадает в сезон распродаж', () => {
    const base = shareOf(draw('price', 'negative'), isSaleSeason)
    const delivery = shareOf(draw('delivery', 'negative'), isSaleSeason)
    expect(delivery).toBeGreaterThan(base * 2)
  })

  it('негатив о приложении чаще попадает в период сбоя', () => {
    const inIncident = (date: Date) => isAppIncident(date, NOW)
    const base = shareOf(draw('website_app', 'positive'), inIncident)
    const app = shareOf(draw('website_app', 'negative'), inIncident)
    expect(app).toBeGreaterThan(base * 5)
  })
})
