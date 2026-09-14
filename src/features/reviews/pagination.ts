import type { SortField, SortOrder } from './schema'

/** Supabase отдаёт не больше api.max_rows строк за запрос (supabase/config.toml) */
export const SUPABASE_MAX_ROWS = 1000
export const REVIEWS_PAGE_SIZE = 200

export type PageRange = { from: number; to: number }

/** Диапазон строк для .range(): обе границы включительно */
export function pageRange(offset: number, size: number = REVIEWS_PAGE_SIZE): PageRange {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error(`pageRange: смещение должно быть целым неотрицательным числом, получено ${offset}`)
  }
  if (!Number.isInteger(size) || size < 1 || size > SUPABASE_MAX_ROWS) {
    throw new Error(`pageRange: размер страницы должен быть от 1 до ${SUPABASE_MAX_ROWS}, получено ${size}`)
  }
  return { from: offset, to: offset + size - 1 }
}

export type PageInfo = {
  offset: number
  rows: readonly unknown[]
  /** Общее число строк; приходит только с первой страницей */
  total: number | null
}

/**
 * Смещение следующей страницы или undefined, если данных больше нет.
 * Опирается на total первой страницы: иначе при числе строк, кратном размеру страницы,
 * ушёл бы лишний запрос за пределы данных.
 */
export function nextPageOffset(
  lastPage: PageInfo,
  allPages: readonly PageInfo[],
  pageSize: number = REVIEWS_PAGE_SIZE,
): number | undefined {
  if (lastPage.rows.length === 0) return undefined
  const nextOffset = lastPage.offset + lastPage.rows.length
  const total = allPages[0]?.total ?? null
  if (total !== null) return nextOffset < total ? nextOffset : undefined
  return lastPage.rows.length < pageSize ? undefined : nextOffset
}

export type OrderSpec = {
  column: SortField | 'id'
  ascending: boolean
  nullsFirst: false
}

/**
 * Порядок строк для запроса отзывов.
 * NULL всегда в конце: без явного NULLS LAST Postgres при DESC ставит NULL первыми.
 * id вторым ключом делает порядок стабильным между страницами при равных значениях.
 */
export function reviewsOrder(sort: SortField, order: SortOrder): OrderSpec[] {
  const ascending = order === 'asc'
  return [
    { column: sort, ascending, nullsFirst: false },
    { column: 'id', ascending, nullsFirst: false },
  ]
}
