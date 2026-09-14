export const MIN_SEARCH_LENGTH = 2

/**
 * Условие поиска по тексту отзыва. Сейчас это ilike по подстроке.
 * Для полнотекстового поиска достаточно добавить сюда вариант, например
 * { kind: 'fts'; column: 'body_search'; query: string }, и ветку в applyTextSearch (api.ts).
 */
export type TextSearchCondition = { kind: 'ilike'; column: 'body'; pattern: string }

export function buildTextSearchCondition(q: string): TextSearchCondition | null {
  const text = q.trim()
  if (text.length < MIN_SEARCH_LENGTH) return null
  return { kind: 'ilike', column: 'body', pattern: `%${escapeLikePattern(text)}%` }
}

const BACKSLASH = String.fromCharCode(92)
const LIKE_SPECIAL = new Set([BACKSLASH, '%', '_'])

/**
 * Экранирует спецсимволы LIKE обратной косой чертой.
 *
 * «*» PostgREST всегда читает как подстановку «%», экранировать его нельзя. Поэтому «*» заменяется
 * на «_» — «любой один символ»: запрос «5*» находит текст «5*». Пробел вместо «*» (как было в плане)
 * не нашёл бы «5*» без пробела. Цена решения — лишние совпадения вроде «5+» по запросу «5*»,
 * для поиска по отзывам это приемлемо.
 */
export function escapeLikePattern(text: string): string {
  return Array.from(text, (char) => {
    if (char === '*') return '_'
    return LIKE_SPECIAL.has(char) ? BACKSLASH + char : char
  }).join('')
}
