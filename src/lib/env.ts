import { z } from 'zod'

/** Переменные с префиксом VITE_ попадают в клиентский бандл: секретный ключ среди них — утечка */
export function findLeakedSecrets(env: Record<string, unknown>): string[] {
  return Object.keys(env).filter((key) => key.startsWith('VITE_') && /SERVICE_ROLE|SECRET/.test(key))
}

const ClientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.url({ error: 'не задан или не является URL' }),
  VITE_SUPABASE_ANON_KEY: z.string({ error: 'не задан' }).min(1, 'пустой'),
  /** Публичный ключ сайта Cloudflare Turnstile; секретный ключ хранится только в настройках Supabase Auth */
  VITE_TURNSTILE_SITE_KEY: z.string({ error: 'не задан' }).min(1, 'пустой'),
})

export type ClientEnv = z.infer<typeof ClientEnvSchema>

export function parseClientEnv(env: Record<string, unknown>): ClientEnv {
  const leaked = findLeakedSecrets(env)
  if (leaked.length > 0) {
    throw new Error(`Секретный ключ не должен иметь префикс VITE_, иначе он попадёт в бандл: ${leaked.join(', ')}`)
  }

  const result = ClientEnvSchema.safeParse(env)
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    throw new Error(['Проверьте переменные окружения в .env (образец — .env.example):', ...problems].join('\n'))
  }
  return result.data
}
