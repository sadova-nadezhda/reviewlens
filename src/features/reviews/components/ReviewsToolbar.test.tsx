import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { parseFlatSearch, stringifyFlatSearch } from '@/lib/search-params'
import { validateReviewSearch } from '../schema'
import { ReviewsToolbar, SEARCH_DEBOUNCE_MS } from './ReviewsToolbar'

const DATASET_PATH = '/datasets/de300000-0000-4000-a000-000000000001'

// Минимальный роутер с тем же маршрутом и форматом URL, что и в приложении
function renderAt(path: string) {
  const rootRoute = createRootRoute()
  const datasetRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'datasets/$datasetId',
    validateSearch: validateReviewSearch,
    component: ReviewsToolbar,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([datasetRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
    parseSearch: parseFlatSearch,
    stringifySearch: stringifyFlatSearch,
  })
  render(<RouterProvider router={router} />)
  return router
}

const searchInput = () => screen.findByRole('searchbox', { name: 'Поиск по тексту отзывов' })

// location.search — разобранная строка до validateSearch, поэтому сравниваем саму строку URL
const searchParams = (router: ReturnType<typeof renderAt>) =>
  Object.fromEntries(new URLSearchParams(router.state.location.searchStr))

describe('ReviewsToolbar: поиск', () => {
  it('пишет запрос в URL после паузы, заменяя текущую запись истории', async () => {
    const router = renderAt(DATASET_PATH)
    const input = await searchInput()
    const historyLength = router.history.length

    await userEvent.type(input, 'курьер')
    expect(searchParams(router)).toEqual({})

    await waitFor(() => expect(searchParams(router)).toEqual({ q: 'курьер' }), {
      timeout: SEARCH_DEBOUNCE_MS * 5,
    })
    expect(router.history.length).toBe(historyLength)
    expect(input).toHaveValue('курьер')
  })

  it('показывает запрос из ссылки и очищается при сбросе фильтров', async () => {
    const router = renderAt(`${DATASET_PATH}?q=упаковка&topic=price`)
    expect(await searchInput()).toHaveValue('упаковка')

    await userEvent.click(screen.getByRole('button', { name: /Сбросить/ }))
    await waitFor(() => expect(searchParams(router)).toEqual({}))
    expect(await searchInput()).toHaveValue('')
  })

  it('незаписанный ввод не перетирает сброс', async () => {
    const router = renderAt(`${DATASET_PATH}?topic=price`)
    await userEvent.type(await searchInput(), 'курьер')
    await userEvent.click(screen.getByRole('button', { name: /Сбросить/ }))
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS * 2))

    expect(searchParams(router)).toEqual({})
    expect(await searchInput()).toHaveValue('')
  })
})

describe('ReviewsToolbar: фильтры', () => {
  it('отмечает тему в меню и пишет её в URL новой записью истории', async () => {
    const router = renderAt(DATASET_PATH)
    await searchInput()
    const historyLength = router.history.length

    await userEvent.click(screen.getByRole('button', { name: 'Тема' }))
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Цена' }))

    await waitFor(() => expect(router.state.location.searchStr).toBe('?topic=price'))
    expect(router.history.length).toBe(historyLength + 1)
    // Меню остаётся открытым, выбранный пункт отмечен
    expect(screen.getByRole('menuitemcheckbox', { name: 'Цена' })).toHaveAttribute('aria-checked', 'true')
  })

  it('снимает отметку повторным выбором', async () => {
    const router = renderAt(`${DATASET_PATH}?sentiment=negative,neutral`)
    await searchInput()

    await userEvent.click(screen.getByRole('button', { name: /Тональность/ }))
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Негатив' }))

    await waitFor(() => expect(router.state.location.searchStr).toBe('?sentiment=neutral'))
  })

  it('показывает кнопку сброса только при активных фильтрах', async () => {
    renderAt(`${DATASET_PATH}?sort=score&order=asc`)
    await searchInput()
    expect(screen.queryByRole('button', { name: /Сбросить/ })).not.toBeInTheDocument()
  })
})
