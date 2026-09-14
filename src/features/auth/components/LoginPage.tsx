import { zodResolver } from '@hookform/resolvers/zod'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { useRouter, useSearch } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCooldown } from '@/hooks/use-cooldown'
import { clientEnv } from '@/lib/client-env'
import { useSendCodeMutation, useVerifyCodeMutation } from '../api'
import { authErrorMessage } from '../errors'
import { OTP_LENGTH, RESEND_COOLDOWN_SECONDS, codeFormSchema, emailFormSchema, safeRedirect } from '../schema'

export function LoginPage() {
  const { redirect } = useSearch({ from: '/login' })
  const router = useRouter()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [lastEmail, setLastEmail] = useState('')
  const cooldown = useCooldown()

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Вход в ReviewLens</h1>
        <p className="text-sm text-muted-foreground">
          {sentTo === null
            ? 'Пришлём на почту код для входа. Если аккаунта ещё нет, он будет создан.'
            : `Мы отправили код на ${sentTo}. Письмо может идти до минуты.`}
        </p>
      </div>

      {sentTo === null ? (
        <EmailStep
          defaultEmail={lastEmail}
          cooldownSeconds={cooldown.remainingSeconds}
          onSent={(email) => {
            setLastEmail(email)
            setSentTo(email)
            cooldown.start(RESEND_COOLDOWN_SECONDS)
          }}
        />
      ) : (
        <CodeStep
          email={sentTo}
          onChangeEmail={() => setSentTo(null)}
          onSignedIn={() => router.history.push(safeRedirect(redirect))}
        />
      )}
    </main>
  )
}

function EmailStep({
  defaultEmail,
  cooldownSeconds,
  onSent,
}: {
  defaultEmail: string
  cooldownSeconds: number
  onSent: (email: string) => void
}) {
  const turnstileRef = useRef<TurnstileInstance>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaFailed, setCaptchaFailed] = useState(false)
  const sendCode = useSendCodeMutation()
  const form = useForm<z.input<typeof emailFormSchema>, unknown, z.output<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: defaultEmail },
  })
  const emailError = form.formState.errors.email?.message

  function sendEmail({ email }: z.output<typeof emailFormSchema>) {
    if (!captchaToken) return
    sendCode.mutate(
      { email, captchaToken },
      {
        onSuccess: () => onSent(email),
        // Токен проверки одноразовый: после любой попытки нужен новый
        onSettled: () => {
          setCaptchaToken(null)
          turnstileRef.current?.reset()
        },
      },
    )
  }

  const waiting = cooldownSeconds > 0

  return (
    // handleSubmit вызывается в обработчике события: обращение к ref не должно происходить при рендере
    <form onSubmit={(event) => void form.handleSubmit(sendEmail)(event)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Почта</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? 'email-error' : undefined}
          {...form.register('email')}
        />
        {emailError && (
          <p id="email-error" className="text-sm text-destructive">
            {emailError}
          </p>
        )}
      </div>

      <Turnstile
        ref={turnstileRef}
        siteKey={clientEnv.VITE_TURNSTILE_SITE_KEY}
        options={{ language: 'ru', size: 'flexible' }}
        onSuccess={(token) => {
          setCaptchaToken(token)
          setCaptchaFailed(false)
        }}
        onExpire={() => setCaptchaToken(null)}
        onError={() => {
          setCaptchaToken(null)
          setCaptchaFailed(true)
        }}
      />
      {captchaFailed && (
        <p className="text-sm text-destructive">Не удалось пройти проверку на робота. Обновите страницу.</p>
      )}

      {sendCode.isError && (
        <p role="alert" className="text-sm text-destructive">
          {authErrorMessage(sendCode.error)}
        </p>
      )}

      <Button type="submit" disabled={!captchaToken || sendCode.isPending || waiting}>
        {sendCode.isPending
          ? 'Отправляем…'
          : waiting
            ? `Отправить код через ${cooldownSeconds} с`
            : 'Получить код'}
      </Button>
    </form>
  )
}

function CodeStep({
  email,
  onChangeEmail,
  onSignedIn,
}: {
  email: string
  onChangeEmail: () => void
  onSignedIn: () => void
}) {
  const verifyCode = useVerifyCodeMutation()
  const form = useForm<z.input<typeof codeFormSchema>, unknown, z.output<typeof codeFormSchema>>({
    resolver: zodResolver(codeFormSchema),
    defaultValues: { code: '' },
  })
  const codeError = form.formState.errors.code?.message

  const onSubmit = form.handleSubmit(({ code }) => {
    verifyCode.mutate({ email, code }, { onSuccess: onSignedIn })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Код из письма</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={OTP_LENGTH + 2}
          className="text-center text-lg tracking-[0.3em] tabular-nums"
          aria-invalid={codeError ? true : undefined}
          aria-describedby={codeError ? 'code-error' : undefined}
          {...form.register('code')}
        />
        {codeError && (
          <p id="code-error" className="text-sm text-destructive">
            {codeError}
          </p>
        )}
      </div>

      {verifyCode.isError && (
        <p role="alert" className="text-sm text-destructive">
          {authErrorMessage(verifyCode.error)}
        </p>
      )}

      <Button type="submit" disabled={verifyCode.isPending}>
        {verifyCode.isPending ? 'Проверяем…' : 'Войти'}
      </Button>
      <Button type="button" variant="ghost" onClick={onChangeEmail}>
        Изменить почту или отправить код ещё раз
      </Button>
    </form>
  )
}
