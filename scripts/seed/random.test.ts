// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createRng } from './random.ts'

describe('createRng', () => {
  it('с одним seed выдаёт одну и ту же последовательность', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect(Array.from({ length: 10 }, () => a.next())).toEqual(Array.from({ length: 10 }, () => b.next()))
  })

  it('с разными seed выдаёт разные последовательности', () => {
    const a = createRng(1)
    const b = createRng(2)
    expect(Array.from({ length: 10 }, () => a.next())).not.toEqual(Array.from({ length: 10 }, () => b.next()))
  })

  it('next возвращает числа в [0, 1)', () => {
    const rng = createRng(7)
    const values = Array.from({ length: 10_000 }, () => rng.next())
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...values)).toBeLessThan(1)
  })

  it('int включает обе границы и не выходит за них', () => {
    const rng = createRng(7)
    const values = new Set(Array.from({ length: 1000 }, () => rng.int(1, 3)))
    expect([...values].sort()).toEqual([1, 2, 3])
  })

  it('weighted не выбирает варианты с нулевым весом', () => {
    const rng = createRng(7)
    const values = new Set(
      Array.from({ length: 1000 }, () =>
        rng.weighted([
          ['a', 0],
          ['b', 1],
          ['c', 0],
        ]),
      ),
    )
    expect([...values]).toEqual(['b'])
  })

  it('weighted падает, если все веса нулевые', () => {
    expect(() => createRng(7).weighted([['a', 0]])).toThrow()
  })

  it('shuffle возвращает перестановку и не меняет исходный массив', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const shuffled = createRng(7).shuffle(items)
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items)
  })
})
