import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/database.types.ts'
import { chunk } from './seed/chunk.ts'
import { parseSeedEnv } from './seed/env.ts'
import { generateReviews, type DemoReview } from './seed/generate.ts'

/** Фиксированный id: повторный запуск обновляет тот же демо-датасет, а не создаёт новый */
const DEMO_DATASET_ID = 'de300000-0000-4000-a000-000000000001'
const REVIEW_COUNT = 5000
/** Тексты одинаковы при каждом запуске; даты отсчитываются от дня запуска */
const SEED = 20260914
const BATCH_SIZE = 500

type Client = SupabaseClient<Database>

async function main(): Promise<void> {
  const env = parseSeedEnv(process.env)
  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  // service_role обходит RLS: демо-датасет может менять только он
  const admin = createClient<Database>(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options)
  const anon = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, options)

  const reviews = generateReviews({ count: REVIEW_COUNT, seed: SEED, now: new Date() })
  console.log(`Сгенерировано отзывов: ${reviews.length}`)

  await upsertDemoDataset(admin)
  await deleteDemoReviews(admin)
  await insertDemoReviews(admin, reviews)
  await verify(admin, anon)
}

async function upsertDemoDataset(admin: Client): Promise<void> {
  const { error } = await admin.from('datasets').upsert({
    id: DEMO_DATASET_ID,
    owner_id: null,
    name: 'Демо: интернет-магазин',
    description: `${REVIEW_COUNT} отзывов покупателей за последние 12 месяцев`,
    is_demo: true,
  })
  if (error) throw new Error(`Не удалось создать демо-датасет: ${error.message}`)
  console.log(`Демо-датасет: ${DEMO_DATASET_ID}`)
}

// Только DELETE: TRUNCATE не вызывает триггеры, и reviews_count разошёлся бы с данными
async function deleteDemoReviews(admin: Client): Promise<void> {
  const { error, count } = await admin
    .from('reviews')
    .delete({ count: 'exact' })
    .eq('dataset_id', DEMO_DATASET_ID)
  if (error) throw new Error(`Не удалось удалить старые отзывы: ${error.message}`)
  console.log(`Удалено старых отзывов: ${count ?? 0}`)
}

async function insertDemoReviews(admin: Client, reviews: readonly DemoReview[]): Promise<void> {
  const batches = chunk(reviews, BATCH_SIZE)
  let inserted = 0
  for (const [index, batch] of batches.entries()) {
    const { error } = await admin
      .from('reviews')
      .insert(batch.map((review) => ({ ...review, dataset_id: DEMO_DATASET_ID })))
    if (error) {
      throw new Error(
        `Пачка ${index + 1}/${batches.length} не вставлена: ${error.message}. ` +
          'Запустите seed ещё раз: он удалит частично вставленные отзывы и начнёт заново.',
      )
    }
    inserted += batch.length
    console.log(`Вставлено ${inserted} / ${reviews.length}`)
  }
}

async function verify(admin: Client, anon: Client): Promise<void> {
  const { data: dataset, error } = await admin
    .from('datasets')
    .select('reviews_count, analyzed_count')
    .eq('id', DEMO_DATASET_ID)
    .single()
  if (error) throw new Error(`Не удалось прочитать демо-датасет: ${error.message}`)
  if (dataset.reviews_count !== REVIEW_COUNT || dataset.analyzed_count !== REVIEW_COUNT) {
    throw new Error(
      `Счётчики не сошлись: reviews_count=${dataset.reviews_count}, analyzed_count=${dataset.analyzed_count}, ` +
        `ожидалось ${REVIEW_COUNT}`,
    )
  }

  // Анонимный посетитель должен видеть демо — заодно проверка политик чтения
  const { count, error: anonError } = await anon
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('dataset_id', DEMO_DATASET_ID)
  if (anonError) throw new Error(`Анонимный клиент не смог прочитать отзывы: ${anonError.message}`)
  if (count !== REVIEW_COUNT) {
    throw new Error(`Анонимный клиент видит ${count ?? 0} отзывов из ${REVIEW_COUNT}: проверьте политики RLS`)
  }

  console.log(`Готово: ${REVIEW_COUNT} отзывов, счётчики сходятся, анонимный клиент видит демо-датасет`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
