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
import { validateReviewSearch } from './schema'
import { useReviewFilters } from './use-review-filters'

const DATASET_PATH = '/datasets/de300000-0000-4000-a000-000000000001'

function Harness() {
  const { filters, setFilters, setSearchText, resetFilters, hasActiveFilters } = useReviewFilters()
  return (
    <div>
      <output data-testid="filters">{JSON.stringify(filters)}</output>
      <output data-testid="active">{String(hasActiveFilters)}</output>
      <button onClick={() => setFilters({ topic: ['price', 'delivery'] })}>темы</button>
      <button onClick={() => setFilters({ sort: 'score', order: 'asc' })}>сортировка</button>
      <button onClick={() => setSearchText('  курьер ')}>поиск</button>
      <button onClick={resetFilters}>сброс</button>
    </div>
  )
}

// Минимальный роутер с тем же маршрутом и форматом URL, что и в приложении
function renderAt(path: string) {
  const rootRoute = createRootRoute()
  const datasetRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'datasets/$datasetId',
    validateSearch: validateReviewSearch,
    component: Harness,
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

const readFilters = () => JSON.parse(screen.getByTestId('filters').textContent ?? '{}') as unknown

describe('useReviewFilters', () => {
  it('читает фильтры из URL и отбрасывает мусор', async () => {
    renderAt(`${DATASET_PATH}?topic=foo,price&sort=reviewed_at&order=sideways&q=%20%20`)
    await screen.findByTestId('filters')
    expect(readFilters()).toEqual({ sentiment: [], topic: ['price'], q: '', sort: 'reviewed_at', order: 'desc' })
    expect(screen.getByTestId('active')).toHaveTextContent('true')
  })

  it('фильтры пишутся в URL новой записью истории в едином порядке', async () => {
    const router = renderAt(DATASET_PATH)
    await screen.findByTestId('filters')
    const historyLength = router.history.length

    await userEvent.click(screen.getByRole('button', { name: 'темы' }))
    await waitFor(() => expect(router.state.location.searchStr).toBe('?topic=delivery,price'))
    expect(router.history.length).toBe(historyLength + 1)
  })

  it('поиск заменяет текущую запись истории', async () => {
    const router = renderAt(DATASET_PATH)
    await screen.findByTestId('filters')
    const historyLength = router.history.length

    await userEvent.click(screen.getByRole('button', { name: 'поиск' }))
    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'курьер' }))
    expect(router.history.length).toBe(historyLength)
  })

  it('сброс убирает фильтры и поиск, но оставляет сортировку', async () => {
    const router = renderAt(`${DATASET_PATH}?topic=price&q=курьер&sort=score&order=asc`)
    await screen.findByTestId('filters')

    await userEvent.click(screen.getByRole('button', { name: 'сброс' }))
    await waitFor(() => expect(router.state.location.searchStr).toBe('?sort=score&order=asc'))
    expect(screen.getByTestId('active')).toHaveTextContent('false')
  })
})
