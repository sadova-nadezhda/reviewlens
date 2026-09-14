/**
 * Плоский формат параметров URL вместо JSON, который TanStack Router пишет по умолчанию:
 * ?topic=delivery,price&q=курьер. Списки — через запятую, пустые значения не пишутся.
 * Значения читаются строками: типы и значения по умолчанию задаёт validateSearch маршрута.
 */
export function parseFlatSearch(searchStr: string): Record<string, string> {
  const params = new URLSearchParams(searchStr.startsWith('?') ? searchStr.slice(1) : searchStr)
  const search: Record<string, string> = {}
  for (const [key, value] of params) {
    // Повторяющийся ключ (?topic=a&topic=b) читается как список
    search[key] = key in search ? `${search[key]},${value}` : value
  }
  return search
}

export function stringifyFlatSearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    const serialized = serializeValue(value)
    if (serialized !== null) params.set(key, serialized)
  }
  // Запятые-разделители оставляем читаемыми: URLSearchParams кодирует их как %2C
  const searchStr = params.toString().replaceAll('%2C', ',')
  return searchStr ? `?${searchStr}` : ''
}

function serializeValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    const items = value.filter(isPrimitive).map(String)
    return items.length > 0 ? items.join(',') : null
  }
  if (isPrimitive(value)) {
    const text = String(value)
    return text === '' ? null : text
  }
  return null
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}
