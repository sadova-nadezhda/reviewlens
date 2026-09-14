// @vitest-environment node
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/database.types'
import { REVIEWS_PAGE_SIZE } from './pagination'
import { DEFAULT_REVIEW_FILTERS, type ReviewFilters } from './schema'
import { fetchReviewsPage, reviewsInfiniteQueryOptions, type ReviewListItem, type ReviewsPage } from './api'

// Модуль клиента проверяет env при импорте; в этих тестах клиент создаётся отдельно
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const DATASET_ID = 'de300000-0000-4000-a000-000000000001'

type CapturedRequest = { url: URL; headers: Headers }

/** Настоящий клиент supabase-js с подменённым fetch: проверяем реальный запрос без сети */
function createTestClient(respond: () => Response) {
  const requests: CapturedRequest[] = []
  const client = createClient<Database>('https://test.supabase.co', 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init)
        requests.push({ url: new URL(request.url), headers: request.headers })
        return respond()
      },
    },
  })
  return { client, requests }
}

function jsonResponse(body: unknown, { status = 200, contentRange }: { status?: number; contentRange?: string } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (contentRange) headers.set('Content-Range', contentRange)
  return new Response(JSON.stringify(body), { status, headers })
}

const ROW: ReviewListItem = {
  id: 1,
  body: 'Курьер не приехал в выбранный интервал.',
  score: null,
  sentiment: 'negative',
  topic: 'delivery',
  author: 'Анна К.',
  source: 'Сайт',
  reviewed_at: '2026-09-01T10:00:00Z',
  analysis_status: 'done',
}

async function requestFor(filters: Partial<ReviewFilters>, offset = 0) {
  const { client, requests } = createTestClient(() => jsonResponse([ROW], { contentRange: '0-0/1' }))
  await fetchReviewsPage(client, { datasetId: DATASET_ID, filters: { ...DEFAULT_REVIEW_FILTERS, ...filters }, offset })
  return requests[0]
}

describe('fetchReviewsPage: запрос', () => {
  it('применяет фильтры, поиск, сортировку и диапазон', async () => {
    const { url, headers } = await requestFor({
      sentiment: ['neutral', 'negative'],
      topic: ['delivery'],
      q: 'курьер',
      sort: 'score',
      order: 'asc',
    })

    expect(url.pathname).toBe('/rest/v1/reviews')
    expect(url.searchParams.get('select')?.split(',')).toContain('analysis_status')
    expect(url.searchParams.get('dataset_id')).toBe(`eq.${DATASET_ID}`)
    expect(url.searchParams.get('sentiment')).toBe('in.(neutral,negative)')
    expect(url.searchParams.get('topic')).toBe('in.(delivery)')
    expect(url.searchParams.get('body')).toBe('ilike.%курьер%')
    expect(url.searchParams.get('order')).toBe('score.asc.nullslast,id.asc.nullslast')
    expect(url.searchParams.get('offset')).toBe('0')
    expect(url.searchParams.get('limit')).toBe(String(REVIEWS_PAGE_SIZE))
    expect(headers.get('Prefer')).toContain('count=exact')
  })

  it.each(['asc', 'desc'] as const)('при сортировке по оценке %s ставит NULL в конец', async (order) => {
    const { url } = await requestFor({ sort: 'score', order })
    expect(url.searchParams.get('order')).toBe(`score.${order}.nullslast,id.${order}.nullslast`)
  })

  it('без фильтров и с коротким поиском не добавляет условий', async () => {
    const { url } = await requestFor({ q: 'к' })
    expect(url.searchParams.has('sentiment')).toBe(false)
    expect(url.searchParams.has('topic')).toBe(false)
    expect(url.searchParams.has('body')).toBe(false)
  })

  it('считает total только для первой страницы', async () => {
    const { url, headers } = await requestFor({}, 400)
    expect(url.searchParams.get('offset')).toBe('400')
    expect(headers.get('Prefer') ?? '').not.toContain('count=')
  })
})

describe('fetchReviewsPage: ответ', () => {
  it('возвращает строки и total из Content-Range', async () => {
    const { client } = createTestClient(() => jsonResponse([ROW], { contentRange: '0-0/5000' }))
    const page = await fetchReviewsPage(client, { datasetId: DATASET_ID, filters: DEFAULT_REVIEW_FILTERS, offset: 0 })
    expect(page).toEqual({ offset: 0, rows: [ROW], total: 5000 })
  })

  it('ответ 416 считает концом данных, а не ошибкой', async () => {
    const { client } = createTestClient(() =>
      jsonResponse({ code: 'PGRST103', message: 'Requested range not satisfiable' }, { status: 416 }),
    )
    const page = await fetchReviewsPage(client, { datasetId: DATASET_ID, filters: DEFAULT_REVIEW_FILTERS, offset: 400 })
    expect(page).toEqual({ offset: 400, rows: [], total: null })
  })

  it('другие ошибки пробрасывает с сообщением', async () => {
    const { client } = createTestClient(() =>
      jsonResponse({ code: '22P02', message: 'invalid input syntax for type uuid' }, { status: 400 }),
    )
    await expect(
      fetchReviewsPage(client, { datasetId: 'bad', filters: DEFAULT_REVIEW_FILTERS, offset: 0 }),
    ).rejects.toThrow('invalid input syntax for type uuid')
  })
})

describe('reviewsInfiniteQueryOptions', () => {
  const options = reviewsInfiniteQueryOptions(DATASET_ID, DEFAULT_REVIEW_FILTERS, { staleTime: 1234 })

  it('берёт staleTime из настроек хука', () => {
    expect(options.staleTime).toBe(1234)
  })

  it('не принимает lastPageParam за размер страницы', () => {
    const lastPage: ReviewsPage = { offset: 0, rows: Array.from({ length: 150 }, () => ROW), total: null }
    expect(options.getNextPageParam(lastPage, [lastPage], 0, [0])).toBeUndefined()
  })

  it('ключ запроса содержит датасет и фильтры', () => {
    expect(options.queryKey).toEqual(['reviews', 'list', DATASET_ID, DEFAULT_REVIEW_FILTERS])
  })
})
