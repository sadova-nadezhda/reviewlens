import type { SupabaseClient } from '@supabase/supabase-js'
import { infiniteQueryOptions, keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import type { Database, Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { nextPageOffset, pageRange, reviewsOrder } from './pagination'
import type { ReviewFilters } from './schema'
import { buildTextSearchCondition } from './text-search'

const REVIEW_LIST_COLUMNS = 'id, body, score, sentiment, topic, author, source, reviewed_at, analysis_status'

export type ReviewListItem = Pick<
  Tables<'reviews'>,
  'id' | 'body' | 'score' | 'sentiment' | 'topic' | 'author' | 'source' | 'reviewed_at' | 'analysis_status'
>

export type ReviewsPage = {
  offset: number
  rows: ReviewListItem[]
  /** Общее число отзывов по фильтрам; приходит только с первой страницей */
  total: number | null
}

export const reviewKeys = {
  all: ['reviews'] as const,
  lists: () => [...reviewKeys.all, 'list'] as const,
  list: (datasetId: string, filters: ReviewFilters) => [...reviewKeys.lists(), datasetId, filters] as const,
}

/** Диапазон за пределами данных: например, строк стало меньше между запросами страниц */
const RANGE_NOT_SATISFIABLE = 416

export type FetchReviewsPageParams = {
  datasetId: string
  filters: ReviewFilters
  offset: number
  signal?: AbortSignal
}

export async function fetchReviewsPage(
  client: SupabaseClient<Database>,
  { datasetId, filters, offset, signal }: FetchReviewsPageParams,
): Promise<ReviewsPage> {
  // count нужен только для «Найдено N» и конца списка: на остальных страницах это лишний подсчёт
  let query = client
    .from('reviews')
    .select(REVIEW_LIST_COLUMNS, { count: offset === 0 ? 'exact' : undefined })
    .eq('dataset_id', datasetId)

  if (filters.sentiment.length > 0) query = query.in('sentiment', filters.sentiment)
  if (filters.topic.length > 0) query = query.in('topic', filters.topic)

  const searchCondition = buildTextSearchCondition(filters.q)
  if (searchCondition) {
    switch (searchCondition.kind) {
      case 'ilike':
        query = query.ilike(searchCondition.column, searchCondition.pattern)
        break
    }
  }

  for (const { column, ascending, nullsFirst } of reviewsOrder(filters.sort, filters.order)) {
    query = query.order(column, { ascending, nullsFirst })
  }

  const { from, to } = pageRange(offset)
  query = query.range(from, to)
  if (signal) query = query.abortSignal(signal)

  const { data, error, count, status } = await query
  if (status === RANGE_NOT_SATISFIABLE) return { offset, rows: [], total: count }
  if (error) throw new Error(`Не удалось загрузить отзывы: ${error.message}`)
  return { offset, rows: data, total: count }
}

/** Демо-датасет меняется только при seed, пользовательские — после анализа */
export const REVIEWS_STALE_TIME = {
  demo: 5 * 60_000,
  user: 30_000,
} as const

export type ReviewsQueryOptions = {
  staleTime: number
}

export function reviewsInfiniteQueryOptions(datasetId: string, filters: ReviewFilters, { staleTime }: ReviewsQueryOptions) {
  return infiniteQueryOptions({
    queryKey: reviewKeys.list(datasetId, filters),
    queryFn: ({ pageParam, signal }) => fetchReviewsPage(supabase, { datasetId, filters, offset: pageParam, signal }),
    initialPageParam: 0,
    // Не передаём nextPageOffset напрямую: третий аргумент (lastPageParam) попал бы в pageSize
    getNextPageParam: (lastPage, allPages) => nextPageOffset(lastPage, allPages),
    staleTime,
    // При смене фильтров старые строки остаются на экране, пока грузятся новые
    placeholderData: keepPreviousData,
  })
}

export function useReviewsInfiniteQuery(datasetId: string, filters: ReviewFilters, options: ReviewsQueryOptions) {
  return useInfiniteQuery(reviewsInfiniteQueryOptions(datasetId, filters, options))
}
