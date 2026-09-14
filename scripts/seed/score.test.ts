// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createRng } from './random.ts'
import { pickScore, type ScoreFactors } from './score.ts'
import type { Sentiment } from './topics.ts'

function scores(sentiment: Sentiment, factors: Partial<ScoreFactors> = {}): number[] {
  const rng = createRng(11)
  const values = new Set(
    Array.from({ length: 2000 }, () => pickScore(rng, sentiment, { mixed: false, harsh: false, ...factors })),
  )
  return [...values].sort((a, b) => a - b)
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

describe('pickScore', () => {
  it('позитив — 8–10', () => {
    expect(scores('positive')).toEqual(range(8, 10))
  })

  it('нейтрал — 6–9, в том числе со второй темой', () => {
    expect(scores('neutral')).toEqual(range(6, 9))
    expect(scores('neutral', { mixed: true })).toEqual(range(6, 9))
  })

  it('негатив — 0–7', () => {
    expect(scores('negative')).toEqual(range(0, 7))
  })

  it('смешанный отзыв сдвигает оценку к середине', () => {
    expect(scores('positive', { mixed: true })).toEqual(range(8, 10))
    expect(scores('negative', { mixed: true })).toEqual(range(4, 7))
  })

  it('резкий негатив — 0–4, даже если отзыв смешанный', () => {
    expect(scores('negative', { harsh: true })).toEqual(range(0, 4))
    expect(scores('negative', { harsh: true, mixed: true })).toEqual(range(0, 4))
  })
})
