import { CircleAlert, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { npsGroup, type NpsGroup } from '@/lib/nps'
import { cn } from '@/lib/utils'
import { formatReviewDate } from '../format'
import { ANALYSIS_STATUS_LABELS, SENTIMENT_LABELS, TOPIC_LABELS } from '../labels'
import type { AnalysisStatus, Sentiment, Topic } from '../schema'

export function EmptyValue() {
  return (
    <span className="text-muted-foreground" aria-label="Нет данных">
      —
    </span>
  )
}

/** Только дата; время — во всплывающей подсказке */
export function ReviewDate({ value }: { value: string | null }) {
  if (value === null) return <EmptyValue />
  const { date, time } = formatReviewDate(value)
  return (
    <time dateTime={value} title={`${date}, ${time}`} className="whitespace-nowrap">
      {date}
    </time>
  )
}

const SCORE_STYLES: Record<NpsGroup, { className: string; label: string }> = {
  promoter: { className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', label: 'промоутер' },
  passive: { className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', label: 'нейтральный' },
  detractor: { className: 'bg-red-500/10 text-red-700 dark:text-red-400', label: 'критик' },
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <EmptyValue />
  const style = SCORE_STYLES[npsGroup(score)]
  return (
    <Badge
      variant="secondary"
      className={cn('min-w-8 tabular-nums', style.className)}
      aria-label={`Оценка ${score} из 10, ${style.label}`}
    >
      {score}
    </Badge>
  )
}

const SENTIMENT_STYLES: Record<Sentiment, string> = {
  positive: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  neutral: 'bg-muted text-muted-foreground',
  negative: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

export function SentimentBadge({ sentiment }: { sentiment: Sentiment | null }) {
  if (sentiment === null) return <EmptyValue />
  return (
    <Badge variant="secondary" className={SENTIMENT_STYLES[sentiment]}>
      {SENTIMENT_LABELS[sentiment]}
    </Badge>
  )
}

export function TopicLabel({ topic }: { topic: Topic | null }) {
  if (topic === null) return <EmptyValue />
  return <span className="truncate">{TOPIC_LABELS[topic]}</span>
}

/** Бейдж только для отзывов, которые требуют внимания: done — обычное состояние, его не показываем */
export function AnalysisStatusBadge({ status }: { status: AnalysisStatus }) {
  switch (status) {
    case 'done':
      return null
    case 'pending':
      return (
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <Clock data-icon="inline-start" aria-hidden />
          {ANALYSIS_STATUS_LABELS.pending}
        </Badge>
      )
    case 'error':
      return (
        <Badge variant="destructive">
          <CircleAlert data-icon="inline-start" aria-hidden />
          {ANALYSIS_STATUS_LABELS.error}
        </Badge>
      )
  }
}

/**
 * Две строки по 20 px — 40 px: помещаются в строку таблицы 64 px с отступами 8 px.
 * Высота задана в px, а не в rem, чтобы крупный шрифт браузера не вытолкнул текст за пределы строки.
 */
export const TWO_LINES_TEXT_CLASS = 'line-clamp-2 max-h-[40px] overflow-hidden text-sm leading-[20px] break-words'

export function TextValue({ value, lines = 1 }: { value: string | null; lines?: 1 | 2 }) {
  if (value === null || value.trim() === '') return <EmptyValue />
  return (
    <span className={lines === 2 ? TWO_LINES_TEXT_CLASS : 'truncate'} title={value}>
      {value}
    </span>
  )
}
