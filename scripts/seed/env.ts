import { z } from 'zod'
import { findLeakedSecrets } from '../../src/lib/env.ts'

const SeedEnvSchema = z
  .object({
    VITE_SUPABASE_URL: z.url({ error: 'не задан или не является URL' }),
    VITE_SUPABASE_ANON_KEY: z.string({ error: 'не задан' }).min(1, 'пустой'),
    SUPABASE_SERVICE_ROLE_KEY: z.string({ error: 'не задан' }).min(1, 'пустой'),
  })
  .refine((env) => env.SUPABASE_SERVICE_ROLE_KEY !== env.VITE_SUPABASE_ANON_KEY, {
    error: 'совпадает с публичным ключом VITE_SUPABASE_ANON_KEY',
    path: ['SUPABASE_SERVICE_ROLE_KEY'],
  })

export type SeedEnv = z.infer<typeof SeedEnvSchema>

/**
 * Переменные окружения seed-скрипта. Секретный ключ с префиксом VITE_ попал бы
 * в клиентский бандл, поэтому такая переменная — ошибка, даже если seed она не нужна.
 */
export function parseSeedEnv(env: Record<string, string | undefined>): SeedEnv {
  const leaked = findLeakedSecrets(env)
  if (leaked.length > 0) {
    throw new Error(`Секретный ключ не должен иметь префикс VITE_: ${leaked.join(', ')}`)
  }

  const result = SeedEnvSchema.safeParse(env)
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    throw new Error(['Проверьте переменные окружения в .env (образец — .env.example):', ...problems].join('\n'))
  }
  return result.data
}
