import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

export type Dataset = Pick<
  Tables<'datasets'>,
  'id' | 'name' | 'description' | 'is_demo' | 'reviews_count' | 'analyzed_count'
>

export const datasetKeys = {
  all: ['datasets'] as const,
  demoId: () => [...datasetKeys.all, 'demo-id'] as const,
  detail: (id: string) => [...datasetKeys.all, 'detail', id] as const,
}

export class DemoDatasetMissingError extends Error {
  constructor() {
    super('Демо-датасет не найден. Заполните базу командой npm run seed.')
    this.name = 'DemoDatasetMissingError'
  }
}

async function fetchDemoDatasetId(): Promise<string> {
  const { data, error } = await supabase
    .from('datasets')
    .select('id')
    .eq('is_demo', true)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Не удалось загрузить демо-датасет: ${error.message}`)
  if (data === null) throw new DemoDatasetMissingError()
  return data.id
}

/** null — датасета нет или он недоступен текущему пользователю (RLS) */
async function fetchDataset(id: string): Promise<Dataset | null> {
  const { data, error } = await supabase
    .from('datasets')
    .select('id, name, description, is_demo, reviews_count, analyzed_count')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`Не удалось загрузить датасет: ${error.message}`)
  return data
}

export function demoDatasetIdQueryOptions() {
  return queryOptions({
    queryKey: datasetKeys.demoId(),
    queryFn: fetchDemoDatasetId,
    staleTime: Infinity,
  })
}

export function datasetQueryOptions(id: string) {
  return queryOptions({
    queryKey: datasetKeys.detail(id),
    queryFn: () => fetchDataset(id),
  })
}

/** Данные уже загружены в loader маршрута, поэтому хук не бывает в состоянии загрузки */
export function useDatasetQuery(id: string) {
  return useSuspenseQuery(datasetQueryOptions(id))
}
