import { describe, expect, it } from 'vitest'
import { MIN_SEARCH_LENGTH, buildTextSearchCondition, escapeLikePattern } from './text-search'

const BACKSLASH = String.fromCharCode(92)

describe('escapeLikePattern', () => {
  it('не меняет обычный текст', () => {
    expect(escapeLikePattern('курьер не приехал')).toBe('курьер не приехал')
  })

  it('экранирует %, _ и обратную косую черту', () => {
    expect(escapeLikePattern('100%')).toBe(`100${BACKSLASH}%`)
    expect(escapeLikePattern('snake_case')).toBe(`snake${BACKSLASH}_case`)
    expect(escapeLikePattern(`a${BACKSLASH}b`)).toBe(`a${BACKSLASH}${BACKSLASH}b`)
  })

  it('заменяет «*» на одиночную подстановку', () => {
    expect(escapeLikePattern('5*')).toBe('5_')
  })
})

describe('buildTextSearchCondition', () => {
  it(`не ищет по запросу короче ${MIN_SEARCH_LENGTH} символов`, () => {
    expect(buildTextSearchCondition('')).toBeNull()
    expect(buildTextSearchCondition(' к ')).toBeNull()
  })

  it('ищет подстроку в тексте отзыва', () => {
    expect(buildTextSearchCondition(' курьер ')).toEqual({ kind: 'ilike', column: 'body', pattern: '%курьер%' })
  })
})
