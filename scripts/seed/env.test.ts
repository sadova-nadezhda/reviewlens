// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseSeedEnv } from './env.ts'

const VALID = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_test',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test',
}

describe('parseSeedEnv', () => {
  it('возвращает нужные переменные и игнорирует остальные', () => {
    expect(parseSeedEnv({ ...VALID, PATH: '/usr/bin' })).toEqual(VALID)
  })

  it('перечисляет все отсутствующие переменные', () => {
    expect(() => parseSeedEnv({ VITE_SUPABASE_URL: VALID.VITE_SUPABASE_URL })).toThrow(
      /VITE_SUPABASE_ANON_KEY[\s\S]*SUPABASE_SERVICE_ROLE_KEY/,
    )
  })

  it('отклоняет URL не в формате URL', () => {
    expect(() => parseSeedEnv({ ...VALID, VITE_SUPABASE_URL: 'example.supabase.co' })).toThrow(/VITE_SUPABASE_URL/)
  })

  it('отклоняет пустой секретный ключ', () => {
    expect(() => parseSeedEnv({ ...VALID, SUPABASE_SERVICE_ROLE_KEY: '' })).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('отклоняет секретный ключ, совпадающий с публичным', () => {
    expect(() => parseSeedEnv({ ...VALID, SUPABASE_SERVICE_ROLE_KEY: VALID.VITE_SUPABASE_ANON_KEY })).toThrow(
      /совпадает с публичным/,
    )
  })

  it.each(['VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SECRET_KEY'])(
    'отклоняет секретный ключ с префиксом VITE_: %s',
    (key) => {
      expect(() => parseSeedEnv({ ...VALID, [key]: 'sb_secret_test' })).toThrow(key)
    },
  )
})
