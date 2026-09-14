import { parseClientEnv } from './env'

/** Публичные переменные окружения клиента, проверенные при запуске приложения */
export const clientEnv = parseClientEnv(import.meta.env)
