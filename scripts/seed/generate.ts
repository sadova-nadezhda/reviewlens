import type { TablesInsert } from '../../src/lib/database.types.ts'
import { composeReview, normalizeText, type ComposedReview, type Gender } from './compose.ts'
import { createDatePicker } from './dates.ts'
import { createRng, type Rng } from './random.ts'
import { pickScore } from './score.ts'
import { SENTIMENTS, TOPIC_KEYS, TOPICS, type Sentiment, type Topic } from './topics.ts'
import { FEMALE_NAMES, MALE_NAMES, SOURCES, SURNAME_INITIALS } from './vocabulary.ts'

type ReviewInsert = TablesInsert<'reviews'>

/** Строка для вставки в reviews без dataset_id. Поля, которые генератор заполняет всегда, не nullable. */
export type DemoReview = Required<Pick<ReviewInsert, 'author' | 'source'>> & {
  body: string
  score: number
  sentiment: NonNullable<ReviewInsert['sentiment']>
  topic: NonNullable<ReviewInsert['topic']>
  reviewed_at: string
  analysis_status: NonNullable<ReviewInsert['analysis_status']>
  analyzed_at: string
}

/** Как собран текст: для проверок, в базу не попадает */
export type ReviewMeta = Omit<ComposedReview, 'body'>

export type GeneratedReview = { review: DemoReview; meta: ReviewMeta }

export type GenerateOptions = {
  count: number
  seed: number
  now: Date
}

export type Slot = { topic: Topic; sentiment: Sentiment }

/**
 * Квоты по парам «тема × тональность» методом наибольшего остатка:
 * доли в выборке совпадают с TOPICS с точностью до округления, а не до случайного разброса.
 */
export function allocateSlots(count: number): Slot[] {
  const totalWeight = TOPIC_KEYS.reduce((sum, topic) => sum + TOPICS[topic].weight, 0)
  const cells = TOPIC_KEYS.flatMap((topic) =>
    SENTIMENTS.map((sentiment) => {
      const exact = (count * TOPICS[topic].weight * TOPICS[topic].shares[sentiment]) / (totalWeight * 100)
      return { topic, sentiment, quota: Math.floor(exact), remainder: exact - Math.floor(exact) }
    }),
  )

  let rest = count - cells.reduce((sum, cell) => sum + cell.quota, 0)
  for (const cell of [...cells].sort((a, b) => b.remainder - a.remainder)) {
    if (rest === 0) break
    cell.quota++
    rest--
  }

  return cells.flatMap(({ topic, sentiment, quota }) => Array.from({ length: quota }, () => ({ topic, sentiment })))
}

/**
 * Переставляет элементы так, чтобы соседние не совпадали по ключу.
 * Дубль меняется местами с ближайшим подходящим элементом: сначала справа, потом слева.
 * Если развести невозможно (например, все элементы одинаковые), порядок остаётся.
 */
export function separateAdjacentDuplicates<T>(items: readonly T[], key: (item: T) => string): T[] {
  const result = [...items]
  const keys = result.map(key)

  const swap = (a: number, b: number) => {
    ;[result[a], result[b]] = [result[b], result[a]]
    ;[keys[a], keys[b]] = [keys[b], keys[a]]
  }
  const clashAt = (position: number) =>
    position > 0 && position < keys.length && keys[position] === keys[position - 1]
  const trySwap = (a: number, b: number) => {
    swap(a, b)
    if (![a, a + 1, b, b + 1].some(clashAt)) return true
    swap(a, b)
    return false
  }

  for (let i = 1; i < keys.length; i++) {
    if (!clashAt(i)) continue
    let fixed = false
    for (let j = i + 1; j < keys.length && !fixed; j++) fixed = trySwap(i, j)
    for (let p = i - 2; p >= 0 && !fixed; p--) fixed = trySwap(p, i)
  }

  return result
}

function pickAuthor(rng: Rng, gender: Gender): string | null {
  if (rng.chance(0.15)) return null
  const name = rng.pick(gender === 'f' ? FEMALE_NAMES : MALE_NAMES)
  return rng.chance(0.65) ? `${name} ${rng.pick(SURNAME_INITIALS)}.` : name
}

/**
 * Демо-отзывы в хронологическом порядке, с описанием того, как собран каждый текст.
 * id в базе будут расти вместе с датой. Одинаковые тексты не стоят рядом.
 */
export function generateReviewsWithMeta({ count, seed, now }: GenerateOptions): GeneratedReview[] {
  const rng = createRng(seed)
  const pickDate = createDatePicker(now)

  const drafts = rng.shuffle(allocateSlots(count)).map(({ topic, sentiment }) => {
    const gender: Gender = rng.chance(0.6) ? 'f' : 'm'
    const { body, ...meta } = composeReview(rng, { topic, sentiment, gender })
    return {
      reviewedAt: pickDate(rng, topic, sentiment),
      content: {
        fields: {
          body,
          score: pickScore(rng, sentiment, meta),
          author: pickAuthor(rng, gender),
          source: rng.weighted(SOURCES),
          sentiment,
          topic,
        },
        meta,
      },
    }
  })

  drafts.sort((a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime())

  // Даты остаются на местах, переставляется только содержимое соседних отзывов
  const contents = separateAdjacentDuplicates(
    drafts.map((draft) => draft.content),
    (content) => normalizeText(content.fields.body),
  )

  return drafts.map(({ reviewedAt }, i) => {
    const { fields, meta } = contents[i]
    const analyzedAt = Math.min(reviewedAt.getTime() + rng.int(2, 240) * 60_000, now.getTime())
    return {
      review: {
        ...fields,
        reviewed_at: reviewedAt.toISOString(),
        analysis_status: 'done',
        analyzed_at: new Date(analyzedAt).toISOString(),
      },
      meta,
    }
  })
}

export function generateReviews(options: GenerateOptions): DemoReview[] {
  return generateReviewsWithMeta(options).map(({ review }) => review)
}
