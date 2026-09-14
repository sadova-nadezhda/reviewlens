import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  notFound,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router'
import { z } from 'zod'
import { DatasetNotFound, PageNotFound, RootLayout, RouteError } from '@/components/route-states'
import { sessionQueryOptions } from '@/features/auth/api'
import { LoginPage } from '@/features/auth/components/LoginPage'
import { safeRedirect, validateLoginSearch } from '@/features/auth/schema'
import { datasetQueryOptions, demoDatasetIdQueryOptions } from '@/features/datasets/api'
import { NewDatasetPage } from '@/features/datasets/components/NewDatasetPage'
import { ReviewsPage } from '@/features/reviews/components/ReviewsPage'
import { validateReviewSearch } from '@/features/reviews/schema'
import { parseFlatSearch, stringifyFlatSearch } from '@/lib/search-params'

export type RouterContext = {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async ({ context }) => {
    const datasetId = await context.queryClient.ensureQueryData(demoDatasetIdQueryOptions())
    throw redirect({ to: '/datasets/$datasetId', params: { datasetId }, replace: true })
  },
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  validateSearch: validateLoginSearch,
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions())
    if (session) throw redirect({ href: safeRedirect(search.redirect), replace: true })
  },
  component: LoginPage,
})

/** Родитель страниц, доступных только после входа */
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions())
    if (!session) throw redirect({ to: '/login', search: { redirect: location.href }, replace: true })
    return { session }
  },
})

const newDatasetRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: 'datasets/new',
  component: NewDatasetPage,
})

const datasetIdSchema = z.uuid()

const datasetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'datasets/$datasetId',
  validateSearch: validateReviewSearch,
  loader: async ({ context, params }) => {
    // Неверный id не отправляем в базу: Postgres ответил бы ошибкой приведения к uuid
    if (!datasetIdSchema.safeParse(params.datasetId).success) throw notFound()
    const dataset = await context.queryClient.ensureQueryData(datasetQueryOptions(params.datasetId))
    if (dataset === null) throw notFound()
  },
  component: ReviewsPage,
  notFoundComponent: DatasetNotFound,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  authenticatedRoute.addChildren([newDatasetRoute]),
  datasetRoute,
])

export function createAppRouter({ queryClient, history }: { queryClient: QueryClient; history?: RouterHistory }) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient },
    parseSearch: parseFlatSearch,
    stringifySearch: stringifyFlatSearch,
    defaultPreload: 'intent',
    // Кэшем данных управляет TanStack Query, у роутера своего кэша нет
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: PageNotFound,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
