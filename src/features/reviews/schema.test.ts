import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REVIEW_FILTERS,
  SEARCH_TEXT_MAX_LENGTH,
  hasActiveFilters,
  parseReviewFilters,
  toReviewSearch,
  validateReviewSearch,
} from './schema'

describe('parseReviewFilters', () => {
  it('без параметров возвращает значения по умолчанию', () => {
    expect(parseReviewFilters({})).toEqual(DEFAULT_REVIEW_FILTERS)
  })

  it('читает списки через запятую и упорядочивает их как в enum', () => {
    expect(parseReviewFilters({ topic: 'price,delivery', sentiment: 'negative,positive' })).toMatchObject({
      topic: ['delivery', 'price'],
      sentiment: ['positive', 'negative'],
    })
  })

  it('принимает списки массивом и убирает повторы', () => {
    expect(parseReviewFilters({ topic: ['returns', 'delivery,returns'] }).topic).toEqual(['delivery', 'returns'])
  })

  it('отбрасывает некорректные значения', () => {
    expect(
      parseReviewFilters({ topic: 'foo,price', sentiment: 42, sort: 'author', order: 'sideways', q: ['x'] }),
    ).toEqual({ ...DEFAULT_REVIEW_FILTERS, topic: ['price'] })
  })

  it('нормализует пробелы в поиске и ограничивает длину', () => {
    expect(parseReviewFilters({ q: '  курьер   не  приехал ' }).q).toBe('курьер не приехал')
    expect(parseReviewFilters({ q: 'а'.repeat(500) }).q).toHaveLength(SEARCH_TEXT_MAX_LENGTH)
  })
})

describe('toReviewSearch', () => {
  it('не пишет значения по умолчанию', () => {
    expect(toReviewSearch(DEFAULT_REVIEW_FILTERS)).toEqual({})
  })

  it('пишет только отличающиеся значения в едином порядке', () => {
    expect(
      toReviewSearch({ sentiment: ['negative'], topic: ['price', 'delivery'], q: ' курьер ', sort: 'score', order: 'desc' }),
    ).toEqual({ sentiment: ['negative'], topic: ['delivery', 'price'], q: 'курьер', sort: 'score' })
  })
})

describe('validateReviewSearch', () => {
  it('даёт одинаковый результат для одинаковых фильтров в разной записи', () => {
    const a = validateReviewSearch({ topic: 'price,delivery', sort: 'reviewed_at', order: 'desc' })
    const b = validateReviewSearch({ topic: ['delivery', 'price', 'unknown'] })
    expect(a).toEqual({ topic: ['delivery', 'price'] })
    expect(b).toEqual(a)
  })

  it('повторная проверка ничего не меняет', () => {
    const once = validateReviewSearch({ sentiment: 'neutral', q: 'упаковка', order: 'asc' })
    expect(validateReviewSearch(once)).toEqual(once)
  })
})

describe('hasActiveFilters', () => {
  it('сортировка не считается фильтром', () => {
    expect(hasActiveFilters({ ...DEFAULT_REVIEW_FILTERS, sort: 'score', order: 'asc' })).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_REVIEW_FILTERS, q: 'курьер' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_REVIEW_FILTERS, topic: ['price'] })).toBe(true)
  })
})
