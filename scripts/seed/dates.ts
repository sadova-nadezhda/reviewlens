import type { Rng, Weighted } from './random.ts'
import type { Sentiment, Topic } from './topics.ts'

const DAY_MS = 86_400_000
const MOSCOW_OFFSET_MS = 3 * 3_600_000

export const WINDOW_DAYS = 365

/** Сбой приложения: две недели, закончившиеся примерно за 4 месяца до now */
const INCIDENT_DAYS_AGO = { from: 130, to: 117 }

const TREND_GROWTH = 0.5
const SALE_VOLUME = 1.4
const SALE_DELIVERY_NEGATIVE = 3.5
const INCIDENT_APP_NEGATIVE = 8

// Отзывы пишут в основном днём и вечером по Москве
const HOUR_WEIGHTS: Weighted<number> = Array.from(
  { length: 24 },
  (_, hour) => [hour, hour < 7 ? 1 : hour < 10 ? 4 : hour < 19 ? 6 : 8] as const,
)

function moscowDayNumber(date: Date): number {
  return Math.floor((date.getTime() + MOSCOW_OFFSET_MS) / DAY_MS)
}

/** Сезон распродаж: с 20 ноября по 31 декабря по московскому времени */
export function isSaleSeason(date: Date): boolean {
  const moscow = new Date(date.getTime() + MOSCOW_OFFSET_MS)
  const month = moscow.getUTCMonth()
  return (month === 10 && moscow.getUTCDate() >= 20) || month === 11
}

export function isAppIncident(date: Date, now: Date): boolean {
  const daysAgo = moscowDayNumber(now) - moscowDayNumber(date)
  return daysAgo >= INCIDENT_DAYS_AGO.to && daysAgo <= INCIDENT_DAYS_AGO.from
}

export type DatePicker = (rng: Rng, topic: Topic, sentiment: Sentiment) => Date

/**
 * Дата отзыва за последние WINDOW_DAYS дней. Тема и тональность уже выбраны,
 * от них зависит только распределение по дням: итоговые доли не меняются.
 */
export function createDatePicker(now: Date): DatePicker {
  const today = moscowDayNumber(now)
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const start = (today - (WINDOW_DAYS - 1) + i) * DAY_MS - MOSCOW_OFFSET_MS
    const date = new Date(start)
    return {
      start,
      volume: (1 + (TREND_GROWTH * i) / (WINDOW_DAYS - 1)) * (isSaleSeason(date) ? SALE_VOLUME : 1),
      sale: isSaleSeason(date),
      incident: isAppIncident(date, now),
    }
  })

  const tables = {
    default: cumulative(days.map((day) => day.volume)),
    deliveryNegative: cumulative(days.map((day) => day.volume * (day.sale ? SALE_DELIVERY_NEGATIVE : 1))),
    appNegative: cumulative(days.map((day) => day.volume * (day.incident ? INCIDENT_APP_NEGATIVE : 1))),
  }

  return (rng, topic, sentiment) => {
    const table =
      sentiment === 'negative' && topic === 'delivery'
        ? tables.deliveryNegative
        : sentiment === 'negative' && topic === 'website_app'
          ? tables.appNegative
          : tables.default

    const index = pickIndex(rng, table)
    const { start } = days[index]
    const isToday = index === WINDOW_DAYS - 1
    const offset = isToday
      ? Math.floor(rng.next() * (now.getTime() - start))
      : (rng.weighted(HOUR_WEIGHTS) * 3600 + rng.int(0, 3599)) * 1000
    return new Date(start + offset)
  }
}

function cumulative(weights: readonly number[]): number[] {
  let sum = 0
  return weights.map((weight) => (sum += weight))
}

function pickIndex(rng: Rng, table: readonly number[]): number {
  const threshold = rng.next() * table[table.length - 1]
  let low = 0
  let high = table.length - 1
  while (low < high) {
    const mid = (low + high) >> 1
    if (table[mid] > threshold) high = mid
    else low = mid + 1
  }
  return low
}
