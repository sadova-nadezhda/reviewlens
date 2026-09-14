// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  CONFLICTING_NOISE,
  LARGE_AMOUNT,
  MAX_NOISE_KINDS,
  NOISE_KINDS,
  allTemplates,
  composeReview,
  createTemplateContext,
  fillTemplate,
  formatRubles,
  isHarsh,
  lowerFirst,
  normalizeText,
  plural,
  type NoiseKind,
} from './compose.ts'
import { createRng } from './random.ts'
import { SENTIMENTS, TOPIC_KEYS, TOPICS } from './topics.ts'
import { CLOSINGS, DETAILS, OPENINGS } from './vocabulary.ts'

const DAY_FORMS = ['день', 'дня', 'дней'] as const
const NBSP = '\xA0'

const parseRubles = (text: string) => Number(text.replace(/\D/g, ''))

describe('plural', () => {
  it.each([
    [1, 'день'],
    [2, 'дня'],
    [4, 'дня'],
    [5, 'дней'],
    [11, 'дней'],
    [12, 'дней'],
    [14, 'дней'],
    [21, 'день'],
    [22, 'дня'],
    [25, 'дней'],
    [111, 'дней'],
  ])('%i → %s', (n, expected) => {
    expect(plural(n, DAY_FORMS)).toBe(expected)
  })
})

describe('formatRubles', () => {
  it.each([
    [490, `490${NBSP}₽`],
    [9590, `9${NBSP}590${NBSP}₽`],
    [24_990, `24${NBSP}990${NBSP}₽`],
    [1_000_000, `1${NBSP}000${NBSP}000${NBSP}₽`],
  ])('%i → %s', (value, expected) => {
    expect(formatRubles(value)).toBe(expected)
  })
})

describe('fillTemplate', () => {
  const context = (seed = 1, gender: 'm' | 'f' = 'f') => createTemplateContext(createRng(seed), gender)

  it('выбирает форму по полу автора', () => {
    const template = '{Купил|Купила} и {доволен|довольна}'
    expect(fillTemplate(template, context(1, 'm'))).toBe('Купил и доволен')
    expect(fillTemplate(template, context(1, 'f'))).toBe('Купила и довольна')
  })

  it('подставляет одно значение слота в пределах отзыва', () => {
    const ctx = context()
    const [first, second] = fillTemplate('{order} {order}', ctx).split(' ')
    expect(first).toBe(second)
    expect(fillTemplate('№{order}', ctx)).toBe(`№${first}`)
  })

  it('сумма для «высоких ожиданий» не меньше LARGE_AMOUNT и совпадает с обычной суммой отзыва', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const ctx = context(seed)
      const large = fillTemplate('{amount_large}', ctx)
      expect(parseRubles(large)).toBeGreaterThanOrEqual(LARGE_AMOUNT)
      expect(fillTemplate('{amount}', ctx)).toBe(large)
    }
  })

  it('падает на неизвестном слоте', () => {
    expect(() => fillTemplate('{unknown}', context())).toThrow('unknown')
  })

  it('заполняет все шаблоны модуля без остатков разметки', () => {
    for (const template of allTemplates()) {
      for (const gender of ['m', 'f'] as const) {
        expect(fillTemplate(template, context(1, gender)), template).not.toMatch(/[{}|]/)
      }
    }
  })

  it('шаблоны не повторяются', () => {
    const templates = allTemplates()
    expect(new Set(templates).size).toBe(templates.length)
  })
})

describe('isHarsh', () => {
  it.each([
    ['Ужасный сервис.', true],
    ['УЖАС. Курьер опоздал.', true],
    ['больше заказывать не буду', true],
    ['Курьер опоздал на час.', false],
    ['Цена ниже, чем у конкурентов.', false],
  ])('%s → %s', (text, expected) => {
    expect(isHarsh(text)).toBe(expected)
  })

  it('резкие маркеры встречаются только в негативных шаблонах', () => {
    const notNegative = [
      ...OPENINGS,
      ...DETAILS,
      ...CLOSINGS.positive,
      ...CLOSINGS.neutral,
      ...TOPIC_KEYS.flatMap((topic) => [...TOPICS[topic].phrases.positive, ...TOPICS[topic].phrases.neutral]),
    ]
    expect(notNegative.filter(isHarsh)).toEqual([])
  })
})

describe('lowerFirst', () => {
  it('делает первую букву строчной', () => {
    expect(lowerFirst('Курьер опоздал')).toBe('курьер опоздал')
  })

  it('не трогает аббревиатуры', () => {
    expect(lowerFirst('СБП работает')).toBe('СБП работает')
  })
})

describe('normalizeText', () => {
  it('игнорирует регистр, «ё», пунктуацию и эмодзи', () => {
    expect(normalizeText('Всё отлично!!! 👍')).toBe(normalizeText('все отлично'))
  })
})

describe('composeReview', () => {
  const rng = createRng(2026)
  const samples = Array.from({ length: 3000 }, (_, i) =>
    composeReview(rng, {
      topic: TOPIC_KEYS[i % TOPIC_KEYS.length],
      sentiment: SENTIMENTS[i % SENTIMENTS.length],
      gender: i % 2 === 0 ? 'f' : 'm',
    }),
  )

  it(`применяет не больше ${MAX_NOISE_KINDS} видов шума к одному отзыву`, () => {
    expect(Math.max(...samples.map((sample) => sample.noise.length))).toBeLessThanOrEqual(MAX_NOISE_KINDS)
  })

  it('не сочетает конфликтующие виды шума', () => {
    const hasBoth = (noise: NoiseKind[], [a, b]: readonly [NoiseKind, NoiseKind]) =>
      noise.includes(a) && noise.includes(b)
    for (const pair of CONFLICTING_NOISE) {
      expect(samples.some((sample) => hasBoth(sample.noise, pair))).toBe(false)
    }
  })

  it('использует каждый вид шума', () => {
    const used = new Set(samples.flatMap((sample) => sample.noise))
    expect([...used].sort()).toEqual([...NOISE_KINDS].sort())
  })

  it('собирает тексты в пределах ограничений базы и без разметки', () => {
    for (const { body } of samples) {
      expect(body.trim().length).toBeGreaterThan(0)
      expect(body.length).toBeLessThanOrEqual(10_000)
      expect(body).not.toMatch(/[{}|]/)
    }
  })

  it('не добавляет эмодзи в нейтральные отзывы', () => {
    const neutral = samples.filter((_, i) => SENTIMENTS[i % SENTIMENTS.length] === 'neutral')
    expect(neutral.filter(({ body }) => /\p{Extended_Pictographic}/u.test(body))).toEqual([])
  })
})
