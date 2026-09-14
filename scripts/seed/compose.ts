import type { Rng, Weighted } from './random.ts'
import { RELATED_TOPICS, TOPICS, sentimentWeights, type Sentiment, type Topic } from './topics.ts'
import {
  CAPS_PREFIXES,
  CITIES_IN,
  CLOSINGS,
  CONNECTORS,
  DETAILS,
  EMOJI,
  HARSH_MARKERS,
  OPENINGS,
  PRODUCTS,
  TYPOS,
  type Product,
} from './vocabulary.ts'

export type Gender = 'm' | 'f'

// Шаблоны ---------------------------------------------------------------------

export type TemplateContext = {
  rng: Rng
  gender: Gender
  product: Product
  productMentioned: boolean
  /** Подарок уже упомянут: «в подарок» и «это был подарок» в одном отзыве не повторяются */
  giftMentioned: boolean
  /** Сумма в рублях: одна на отзыв */
  amount: number | undefined
  /** Значения остальных слотов в пределах отзыва: номер заказа и срок не меняются между фразами */
  slots: Map<string, string>
}

export function createTemplateContext(rng: Rng, gender: Gender): TemplateContext {
  return {
    rng,
    gender,
    product: rng.pick(PRODUCTS),
    productMentioned: false,
    giftMentioned: false,
    amount: undefined,
    slots: new Map(),
  }
}

const GENDER_FORMS = /\{([^{}|]*)\|([^{}|]*)\}/g
const SLOT = /\{(\w+)\}/g
const ANY_SLOT = /\{\w+\}/
const PRODUCT_SLOT = /\{product(_acc)?\}/
const AMOUNT_LARGE_SLOT = /\{amount_large\}/
const GIFT = /подар/iu

export const LARGE_AMOUNT = 10_000

export function fillTemplate(template: string, ctx: TemplateContext): string {
  const text = template
    .replace(GENDER_FORMS, (_, male: string, female: string) => (ctx.gender === 'm' ? male : female))
    .replace(SLOT, (_, name: string) => slotValue(name, ctx))
  if (GIFT.test(text)) ctx.giftMentioned = true
  return text
}

function slotValue(name: string, ctx: TemplateContext): string {
  switch (name) {
    case 'product':
    case 'product_acc':
      ctx.productMentioned = true
      return name === 'product' ? ctx.product.nom : ctx.product.acc
    case 'amount':
      ctx.amount ??= roundedAmount(ctx.rng, 490, 24_990)
      return formatRubles(ctx.amount)
    case 'amount_large':
      if (ctx.amount === undefined || ctx.amount < LARGE_AMOUNT) {
        ctx.amount = roundedAmount(ctx.rng, LARGE_AMOUNT, 59_990)
      }
      return formatRubles(ctx.amount)
    default: {
      const cached = ctx.slots.get(name)
      if (cached !== undefined) return cached
      const value = randomSlotValue(name, ctx.rng)
      ctx.slots.set(name, value)
      return value
    }
  }
}

const DAY_FORMS = ['день', 'дня', 'дней'] as const
const MINUTE_FORMS = ['минуту', 'минуты', 'минут'] as const

function randomSlotValue(name: string, rng: Rng): string {
  switch (name) {
    case 'days_fast':
      return withUnit(rng.int(2, 4), DAY_FORMS)
    case 'days_long':
      return withUnit(rng.int(6, 25), DAY_FORMS)
    case 'minutes':
      return withUnit(rng.int(2, 15), MINUTE_FORMS)
    case 'order':
      return String(rng.int(10_000_000, 99_999_999))
    case 'city_in':
      return rng.pick(CITIES_IN)
    default:
      throw new Error(`Неизвестный слот {${name}}`)
  }
}

/**
 * Шаблон, который не противоречит уже написанному: товар и подарок не упоминаются второй раз,
 * «высокие ожидания» не идут после небольшой суммы. Резкие фразы можно исключить.
 */
function pickTemplate(
  rng: Rng,
  templates: readonly string[],
  ctx: TemplateContext,
  { avoidHarsh = false }: { avoidHarsh?: boolean } = {},
): string {
  const usable = templates.filter(
    (template) =>
      !(ctx.productMentioned && PRODUCT_SLOT.test(template)) &&
      !(ctx.giftMentioned && GIFT.test(template)) &&
      !(ctx.amount !== undefined && ctx.amount < LARGE_AMOUNT && AMOUNT_LARGE_SLOT.test(template)) &&
      !(avoidHarsh && isHarsh(template)),
  )
  return rng.pick(usable.length > 0 ? usable : templates)
}

export function plural(n: number, [one, few, many]: readonly [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

function withUnit(n: number, forms: readonly [string, string, string]): string {
  return `${n} ${plural(n, forms)}`
}

/** Сумма в диапазоне [min, max], оканчивающаяся на 90 */
function roundedAmount(rng: Rng, min: number, max: number): number {
  return rng.int(Math.ceil((min + 10) / 100), Math.floor((max + 10) / 100)) * 100 - 10
}

const NBSP = '\xA0'

/** «9 590 ₽»: разряды и знак рубля отделены неразрывным пробелом */
export function formatRubles(value: number): string {
  return `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)}${NBSP}₽`
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Первая буква строчная, кроме аббревиатур вроде «СБП» */
export function lowerFirst(text: string): string {
  const second = text.charAt(1)
  const isAbbreviation = second !== second.toLowerCase()
  return isAbbreviation ? text : text.charAt(0).toLowerCase() + text.slice(1)
}

/** Ключ для сравнения текстов: без регистра, «ё», пунктуации и эмодзи */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Резкий негатив: такой отзыв получает оценку 0–4 */
export function isHarsh(text: string): boolean {
  return HARSH_MARKERS.some((marker) => marker.test(text))
}

// Шум -------------------------------------------------------------------------

/** Порядок в массиве — порядок применения */
export const NOISE_KINDS = [
  'typo',
  'caps',
  'exclamations',
  'lowercase',
  'no_final_punctuation',
  'brackets',
  'emoji',
] as const

export type NoiseKind = (typeof NOISE_KINDS)[number]

export const MAX_NOISE_KINDS = 2

const NOISE_CHANCE: Record<Exclude<NoiseKind, 'typo'>, number> = {
  caps: 0.03,
  exclamations: 0.05,
  lowercase: 0.15,
  no_final_punctuation: 0.2,
  brackets: 0.05,
  emoji: 0.08,
}

// В позитивных отзывах опечаток должно быть не больше 2%
const TYPO_CHANCE: Record<Sentiment, number> = { positive: 0.015, neutral: 0.05, negative: 0.05 }

export const CONFLICTING_NOISE: readonly (readonly [NoiseKind, NoiseKind])[] = [
  ['caps', 'lowercase'],
  ['exclamations', 'no_final_punctuation'],
  ['brackets', 'no_final_punctuation'],
]

// «Ожидания были высокие)))» читается как сарказм
const HIGH_EXPECTATIONS_ENDING = /ожидания были высокие[.!]*$/u

const TYPO_VARIANTS = TYPOS.flatMap(([from, to]) => [
  [from, to] as const,
  [capitalize(from), capitalize(to)] as const,
])

function typoCandidates(text: string) {
  return TYPO_VARIANTS.filter(([from]) => text.includes(from))
}

function isApplicable(kind: NoiseKind, text: string, sentiment: Sentiment): boolean {
  switch (kind) {
    case 'caps':
    case 'exclamations':
      return sentiment === 'negative'
    case 'brackets':
      return sentiment === 'positive' && !HIGH_EXPECTATIONS_ENDING.test(text)
    case 'emoji':
      return sentiment !== 'neutral'
    case 'typo':
      return typoCandidates(text).length > 0
    default:
      return true
  }
}

function conflicts(a: NoiseKind, b: NoiseKind): boolean {
  return CONFLICTING_NOISE.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

function selectNoise(rng: Rng, text: string, sentiment: Sentiment): NoiseKind[] {
  const candidates = NOISE_KINDS.filter((kind) => {
    const chance = kind === 'typo' ? TYPO_CHANCE[sentiment] : NOISE_CHANCE[kind]
    return isApplicable(kind, text, sentiment) && rng.chance(chance)
  })
  const selected: NoiseKind[] = []
  for (const kind of rng.shuffle(candidates)) {
    if (selected.length === MAX_NOISE_KINDS) break
    if (!selected.some((other) => conflicts(kind, other))) selected.push(kind)
  }
  return NOISE_KINDS.filter((kind) => selected.includes(kind))
}

const NOISE_APPLIERS: Record<NoiseKind, (text: string, rng: Rng, sentiment: Sentiment) => string> = {
  typo: (text, rng) => {
    const [from, to] = rng.pick(typoCandidates(text))
    return text.replaceAll(from, to)
  },
  caps: (text, rng) => `${rng.pick(CAPS_PREFIXES)} ${text}`,
  exclamations: (text) => text.replace(/[.!]*$/, '!!!'),
  lowercase: (text) => lowerFirst(text),
  no_final_punctuation: (text) => text.replace(/[.!]+$/, ''),
  brackets: (text) => text.replace(/[.!]*$/, ')))'),
  emoji: (text, rng, sentiment) => (sentiment === 'neutral' ? text : `${text} ${rng.pick(EMOJI[sentiment])}`),
}

// Сборка отзыва ---------------------------------------------------------------

type Length = 'short' | 'medium' | 'long'

const LENGTHS: Weighted<Length> = [
  ['short', 15],
  ['medium', 55],
  ['long', 30],
]

const PART_CHANCE: Record<Length, { opening: number; detail: number; closing: number }> = {
  short: { opening: 0, detail: 0, closing: 0.6 },
  medium: { opening: 0.4, detail: 0.5, closing: 0.6 },
  long: { opening: 0.6, detail: 0.7, closing: 0.7 },
}

// Детали со слотами (сумма, город, срок) почти не повторяются между отзывами
const DETAILS_WITH_SLOTS = DETAILS.filter((template) => ANY_SLOT.test(template))

export type ComposeInput = { topic: Topic; sentiment: Sentiment; gender: Gender }

export type ComposedReview = {
  body: string
  noise: NoiseKind[]
  product: Product
  /** Вторая тема длинного отзыва */
  second: { topic: Topic; sentiment: Sentiment } | null
  /** Вторая тема с противоположной тональностью: оценка смещается к середине */
  mixed: boolean
  /** Резкий негатив: оценка смещается к 0–4 */
  harsh: boolean
  /** Тональность концовки, null — концовки нет */
  closing: Sentiment | null
}

export function composeReview(rng: Rng, { topic, sentiment, gender }: ComposeInput): ComposedReview {
  const ctx = createTemplateContext(rng, gender)
  const sentence = (templates: readonly string[]) => capitalize(fillTemplate(pickTemplate(rng, templates, ctx), ctx))
  const length = rng.weighted(LENGTHS)
  const chance = PART_CHANCE[length]
  const parts: string[] = []

  if (rng.chance(chance.opening)) parts.push(sentence(OPENINGS))
  parts.push(sentence(TOPICS[topic].phrases[sentiment]))
  if (rng.chance(chance.detail)) {
    parts.push(sentence(DETAILS))
  } else if (length === 'medium' && parts.length === 1) {
    // Средний отзыв без зачина и детали совпадал бы с коротким
    parts.push(sentence(DETAILS_WITH_SLOTS))
  }

  let second: ComposedReview['second'] = null
  if (length === 'long') {
    // Только связанные темы: иначе вторая фраза выглядит случайной репликой
    const secondTopic = rng.weighted(RELATED_TOPICS[topic].map((key) => [key, TOPICS[key].weight] as const))
    const secondSentiment = rng.weighted(sentimentWeights(TOPICS[secondTopic].shares))
    second = { topic: secondTopic, sentiment: secondSentiment }

    const connector = rng.pick(connectorsFor(sentiment, secondSentiment))
    // Резкая фраза в позитивном или нейтральном отзыве спорила бы с оценкой
    const template = pickTemplate(rng, TOPICS[secondTopic].phrases[secondSentiment], ctx, {
      avoidHarsh: sentiment !== 'negative',
    })
    const phrase = fillTemplate(template, ctx)
    parts.push(connector === '' ? capitalize(phrase) : connector + lowerFirst(phrase))
  }

  const mixed = second !== null && isOpposite(sentiment, second.sentiment)

  // После противоположной второй темы категоричная концовка звучит фальшиво
  const closing = rng.chance(chance.closing) ? (mixed ? 'neutral' : sentiment) : null
  if (closing !== null) parts.push(sentence(CLOSINGS[closing]))

  const text = parts.join(' ')
  const noise = selectNoise(rng, text, sentiment)
  const body = noise.reduce((result, kind) => NOISE_APPLIERS[kind](result, rng, sentiment), text)

  return {
    body,
    noise,
    product: ctx.product,
    second,
    mixed,
    harsh: sentiment === 'negative' && isHarsh(body),
    closing,
  }
}

function isOpposite(a: Sentiment, b: Sentiment): boolean {
  return (a === 'positive' && b === 'negative') || (a === 'negative' && b === 'positive')
}

function connectorsFor(main: Sentiment, second: Sentiment): readonly string[] {
  if (main === 'neutral' || second === 'neutral') return CONNECTORS.neutral
  if (main === second) return main === 'positive' ? CONNECTORS.samePositive : CONNECTORS.sameNegative
  return second === 'negative' ? CONNECTORS.toNegative : CONNECTORS.toPositive
}

/** Все шаблоны модуля — для проверки в тестах */
export function allTemplates(): string[] {
  return [
    ...OPENINGS,
    ...DETAILS,
    ...Object.values(CLOSINGS).flat(),
    ...Object.values(TOPICS).flatMap((spec) => Object.values(spec.phrases).flat()),
  ]
}
