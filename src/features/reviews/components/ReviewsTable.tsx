import { useTable, type SortingState } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ReviewListItem } from '../api'
import { formatCount } from '../format'
import { isSortField, type SortField, type SortOrder } from '../schema'
import { COLUMN_CLASS, TABLE_MIN_WIDTH_CLASS, reviewColumns, reviewTableFeatures } from './columns'

/** Фиксированная высота строки: текст отзыва обрезается до двух строк */
export const ROW_HEIGHT = 64

/** Фиксированная высота заголовка: виртуализатор отсчитывает строки от его нижнего края */
export const HEADER_HEIGHT = 40

/** Следующая страница запрашивается, когда до конца загруженных строк остаётся меньше этого числа */
const PREFETCH_ROWS = 20

export type ReviewsTableProps = {
  rows: ReviewListItem[]
  /** Общее число отзывов по фильтрам */
  total: number | null
  sort: SortField
  order: SortOrder
  onSortChange: (sorting: { sort: SortField; order: SortOrder }) => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  /** Показаны прежние строки, пока грузятся строки по новым фильтрам */
  isRefreshing: boolean
  onLoadMore: () => void
  /** Меняется вместе с фильтрами: прокрутка возвращается к началу */
  scrollResetKey: string
}

export function ReviewsTable({
  rows,
  total,
  sort,
  order,
  onSortChange,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  isRefreshing,
  onLoadMore,
  scrollResetKey,
}: ReviewsTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const sorting: SortingState = [{ id: sort, desc: order === 'desc' }]

  const table = useTable({
    features: reviewTableFeatures,
    columns: reviewColumns,
    data: rows,
    getRowId: (row) => String(row.id),
    // Сортировку хранит URL, таблица только показывает её и сообщает о кликах по заголовкам
    state: { sorting },
    manualSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    onSortingChange: (updater) => {
      const [next] = typeof updater === 'function' ? updater(sorting) : updater
      if (next && isSortField(next.id)) onSortChange({ sort: next.id, order: next.desc ? 'desc' : 'asc' })
    },
  })
  const tableRows = table.getRowModel().rows

  // Последняя виртуальная строка — служебная: подгрузка, ошибка или конец списка
  const virtualizer = useVirtualizer({
    count: tableRows.length + 1,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    scrollMargin: HEADER_HEIGHT,
    overscan: 10,
  })
  const virtualItems = virtualizer.getVirtualItems()
  const lastVisibleIndex = virtualItems.at(-1)?.index ?? -1

  useEffect(() => {
    const nearEnd = lastVisibleIndex >= tableRows.length - PREFETCH_ROWS
    if (nearEnd && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) onLoadMore()
  }, [lastVisibleIndex, tableRows.length, hasNextPage, isFetchingNextPage, isFetchNextPageError, onLoadMore])

  useEffect(() => {
    virtualizer.scrollToOffset(0)
  }, [scrollResetKey, virtualizer])

  return (
    <div
      ref={scrollRef}
      className={cn('h-full overflow-auto rounded-lg border transition-opacity', isRefreshing && 'opacity-60')}
      aria-busy={isRefreshing || isFetchingNextPage}
    >
      <table className={cn('grid w-full', TABLE_MIN_WIDTH_CLASS)} aria-rowcount={(total ?? rows.length) + 1}>
        <thead className="sticky top-0 z-10 grid bg-background">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="flex w-full border-b"
              style={{ height: HEADER_HEIGHT }}
              aria-rowindex={1}
            >
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                return (
                  <th
                    key={header.id}
                    aria-sort={canSort ? ARIA_SORT[sorted || 'none'] : undefined}
                    className={cn(
                      'flex items-center px-3 text-left text-xs font-medium text-muted-foreground',
                      COLUMN_CLASS[header.column.id],
                    )}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2.5 text-xs text-muted-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <table.FlexRender header={header} />
                        <SortIcon direction={sorted} />
                      </Button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody className="relative grid" style={{ height: virtualizer.getTotalSize() }}>
          {virtualItems.map((virtualItem) => {
            const row = tableRows[virtualItem.index]
            const style = {
              height: ROW_HEIGHT,
              transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
            }

            if (!row) {
              return (
                <tr key="status" className="absolute top-0 left-0 flex w-full" style={style}>
                  <td className="flex w-full items-center justify-center gap-3 text-sm text-muted-foreground">
                    <ListStatus
                      loaded={rows.length}
                      hasNextPage={hasNextPage}
                      isFetchNextPageError={isFetchNextPageError}
                      onRetry={onLoadMore}
                    />
                  </td>
                </tr>
              )
            }

            return (
              <tr
                key={row.id}
                className="absolute top-0 left-0 flex w-full overflow-hidden border-b hover:bg-muted/50"
                style={style}
                aria-rowindex={virtualItem.index + 2}
              >
                {row.getAllCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn('flex h-full items-center overflow-hidden px-3 py-2 text-sm', COLUMN_CLASS[cell.column.id])}
                  >
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending', none: 'none' } as const

function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') return <ArrowUp data-icon="inline-end" aria-hidden />
  if (direction === 'desc') return <ArrowDown data-icon="inline-end" aria-hidden />
  return <ArrowUpDown data-icon="inline-end" className="opacity-50" aria-hidden />
}

function ListStatus({
  loaded,
  hasNextPage,
  isFetchNextPageError,
  onRetry,
}: {
  loaded: number
  hasNextPage: boolean
  isFetchNextPageError: boolean
  onRetry: () => void
}) {
  if (isFetchNextPageError) {
    return (
      <>
        <span>Не удалось загрузить продолжение</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Повторить
        </Button>
      </>
    )
  }
  if (hasNextPage) return <span>Загружаем ещё…</span>
  return <span>Показаны все отзывы: {formatCount(loaded)}</span>
}
