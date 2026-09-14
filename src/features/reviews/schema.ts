import { z } from 'zod'
import { Constants, type Enums } from '@/lib/database.types'

export type Sentiment = Enums<'review_sentiment'>
export type Topic = Enums<'review_topic'>
export type AnalysisStatus = Enums<'analysis_status'>

export const SENTIMENTS = Constants.public.Enums.review_sentiment
export const TOPICS = Constants.public.Enums.review_topic
export const ANALYSIS_STATUSES = Constants.public.Enums.analysis_status

export const SORT_FIELDS = ['reviewed_at', 'score'] as const
export const SORT_ORDERS = ['asc', 'desc'] as const
export type SortField = (typeof SORT_FIELDS)[number]
export type SortOrder = (typeof SORT_ORDERS)[number]

export function isSortField(value: string): value is SortField {
  return (SORT_FIELDS as readonly string[]).includes(value)
}

export const SEARCH_TEXT_MAX_LENGTH = 200

/** Фильтры таблицы отзывов. Списки упорядочены как в enum базы. */
export type ReviewFilters = {
  sentiment: Sentiment[]
  topic: Topic[]
  q: string
  sort: SortField
  order: SortOrder
}

export const DEFAULT_REVIEW_FILTERS: ReviewFilters = {
  sentiment: [],
  topic: [],
  q: '',
  sort: 'reviewed_at',
  order: 'desc',
}

/** Параметры в URL: только значения, отличные от значений по умолчанию */
export type ReviewSearch = Partial<ReviewFilters>

function toStringList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value]
  return values
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
    .map((item) => item.trim())
    .filter(Boolean)
}

/** Оставляет только допустимые значения, без повторов, в порядке enum */
// optional() до transform: иначе Zod 4 считает поле обязательным и падает на отсутствующем параметре
function enumList<T extends string>(allowed: readonly T[]) {
  return z
    .unknown()
    .optional()
    .transform((value) => {
      const items = new Set(toStringList(value))
      return allowed.filter((item) => items.has(item))
    })
}

export function normalizeSearchText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, SEARCH_TEXT_MAX_LENGTH).trim()
}

// Некорректные значения отбрасываются: испорченная ссылка открывает таблицу, а не ошибку
const reviewFiltersSchema = z.object({
  sentiment: enumList(SENTIMENTS),
  topic: enumList(TOPICS),
  q: z.unknown().optional().transform(normalizeSearchText),
  sort: z.enum(SORT_FIELDS).catch(DEFAULT_REVIEW_FILTERS.sort),
  order: z.enum(SORT_ORDERS).catch(DEFAULT_REVIEW_FILTERS.order),
})

export function parseReviewFilters(search: Record<string, unknown>): ReviewFilters {
  return reviewFiltersSchema.parse(search)
}

export function toReviewSearch(filters: ReviewFilters): ReviewSearch {
  const normalized = parseReviewFilters(filters)
  const search: ReviewSearch = {}
  if (normalized.sentiment.length > 0) search.sentiment = normalized.sentiment
  if (normalized.topic.length > 0) search.topic = normalized.topic
  if (normalized.q !== '') search.q = normalized.q
  if (normalized.sort !== DEFAULT_REVIEW_FILTERS.sort) search.sort = normalized.sort
  if (normalized.order !== DEFAULT_REVIEW_FILTERS.order) search.order = normalized.order
  return search
}

/** validateSearch маршрута: одинаковые фильтры всегда дают одинаковые параметры */
export function validateReviewSearch(search: Record<string, unknown>): ReviewSearch {
  return toReviewSearch(parseReviewFilters(search))
}

export function hasActiveFilters(filters: ReviewFilters): boolean {
  return filters.sentiment.length > 0 || filters.topic.length > 0 || filters.q !== ''
}
