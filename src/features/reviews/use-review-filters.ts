import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import { DEFAULT_REVIEW_FILTERS, hasActiveFilters, parseReviewFilters, toReviewSearch, type ReviewFilters } from './schema'

const ROUTE = '/datasets/$datasetId'

/** Фильтры таблицы отзывов хранятся в URL, поэтому ссылкой можно поделиться */
export function useReviewFilters() {
  const search = useSearch({ from: ROUTE })
  const navigate = useNavigate({ from: ROUTE })
  const filters = useMemo(() => parseReviewFilters(search), [search])

  /** Фильтры и сортировка — новая запись в истории: «Назад» отменяет изменение */
  const setFilters = useCallback(
    (patch: Partial<ReviewFilters>) => {
      void navigate({ search: (prev) => toReviewSearch({ ...parseReviewFilters(prev), ...patch }) })
    },
    [navigate],
  )

  /** Поиск заменяет текущую запись: набор текста не засоряет историю */
  const setSearchText = useCallback(
    (q: string) => {
      void navigate({ search: (prev) => toReviewSearch({ ...parseReviewFilters(prev), q }), replace: true })
    },
    [navigate],
  )

  /** Сбрасывает фильтры и поиск, сортировку оставляет */
  const resetFilters = useCallback(() => {
    void navigate({
      search: (prev) => {
        const { sort, order } = parseReviewFilters(prev)
        return toReviewSearch({ ...DEFAULT_REVIEW_FILTERS, sort, order })
      },
    })
  }, [navigate])

  return { filters, setFilters, setSearchText, resetFilters, hasActiveFilters: hasActiveFilters(filters) }
}
