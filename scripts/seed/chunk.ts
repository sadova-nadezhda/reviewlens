/** Делит массив на пачки по size элементов; последняя пачка может быть короче */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error('chunk: размер пачки должен быть целым числом больше 0')
  }
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))
}
