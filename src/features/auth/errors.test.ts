import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { authErrorMessage } from './errors'

describe('authErrorMessage', () => {
  it.each([
    ['over_email_send_rate_limit', /Слишком много писем/],
    ['otp_expired', /Код неверный или устарел/],
    ['captcha_failed', /Проверка на робота/],
    ['email_address_not_authorized', /нельзя отправить письмо/],
  ])('переводит код %s', (code, expected) => {
    expect(authErrorMessage(new AuthApiError('message', 400, code))).toMatch(expected)
  })

  it('сообщает о проблеме с сетью', () => {
    expect(authErrorMessage(new AuthRetryableFetchError('Failed to fetch', 0))).toMatch(/подключение/)
  })

  it.each([
    ['неизвестный код', new AuthApiError('message', 400, 'something_new')],
    ['код из прототипа объекта', new AuthApiError('message', 400, 'toString')],
    ['обычная ошибка', new Error('boom')],
    ['не ошибка', 'boom'],
  ])('для случая «%s» возвращает общее сообщение', (_, error) => {
    expect(authErrorMessage(error)).toBe('Не удалось выполнить вход. Попробуйте ещё раз.')
  })
})
