// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { LARGE_AMOUNT, isHarsh, normalizeText } from './compose.ts'
import { WINDOW_DAYS, isAppIncident, isSaleSeason } from './dates.ts'
import {
  allocateSlots,
  generateReviews,
  generateReviewsWithMeta,
  separateAdjacentDuplicates,
  type DemoReview,
  type GeneratedReview,
} from './generate.ts'
import { RELATED_TOPICS, SENTIMENTS, TARGET_SENTIMENT_SHARES, TOPIC_KEYS, TOPICS } from './topics.ts'

const NOW = new Date('2026-09-14T12:00:00Z')
const SEED = 20260914
const COUNT = 5000
const DAY_MS = 86_400_000

const generated = generateReviewsWithMeta({ count: COUNT, seed: SEED, now: NOW })
const reviews = generated.map(({ review }) => review)

const percent = <T,>(list: readonly T[], predicate: (item: T) => boolean) =>
  (list.filter(predicate).length / list.length) * 100

const isNegative = (review: DemoReview) => review.sentiment === 'negative'

/** Сколько раз фраза встречается в тексте как отдельные слова */
function countMentions(body: string, phrase: string): number {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${normalizeText(phrase)}(?![\\p{L}\\p{N}])`, 'gu')
  return normalizeText(body).match(pattern)?.length ?? 0
}

describe('allocateSlots', () => {
  it('выдаёт ровно count слотов', () => {
    expect(allocateSlots(COUNT)).toHaveLength(COUNT)
    expect(allocateSlots(7)).toHaveLength(7)
  })
})

describe('separateAdjacentDuplicates', () => {
  const identity = (value: string) => value
  const hasAdjacent = (values: string[]) => values.some((value, i) => i > 0 && value === values[i - 1])

  it.each([
    [['a', 'a', 'b']],
    [['a', 'a', 'a', 'b', 'b', 'c', 'c']],
    [['b', 'c', 'a', 'a']],
    [['x', 'a', 'a', 'a', 'b', 'c', 'd']],
  ])('разводит дубли в %j и сохраняет состав', (values) => {
    const result = separateAdjacentDuplicates(values, identity)
    expect(hasAdjacent(result)).toBe(false)
    expect([...result].sort()).toEqual([...values].sort())
  })

  it('оставляет порядок, если развести невозможно', () => {
    expect(separateAdjacentDuplicates(['a', 'a', 'a'], identity)).toEqual(['a', 'a', 'a'])
  })

  it('не меняет исходный массив', () => {
    const values = ['a', 'a', 'b']
    separateAdjacentDuplicates(values, identity)
    expect(values).toEqual(['a', 'a', 'b'])
  })
})

describe('generateReviews', () => {
  it(`генерирует ${COUNT} отзывов`, () => {
    expect(reviews).toHaveLength(COUNT)
  })

  it('с одним seed даёт одинаковый результат', () => {
    expect(generateReviews({ count: COUNT, seed: SEED, now: NOW })).toEqual(reviews)
  })

  it('с другим seed даёт другие отзывы', () => {
    const bodies = (list: DemoReview[]) => list.slice(0, 50).map((review) => review.body)
    expect(bodies(generateReviews({ count: COUNT, seed: 1, now: NOW }))).not.toEqual(bodies(reviews))
  })

  it.each(SENTIMENTS)('доля тональности %s совпадает с целевой', (sentiment) => {
    expect(percent(reviews, (review) => review.sentiment === sentiment)).toBeCloseTo(
      TARGET_SENTIMENT_SHARES[sentiment],
      0,
    )
  })

  it.each(TOPIC_KEYS)('доля темы %s совпадает с весом', (topic) => {
    expect(percent(reviews, (review) => review.topic === topic)).toBeCloseTo(TOPICS[topic].weight, 0)
  })

  it('не меньше 95% уникальных текстов', () => {
    const unique = new Set(reviews.map((review) => normalizeText(review.body)))
    expect(unique.size / COUNT).toBeGreaterThanOrEqual(0.95)
  })

  it('одинаковые тексты не идут подряд', () => {
    const keys = reviews.map((review) => normalizeText(review.body))
    const adjacent = keys.filter((key, i) => i > 0 && key === keys[i - 1])
    expect(adjacent).toEqual([])
  })

  it('отзывы идут по возрастанию даты в пределах окна', () => {
    const times = reviews.map((review) => Date.parse(review.reviewed_at))
    expect(times.every((time, i) => i === 0 || time >= times[i - 1])).toBe(true)
    expect(times[0]).toBeGreaterThanOrEqual(NOW.getTime() - WINDOW_DAYS * DAY_MS)
    expect(times[times.length - 1]).toBeLessThanOrEqual(NOW.getTime())
  })

  it('analyzed_at не раньше reviewed_at и не позже now', () => {
    for (const review of reviews) {
      const analyzed = Date.parse(review.analyzed_at)
      expect(analyzed).toBeGreaterThanOrEqual(Date.parse(review.reviewed_at))
      expect(analyzed).toBeLessThanOrEqual(NOW.getTime())
    }
  })

  it('соблюдает ограничения таблицы reviews', () => {
    for (const review of reviews) {
      expect(review.body.trim().length).toBeGreaterThan(0)
      expect(review.body.length).toBeLessThanOrEqual(10_000)
      expect(review.author === null || review.author.length <= 200).toBe(true)
      expect(review.source === null || review.source.length <= 200).toBe(true)
      expect(Number.isInteger(review.score)).toBe(true)
      expect(review.score).toBeGreaterThanOrEqual(0)
      expect(review.score).toBeLessThanOrEqual(10)
      // reviews_done_has_result: у готового анализа есть тональность и тема
      expect(review.analysis_status).toBe('done')
      expect(review.sentiment).not.toBeNull()
      expect(review.topic).not.toBeNull()
    }
  })

  it('NPS около +20', () => {
    const promoters = reviews.filter((review) => review.score >= 9).length
    const detractors = reviews.filter((review) => review.score <= 6).length
    const nps = ((promoters - detractors) / COUNT) * 100
    expect(nps).toBeGreaterThanOrEqual(15)
    expect(nps).toBeLessThanOrEqual(25)
  })

  it('в сезон распродаж негатива о доставке заметно больше', () => {
    const delivery = reviews.filter((review) => review.topic === 'delivery')
    const inSeason = delivery.filter((review) => isSaleSeason(new Date(review.reviewed_at)))
    const offSeason = delivery.filter((review) => !isSaleSeason(new Date(review.reviewed_at)))
    expect(percent(inSeason, isNegative)).toBeGreaterThan(percent(offSeason, isNegative) + 15)
  })

  it('во время сбоя приложения негатива о нём заметно больше', () => {
    const app = reviews.filter((review) => review.topic === 'website_app')
    const inIncident = app.filter((review) => isAppIncident(new Date(review.reviewed_at), NOW))
    const outside = app.filter((review) => !isAppIncident(new Date(review.reviewed_at), NOW))
    expect(percent(inIncident, isNegative)).toBeGreaterThan(percent(outside, isNegative) + 25)
  })
})

describe('согласованность текста', () => {
  it('резкий негатив бывает только в негативных отзывах и получает оценку 0–4', () => {
    const harsh = reviews.filter((review) => isHarsh(review.body))
    expect(harsh.length).toBeGreaterThan(0)
    expect(harsh.filter((review) => review.sentiment !== 'negative' || review.score > 4)).toEqual([])
  })

  it('при противоположной второй теме концовка нейтральная или отсутствует', () => {
    const mixed = generated.filter(({ meta }) => meta.mixed)
    expect(mixed.length).toBeGreaterThan(0)
    expect(mixed.filter(({ meta }) => meta.closing !== null && meta.closing !== 'neutral')).toEqual([])
  })

  it('отзывов с двумя негативными темами не больше 10%', () => {
    const twoNegative = (item: GeneratedReview) =>
      item.review.sentiment === 'negative' && item.meta.second?.sentiment === 'negative'
    expect(percent(generated, twoNegative)).toBeLessThanOrEqual(10)
  })

  it('опечаток в позитивных отзывах не больше 2%', () => {
    const positive = generated.filter(({ review }) => review.sentiment === 'positive')
    expect(percent(positive, ({ meta }) => meta.noise.includes('typo'))).toBeLessThanOrEqual(2)
  })

  it('товар упоминается в отзыве не больше одного раза', () => {
    const repeated = generated.filter(({ review, meta: { product } }) => {
      const mentions =
        countMentions(review.body, product.nom) +
        (product.acc === product.nom ? 0 : countMentions(review.body, product.acc))
      return mentions > 1
    })
    expect(repeated.map(({ review }) => review.body)).toEqual([])
  })

  it('суммы записаны в едином формате «9 590 ₽»', () => {
    const amounts = reviews.flatMap((review) => review.body.match(/[\d\xA0 ]+₽/gu) ?? [])
    expect(amounts.length).toBeGreaterThan(0)
    for (const amount of amounts) {
      expect(amount.trimStart()).toMatch(/^\d{1,3}(\xA0\d{3})*\xA0₽$/u)
    }
    expect(reviews.filter((review) => /\d\s?(руб|р\.)/u.test(review.body))).toEqual([])
  })

  it('«высокие ожидания» только при сумме от 10 000 ₽', () => {
    const expectations = reviews.flatMap(
      (review) => review.body.match(/покупка на ([\d\xA0]+)\xA0₽, так что ожидания/giu) ?? [],
    )
    expect(expectations.length).toBeGreaterThan(0)
    for (const phrase of expectations) {
      expect(Number(phrase.replace(/\D/g, ''))).toBeGreaterThanOrEqual(LARGE_AMOUNT)
    }
  })

  it('подарок упоминается в отзыве не больше одного раза', () => {
    const repeated = reviews.filter((review) => (review.body.match(/подар/giu)?.length ?? 0) > 1)
    expect(repeated.map((review) => review.body)).toEqual([])
  })

  it('к фразе о высоких ожиданиях не добавляются скобки', () => {
    expect(reviews.filter((review) => /ожидания были высокие\)/u.test(review.body))).toEqual([])
  })

  it('в нейтральных отзывах нет эмодзи', () => {
    const neutral = reviews.filter((review) => review.sentiment === 'neutral')
    expect(neutral.filter((review) => /\p{Extended_Pictographic}/u.test(review.body))).toEqual([])
  })

  it('вторая тема связана с основной', () => {
    const unrelated = generated.filter(
      ({ review, meta }) => meta.second !== null && !RELATED_TOPICS[review.topic].includes(meta.second.topic),
    )
    expect(unrelated).toEqual([])
  })
})
