import type { Rng, Weighted } from './random.ts'
import type { Sentiment } from './topics.ts'

// Веса оценок 0–10. Промоутеры — 9–10, критики — 0–6.
export const SCORE_WEIGHTS: Record<Sentiment, Weighted<number>> = {
  positive: [
    [10, 60],
    [9, 30],
    [8, 10],
  ],
  neutral: [
    [6, 5],
    [7, 45],
    [8, 35],
    [9, 15],
  ],
  negative: [
    [0, 6],
    [1, 13],
    [2, 13],
    [3, 15],
    [4, 16],
    [5, 16],
    [6, 15],
    [7, 6],
  ],
}

/** Отзыв со второй темой противоположной тональности: оценка ближе к середине */
export const MIXED_SCORE_WEIGHTS: Record<Exclude<Sentiment, 'neutral'>, Weighted<number>> = {
  positive: [
    [8, 35],
    [9, 50],
    [10, 15],
  ],
  negative: [
    [4, 20],
    [5, 25],
    [6, 30],
    [7, 25],
  ],
}

/** Резкий негатив («ужасный сервис», «больше заказывать не буду»): текст не должен спорить с оценкой */
export const HARSH_SCORE_WEIGHTS: Weighted<number> = [
  [0, 15],
  [1, 25],
  [2, 25],
  [3, 20],
  [4, 15],
]

export type ScoreFactors = { mixed: boolean; harsh: boolean }

export function pickScore(rng: Rng, sentiment: Sentiment, { mixed, harsh }: ScoreFactors): number {
  if (sentiment === 'negative' && harsh) return rng.weighted(HARSH_SCORE_WEIGHTS)
  if (mixed && sentiment !== 'neutral') return rng.weighted(MIXED_SCORE_WEIGHTS[sentiment])
  return rng.weighted(SCORE_WEIGHTS[sentiment])
}
