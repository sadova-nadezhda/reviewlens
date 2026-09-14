import { z } from 'zod'

/** Длина кода из письма. Совпадает с настройкой облачного проекта (Email OTP Length = 8). */
export const OTP_LENGTH = 8

/** Пауза перед повторной отправкой кода. Совпадает с интервалом отправки писем в облачном проекте (1 минута). */
export const RESEND_COOLDOWN_SECONDS = 60

export const emailFormSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Введите адрес почты, например anna@example.com' })),
})

const CODE_MESSAGE = `Код из письма состоит из ${OTP_LENGTH} цифр`

export const codeFormSchema = z.object({
  // Пробелы убираем: код часто вставляют из письма как «1234 5678»
  code: z
    .string()
    .transform((value) => value.replace(/\s+/g, ''))
    .pipe(z.string().regex(/^\d+$/, CODE_MESSAGE).length(OTP_LENGTH, CODE_MESSAGE)),
})

const BACKSLASH = String.fromCharCode(92)

/**
 * Адрес возврата после входа. Только путь внутри приложения: иначе ссылкой вида
 * /login?redirect=//evil.example можно увести пользователя на чужой сайт.
 */
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string') return '/'
  const isInternalPath = value.startsWith('/') && !value.startsWith('//') && !value.includes(BACKSLASH)
  const isLoginPage = value === '/login' || value.startsWith('/login?')
  return isInternalPath && !isLoginPage ? value : '/'
}

export type LoginSearch = { redirect?: string }

export function validateLoginSearch(search: Record<string, unknown>): LoginSearch {
  const redirect = safeRedirect(search.redirect)
  return redirect === '/' ? {} : { redirect }
}
