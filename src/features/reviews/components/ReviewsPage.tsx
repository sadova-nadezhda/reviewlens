import { useParams } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { useDatasetQuery } from '@/features/datasets/api'
import { REVIEWS_STALE_TIME, useReviewsInfiniteQuery } from '../api'
import { formatCount } from '../format'
import { useReviewFilters } from '../use-review-filters'
import { ReviewsTable } from './ReviewsTable'
import { ReviewsEmptyState, ReviewsErrorState, ReviewsTableSkeleton } from './ReviewsTableStates'
import { ReviewsToolbar } from './ReviewsToolbar'

export function ReviewsPage() {
  const { datasetId } = useParams({ from: '/datasets/$datasetId' })
  const { data: dataset } = useDatasetQuery(datasetId)
  const { filters, setFilters, hasActiveFilters, resetFilters } = useReviewFilters()

  const reviews = useReviewsInfiniteQuery(datasetId, filters, {
    staleTime: dataset?.is_demo ? REVIEWS_STALE_TIME.demo : REVIEWS_STALE_TIME.user,
  })
  const { fetchNextPage, refetch } = reviews

  const rows = useMemo(() => reviews.data?.pages.flatMap((page) => page.rows) ?? [], [reviews.data])
  const total = reviews.data?.pages[0]?.total ?? null
  const loadMore = useCallback(() => void fetchNextPage(), [fetchNextPage])

  // Сброс из пустого состояния пересоздаёт тулбар, чтобы отменить незаписанный ввод в поиске
  const [toolbarKey, setToolbarKey] = useState(0)
  const resetFromEmptyState = useCallback(() => {
    setToolbarKey((key) => key + 1)
    resetFilters()
  }, [resetFilters])

  // loader маршрута уже отдал notFound для отсутствующего датасета; проверка нужна для типов
  if (dataset === null) return null

  return (
    <main className="flex h-full flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{dataset.name}</h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {total === null
            ? `Отзывов: ${formatCount(dataset.reviews_count)}`
            : `Найдено: ${formatCount(total)} из ${formatCount(dataset.reviews_count)}`}
          {reviews.isPlaceholderData && ' · обновляем…'}
        </p>
      </header>

      <ReviewsToolbar key={toolbarKey} />

      <section className="min-h-0 flex-1">
        {reviews.isPending ? (
          <ReviewsTableSkeleton />
        ) : reviews.isError && rows.length === 0 ? (
          <ReviewsErrorState message={reviews.error.message} onRetry={() => void refetch()} />
        ) : rows.length === 0 ? (
          <ReviewsEmptyState canReset={hasActiveFilters} onReset={resetFromEmptyState} />
        ) : (
          <ReviewsTable
            rows={rows}
            total={total}
            sort={filters.sort}
            order={filters.order}
            onSortChange={setFilters}
            hasNextPage={reviews.hasNextPage}
            isFetchingNextPage={reviews.isFetchingNextPage}
            isFetchNextPageError={reviews.isFetchNextPageError}
            isRefreshing={reviews.isPlaceholderData}
            onLoadMore={loadMore}
            scrollResetKey={JSON.stringify(filters)}
          />
        )}
      </section>
    </main>
  )
}
