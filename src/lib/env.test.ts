import { describe, expect, it } from 'vitest'
import { findLeakedSecrets, parseClientEnv } from './env'

const VALID = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_test',
  VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
}

describe('parseClientEnv', () => {
  it('возвращает публичные переменные и игнорирует остальные', () => {
    expect(parseClientEnv({ ...VALID, MODE: 'test', DEV: true })).toEqual(VALID)
  })

  it('перечисляет все проблемные переменные', () => {
    expect(() => parseClientEnv({ VITE_SUPABASE_URL: 'example.supabase.co' })).toThrow(
      /VITE_SUPABASE_URL[\s\S]*VITE_SUPABASE_ANON_KEY[\s\S]*VITE_TURNSTILE_SITE_KEY/,
    )
  })

  it('требует ключ сайта Turnstile', () => {
    expect(() => parseClientEnv({ ...VALID, VITE_TURNSTILE_SITE_KEY: undefined })).toThrow('VITE_TURNSTILE_SITE_KEY')
  })

  it('отклоняет секретный ключ с префиксом VITE_', () => {
    expect(() => parseClientEnv({ ...VALID, VITE_SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' })).toThrow(
      'VITE_SUPABASE_SERVICE_ROLE_KEY',
    )
  })
})

describe('findLeakedSecrets', () => {
  it('находит только секретные ключи с префиксом VITE_', () => {
    expect(
      findLeakedSecrets({
        VITE_SUPABASE_SECRET_KEY: 'x',
        VITE_SUPABASE_SERVICE_ROLE_KEY: 'x',
        SUPABASE_SERVICE_ROLE_KEY: 'x',
        VITE_SUPABASE_ANON_KEY: 'x',
      }),
    ).toEqual(['VITE_SUPABASE_SECRET_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY'])
  })
})
