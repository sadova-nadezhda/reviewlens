import { createColumnHelper, rowSortingFeature, tableFeatures } from '@tanstack/react-table'
import type { ReviewListItem } from '../api'
import { AnalysisStatusBadge, ReviewDate, ScoreBadge, SentimentBadge, TextValue, TopicLabel } from './cells'

// Сортировка и фильтрация идут на сервере: rowSortingFeature нужен только для состояния заголовков
export const reviewTableFeatures = tableFeatures({ rowSortingFeature })

const column = createColumnHelper<typeof reviewTableFeatures, ReviewListItem>()

// Автор и источник появятся в карточке отзыва: в таблице с ними не хватает ширины
export const reviewColumns = column.columns([
  column.accessor('reviewed_at', {
    header: 'Дата',
    cell: (info) => <ReviewDate value={info.getValue()} />,
    enableSorting: true,
    sortDescFirst: true,
  }),
  column.accessor('score', {
    header: 'Оценка',
    cell: (info) => <ScoreBadge score={info.getValue()} />,
    enableSorting: true,
    sortDescFirst: true,
  }),
  column.accessor('sentiment', {
    header: 'Тональность',
    cell: (info) => <SentimentBadge sentiment={info.getValue()} />,
    enableSorting: false,
  }),
  column.accessor('topic', {
    header: 'Тема',
    cell: (info) => <TopicLabel topic={info.getValue()} />,
    enableSorting: false,
  }),
  column.accessor('body', {
    header: 'Текст отзыва',
    cell: (info) => <TextValue value={info.getValue()} lines={2} />,
    enableSorting: false,
  }),
  column.accessor('analysis_status', {
    header: 'Анализ',
    cell: (info) => <AnalysisStatusBadge status={info.getValue()} />,
    enableSorting: false,
  }),
])

/** Ширина колонок: у текста вся оставшаяся ширина, остальные фиксированы */
export const COLUMN_CLASS: Record<string, string> = {
  reviewed_at: 'w-28 shrink-0',
  score: 'w-24 shrink-0',
  sentiment: 'w-32 shrink-0',
  topic: 'w-44 shrink-0',
  body: 'min-w-80 flex-1',
  analysis_status: 'w-40 shrink-0',
}

/** Сумма ширин колонок (112 + 96 + 128 + 176 + 320 + 160) */
export const TABLE_MIN_WIDTH_CLASS = 'min-w-[992px]'
