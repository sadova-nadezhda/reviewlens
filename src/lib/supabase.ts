import { createClient } from '@supabase/supabase-js'
import { clientEnv } from './client-env'
import type { Database } from './database.types'

/** Клиент с публичным ключом: доступ к данным ограничивают политики RLS */
export const supabase = createClient<Database>(clientEnv.VITE_SUPABASE_URL, clientEnv.VITE_SUPABASE_ANON_KEY)
