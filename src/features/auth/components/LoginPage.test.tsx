import { AuthApiError } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppRouter } from '@/router'

const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  captchaResets: 0,
}))

vi.mock('@/lib/client-env', () => ({
  clientEnv: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_test',
    VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithOtp: auth.signInWithOtp,
      verifyOtp: auth.verifyOtp,
    },
  },
}))

// Настоящий виджет грузит скрипт Cloudflare; подделка сразу выдаёт токен и считает сбросы
vi.mock('@marsidev/react-turnstile', async () => {
  const { useEffect, useImperativeHandle } = await import('react')
  return {
    Turnstile: ({
      onSuccess,
      ref,
    }: {
      onSuccess?: (token: string) => void
      ref?: React.Ref<{ reset: () => void }>
    }) => {
      useImperativeHandle(ref, () => ({ reset: () => void auth.captchaResets++ }))
      useEffect(() => onSuccess?.('captcha-token'), [onSuccess])
      return <div data-testid="turnstile" />
    },
  }
})

const SESSION = { access_token: 'token', user: { id: 'user-1', email: 'anna@example.com' } }

function renderLogin(path = '/login?redirect=/datasets/new') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createAppRouter({ queryClient, history: createMemoryHistory({ initialEntries: [path] }) })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

async function requestCode(email = ' Anna@Example.com ') {
  await userEvent.type(await screen.findByLabelText('Почта'), email)
  await userEvent.click(screen.getByRole('button', { name: 'Получить код' }))
}

describe('LoginPage', () => {
  beforeEach(() => {
    auth.signInWithOtp.mockReset().mockResolvedValue({ data: {}, error: null })
    auth.verifyOtp.mockReset().mockResolvedValue({ data: { session: SESSION, user: SESSION.user }, error: null })
    auth.captchaResets = 0
  })

  it('отправляет код на введённую почту вместе с токеном проверки', async () => {
    renderLogin()
    await requestCode()

    expect(await screen.findByText(/Мы отправили код на anna@example\.com/)).toBeInTheDocument()
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'anna@example.com',
      options: { shouldCreateUser: true, captchaToken: 'captcha-token' },
    })
    expect(auth.captchaResets).toBe(1)
  })

  it('не отправляет некорректную почту', async () => {
    renderLogin()
    await requestCode('anna')

    expect(await screen.findByText(/Введите адрес почты/)).toBeInTheDocument()
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it('объясняет ошибку лимита писем и сбрасывает проверку на робота', async () => {
    auth.signInWithOtp.mockResolvedValue({
      data: {},
      error: new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit'),
    })
    renderLogin()
    await requestCode()

    expect(await screen.findByRole('alert')).toHaveTextContent('Слишком много писем')
    expect(auth.captchaResets).toBe(1)
  })

  it('сообщает о неверном коде', async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'),
    })
    renderLogin()
    await requestCode()
    await userEvent.type(await screen.findByLabelText('Код из письма'), '12345678')
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Код неверный или устарел')
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'anna@example.com', token: '12345678', type: 'email' })
  })

  it('после верного кода возвращает на страницу, с которой отправили на вход', async () => {
    const router = renderLogin()
    await requestCode()
    await userEvent.type(await screen.findByLabelText('Код из письма'), '1234 5678')
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }))

    expect(await screen.findByRole('heading', { name: 'Загрузка CSV' })).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/datasets/new'))
  })

  it('не даёт запросить код повторно раньше чем через минуту', async () => {
    renderLogin()
    await requestCode()
    await userEvent.click(await screen.findByRole('button', { name: /Изменить почту/ }))

    const button = await screen.findByRole('button', { name: /Отправить код через \d+ с/ })
    expect(button).toBeDisabled()
    expect(screen.getByLabelText('Почта')).toHaveValue('anna@example.com')
  })
})
