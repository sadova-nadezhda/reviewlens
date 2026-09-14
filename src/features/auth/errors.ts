import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js'

const MESSAGES: Record<string, string> = {
  captcha_failed: 'Проверка на робота не пройдена. Обновите страницу и попробуйте ещё раз.',
  over_email_send_rate_limit: 'Слишком много писем. Подождите минуту и запросите код снова.',
  over_request_rate_limit: 'Слишком много попыток. Подождите несколько минут.',
  // Supabase отвечает otp_expired и на устаревший, и на неверный код
  otp_expired: 'Код неверный или устарел. Проверьте письмо или запросите новый код.',
  email_address_invalid: 'Проверьте адрес почты.',
  validation_failed: 'Проверьте адрес почты.',
  email_address_not_authorized: 'На этот адрес сейчас нельзя отправить письмо.',
  signup_disabled: 'Регистрация новых пользователей отключена.',
  otp_disabled: 'Вход по коду отключён.',
  user_banned: 'Доступ для этого пользователя заблокирован.',
}

const NETWORK_MESSAGE = 'Не удалось связаться с сервером. Проверьте подключение к интернету.'
const DEFAULT_MESSAGE = 'Не удалось выполнить вход. Попробуйте ещё раз.'

export function authErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) return NETWORK_MESSAGE
  if (isAuthError(error) && error.code && Object.hasOwn(MESSAGES, error.code)) return MESSAGES[error.code]
  return DEFAULT_MESSAGE
}
