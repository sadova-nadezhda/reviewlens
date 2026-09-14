import type { AnalysisStatus, Sentiment, SortField, Topic } from './schema'

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  positive: 'Позитив',
  neutral: 'Нейтрально',
  negative: 'Негатив',
}

export const TOPIC_LABELS: Record<Topic, string> = {
  delivery: 'Доставка',
  product_quality: 'Качество товара',
  price: 'Цена',
  assortment: 'Ассортимент и наличие',
  packaging: 'Упаковка',
  payment: 'Оплата',
  returns: 'Возврат и обмен',
  support: 'Поддержка',
  website_app: 'Сайт и приложение',
  other: 'Другое',
}

export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  pending: 'Ожидает анализа',
  done: 'Проанализирован',
  error: 'Ошибка анализа',
}

export const SORT_FIELD_LABELS: Record<SortField, string> = {
  reviewed_at: 'Дата',
  score: 'Оценка',
}
