import { describe, expect, it } from 'vitest'
import { parseFlatSearch, stringifyFlatSearch } from './search-params'

describe('stringifyFlatSearch', () => {
  it('пишет списки через запятую и пропускает пустые значения', () => {
    expect(stringifyFlatSearch({ topic: ['delivery', 'price'], sentiment: [], q: '', sort: undefined, order: 'asc' })).toBe(
      '?topic=delivery,price&order=asc',
    )
  })

  it('для пустого набора возвращает пустую строку', () => {
    expect(stringifyFlatSearch({})).toBe('')
  })

  it('не пишет вложенные объекты', () => {
    expect(stringifyFlatSearch({ nested: { a: 1 }, page: 2 })).toBe('?page=2')
  })
})

describe('parseFlatSearch', () => {
  it('читает строку с «?» и без', () => {
    expect(parseFlatSearch('?topic=delivery,price')).toEqual({ topic: 'delivery,price' })
    expect(parseFlatSearch('topic=delivery')).toEqual({ topic: 'delivery' })
  })

  it('склеивает повторяющиеся ключи в список', () => {
    expect(parseFlatSearch('?topic=delivery&topic=price')).toEqual({ topic: 'delivery,price' })
  })

  it('сохраняет кириллицу, пробелы и запятые в тексте поиска', () => {
    const search = { q: 'быстро, но дорого', topic: ['price'] }
    expect(parseFlatSearch(stringifyFlatSearch(search))).toEqual({ q: 'быстро, но дорого', topic: 'price' })
  })
})
