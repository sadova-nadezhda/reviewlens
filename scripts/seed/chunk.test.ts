// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { chunk } from './chunk.ts'

describe('chunk', () => {
  it('делит на равные пачки', () => {
    const batches = chunk(Array.from({ length: 5000 }, (_, i) => i), 500)
    expect(batches).toHaveLength(10)
    expect(batches.every((batch) => batch.length === 500)).toBe(true)
    expect(batches.flat()).toEqual(Array.from({ length: 5000 }, (_, i) => i))
  })

  it('оставляет короткую последнюю пачку', () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]])
  })

  it('для пустого массива возвращает пустой список', () => {
    expect(chunk([], 500)).toEqual([])
  })

  it.each([0, -1, 1.5])('падает на размере пачки %s', (size) => {
    expect(() => chunk([1], size)).toThrow()
  })
})
