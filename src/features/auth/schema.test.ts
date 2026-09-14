import { describe, expect, it } from 'vitest'
import { OTP_LENGTH, codeFormSchema, emailFormSchema, safeRedirect, validateLoginSearch } from './schema'

describe('emailFormSchema', () => {
  it('обрезает пробелы и приводит почту к нижнему регистру', () => {
    expect(emailFormSchema.parse({ email: '  Anna@Example.COM ' })).toEqual({ email: 'anna@example.com' })
  })

  it.each(['', 'anna', 'anna@', '@example.com'])('отклоняет «%s»', (email) => {
    expect(emailFormSchema.safeParse({ email }).success).toBe(false)
  })
})

describe('codeFormSchema', () => {
  it('принимает код с пробелами из письма', () => {
    expect(codeFormSchema.parse({ code: ' 1234 5678 ' })).toEqual({ code: '12345678' })
  })

  it.each(['1234567', '123456789', '1234abcd', ''])('отклоняет «%s»', (code) => {
    const result = codeFormSchema.safeParse({ code })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain(String(OTP_LENGTH))
  })
})

describe('safeRedirect', () => {
  it.each([
    ['/datasets/new', '/datasets/new'],
    ['/datasets/de300000-0000-4000-a000-000000000001?topic=price', '/datasets/de300000-0000-4000-a000-000000000001?topic=price'],
  ])('оставляет внутренний путь %s', (value, expected) => {
    expect(safeRedirect(value)).toBe(expected)
  })

  it.each([
    ['внешний адрес', 'https://evil.example'],
    ['адрес без протокола', '//evil.example'],
    ['обратная косая черта', `/${String.fromCharCode(92)}evil.example`],
    ['относительный путь', 'datasets'],
    ['страница входа', '/login?redirect=/login'],
    ['не строка', 42],
  ])('заменяет на «/»: %s', (_, value) => {
    expect(safeRedirect(value)).toBe('/')
  })
})

describe('validateLoginSearch', () => {
  it('не пишет redirect, если он ведёт на главную или небезопасен', () => {
    expect(validateLoginSearch({ redirect: '//evil.example' })).toEqual({})
    expect(validateLoginSearch({ redirect: '/datasets/new' })).toEqual({ redirect: '/datasets/new' })
  })
})
