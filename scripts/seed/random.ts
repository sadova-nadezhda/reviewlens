export type Weighted<T> = readonly (readonly [T, number])[]

export type Rng = {
  next: () => number
  int: (min: number, max: number) => number
  chance: (probability: number) => boolean
  pick: <T>(items: readonly T[]) => T
  weighted: <T>(items: Weighted<T>) => T
  shuffle: <T>(items: readonly T[]) => T[]
}

// mulberry32: детерминированный генератор. Для демо-данных его качества достаточно.
export function createRng(seed: number): Rng {
  let state = seed >>> 0

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function int(min: number, max: number): number {
    return min + Math.floor(next() * (max - min + 1))
  }

  function chance(probability: number): boolean {
    return next() < probability
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick: пустой массив')
    return items[Math.floor(next() * items.length)]
  }

  function weighted<T>(items: Weighted<T>): T {
    const total = items.reduce((sum, [, weight]) => sum + weight, 0)
    if (total <= 0) throw new Error('weighted: сумма весов должна быть больше 0')

    let threshold = next() * total
    for (const [value, weight] of items) {
      threshold -= weight
      if (threshold < 0 && weight > 0) return value
    }
    // Погрешность плавающей точки: последний вариант с ненулевым весом
    return items.findLast(([, weight]) => weight > 0)![0]
  }

  function shuffle<T>(items: readonly T[]): T[] {
    const result = [...items]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  return { next, int, chance, pick, weighted, shuffle }
}
