import { describe, expect, it } from 'vitest'
import {
  REVIEWS_PAGE_SIZE,
  SUPABASE_MAX_ROWS,
  nextPageOffset,
  pageRange,
  reviewsOrder,
  type PageInfo,
} from './pagination'

const page = (offset: number, count: number, total: number | null = null): PageInfo => ({
  offset,
  rows: Array.from({ length: count }),
  total,
})

describe('pageRange', () => {
  it('размер страницы не превышает лимит Supabase', () => {
    expect(REVIEWS_PAGE_SIZE).toBeLessThanOrEqual(SUPABASE_MAX_ROWS)
  })

  it('возвращает границы включительно', () => {
    expect(pageRange(0)).toEqual({ from: 0, to: REVIEWS_PAGE_SIZE - 1 })
    expect(pageRange(400, 200)).toEqual({ from: 400, to: 599 })
  })

  it.each([
    [-1, 200],
    [1.5, 200],
    [0, 0],
    [0, SUPABASE_MAX_ROWS + 1],
  ])('падает на смещении %s и размере %s', (offset, size) => {
    expect(() => pageRange(offset, size)).toThrow()
  })
})

describe('nextPageOffset', () => {
  it('продолжает, пока загружено меньше total первой страницы', () => {
    const first = page(0, 200, 450)
    const second = page(200, 200)
    expect(nextPageOffset(first, [first])).toBe(200)
    expect(nextPageOffset(second, [first, second])).toBe(400)
  })

  it('останавливается на границе, кратной размеру страницы, без лишнего запроса', () => {
    const first = page(0, 200, 400)
    const second = page(200, 200)
    expect(nextPageOffset(second, [first, second])).toBeUndefined()
  })

  it('останавливается на пустой странице — например, после ответа 416', () => {
    const first = page(0, 200, 5000)
    const empty = page(200, 0)
    expect(nextPageOffset(empty, [first, empty])).toBeUndefined()
  })

  it('без total ориентируется на неполную страницу', () => {
    expect(nextPageOffset(page(0, 200), [page(0, 200)])).toBe(200)
    expect(nextPageOffset(page(0, 150), [page(0, 150)])).toBeUndefined()
  })
})

describe('reviewsOrder', () => {
  it.each(['asc', 'desc'] as const)('ставит NULL в конец при сортировке %s', (order) => {
    expect(reviewsOrder('score', order).every((spec) => spec.nullsFirst === false)).toBe(true)
  })

  it('добавляет id вторым ключом в том же направлении', () => {
    expect(reviewsOrder('reviewed_at', 'desc')).toEqual([
      { column: 'reviewed_at', ascending: false, nullsFirst: false },
      { column: 'id', ascending: false, nullsFirst: false },
    ])
  })
})
