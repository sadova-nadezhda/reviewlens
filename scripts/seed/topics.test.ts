// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { Constants } from '../../src/lib/database.types.ts'
import {
  RELATED_TOPICS,
  SENTIMENTS,
  TARGET_SENTIMENT_SHARES,
  TOPIC_KEYS,
  TOPICS,
  overallSentimentShares,
} from './topics.ts'

describe('TOPICS', () => {
  it('содержит ровно темы из enum review_topic', () => {
    expect(Object.keys(TOPICS).sort()).toEqual([...Constants.public.Enums.review_topic].sort())
  })

  it('веса тем в сумме дают 100', () => {
    expect(TOPIC_KEYS.reduce((sum, topic) => sum + TOPICS[topic].weight, 0)).toBe(100)
  })

  it.each(TOPIC_KEYS)('доли тональностей в теме %s в сумме дают 100', (topic) => {
    expect(SENTIMENTS.reduce((sum, sentiment) => sum + TOPICS[topic].shares[sentiment], 0)).toBe(100)
  })

  it('доли по темам с учётом весов дают целевые итоговые 50/20/30', () => {
    expect(overallSentimentShares()).toEqual(TARGET_SENTIMENT_SHARES)
  })

  it.each(TOPIC_KEYS)('в теме %s не меньше 8 фраз на каждую тональность', (topic) => {
    for (const sentiment of SENTIMENTS) {
      expect(TOPICS[topic].phrases[sentiment].length).toBeGreaterThanOrEqual(8)
    }
  })
})

describe('RELATED_TOPICS', () => {
  it.each(TOPIC_KEYS)('у темы %s есть связанные темы, без неё самой и без повторов', (topic) => {
    const related = RELATED_TOPICS[topic]
    expect(related.length).toBeGreaterThan(0)
    expect(related).not.toContain(topic)
    expect(new Set(related).size).toBe(related.length)
  })
})
