import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppRouter } from './router'

type DatasetRow = {
  id: string
  name: string
  description: string | null
  is_demo: boolean
  reviews_count: number
  analyzed_count: number
}

type FakeSession = { access_token: string; user: { id: string; email: string } }

const db = vi.hoisted(() => ({
  datasets: [] as DatasetRow[],
  requests: 0,
  session: null as FakeSession | null,
}))

vi.mock('@/lib/client-env', () => ({
  clientEnv: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_test',
    VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  },
}))

vi.mock('@marsidev/react-turnstile', () => ({ Turnstile: () => null }))

// Поддельный клиент поддерживает только цепочки, которые строят features/datasets/api.ts и features/auth/api.ts
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: db.session }, error: null }),
    },
    from: () => {
      const filters: [keyof DatasetRow, unknown][] = []
      const builder = {
        select: () => builder,
        order: () => builder,
        limit: () => builder,
        eq: (column: keyof DatasetRow, value: unknown) => {
          filters.push([column, value])
          return builder
        },
        maybeSingle: async () => {
          db.requests++
          const row = db.datasets.find((dataset) => filters.every(([column, value]) => dataset[column] === value))
          return { data: row ?? null, error: null }
        },
      }
      return builder
    },
  },
}))

const DEMO: DatasetRow = {
  id: 'de300000-0000-4000-a000-000000000001',
  name: 'Демо: интернет-магазин',
  description: null,
  is_demo: true,
  reviews_count: 5000,
  analyzed_count: 5000,
}

const SESSION: FakeSession = { access_token: 'token', user: { id: 'user-1', email: 'anna@example.com' } }

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ queryClient, history: createMemoryHistory({ initialEntries: [path] }) })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

describe('router', () => {
  beforeEach(() => {
    db.datasets = [DEMO]
    db.requests = 0
    db.session = null
  })

  it('с главной перенаправляет на демо-датасет', async () => {
    const router = renderAt('/')
    expect(await screen.findByRole('heading', { name: DEMO.name })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/datasets/${DEMO.id}`)
    expect(screen.getByText(/Отзывов: 5\s000/)).toBeInTheDocument()
  })

  it('без демо-датасета показывает понятную ошибку', async () => {
    db.datasets = []
    renderAt('/')
    expect(await screen.findByText(/npm run seed/)).toBeInTheDocument()
  })

  it('для неизвестного датасета показывает «не найден»', async () => {
    renderAt('/datasets/00000000-0000-4000-a000-000000000000')
    expect(await screen.findByRole('heading', { name: 'Датасет не найден' })).toBeInTheDocument()
  })

  it('для id не в формате uuid не обращается к базе', async () => {
    renderAt('/datasets/not-a-uuid')
    expect(await screen.findByRole('heading', { name: 'Датасет не найден' })).toBeInTheDocument()
    expect(db.requests).toBe(0)
  })

  it('для неизвестного адреса показывает «страница не найдена»', async () => {
    renderAt('/unknown')
    expect(await screen.findByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument()
  })
})

describe('router: вход', () => {
  beforeEach(() => {
    db.datasets = [DEMO]
    db.session = null
  })

  it('без входа отправляет с закрытой страницы на вход и запоминает, куда вернуться', async () => {
    const router = renderAt('/datasets/new')
    expect(await screen.findByRole('heading', { name: 'Вход в ReviewLens' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(new URLSearchParams(router.state.location.searchStr).get('redirect')).toBe('/datasets/new')
  })

  it('после входа открывает закрытую страницу', async () => {
    db.session = SESSION
    renderAt('/datasets/new')
    expect(await screen.findByRole('heading', { name: 'Загрузка CSV' })).toBeInTheDocument()
  })

  it('вошедшего пользователя со страницы входа сразу возвращает по redirect', async () => {
    db.session = SESSION
    const router = renderAt('/login?redirect=/datasets/new')
    expect(await screen.findByRole('heading', { name: 'Загрузка CSV' })).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/datasets/new'))
  })

  it('в шапке гостю показывает «Войти», вошедшему — почту и «Выйти»', async () => {
    renderAt(`/datasets/${DEMO.id}`)
    expect(await screen.findByRole('link', { name: 'Войти' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Загрузить CSV' })).not.toBeInTheDocument()
  })

  it('вошедшему в шапке показывает почту, загрузку CSV и выход', async () => {
    db.session = SESSION
    renderAt(`/datasets/${DEMO.id}`)
    expect(await screen.findByRole('button', { name: 'Выйти' })).toBeInTheDocument()
    expect(screen.getByText('anna@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Загрузить CSV' })).toBeInTheDocument()
  })
})
