import type { Session } from '@supabase/supabase-js'
import { queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export const authKeys = {
  session: ['auth', 'session'] as const,
}

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: authKeys.session,
    queryFn: async (): Promise<Session | null> => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      return data.session
    },
    // Сессию обновляет подписка onAuthStateChange, повторно запрашивать её не нужно
    staleTime: Infinity,
  })
}

export function useSession() {
  return useQuery(sessionQueryOptions())
}

/**
 * Держит сессию в кэше запросов актуальной и сообщает о входе и выходе,
 * чтобы роутер перепроверил доступ к текущей странице.
 */
export function subscribeToAuthChanges(queryClient: QueryClient, onSignInOrOut: () => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    queryClient.setQueryData(authKeys.session, session)
    // Откладываем: внутри колбэка нельзя ждать других вызовов Supabase, а перепроверка маршрута может их сделать
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(onSignInOrOut, 0)
  })
  return () => data.subscription.unsubscribe()
}

export type SendCodeParams = { email: string; captchaToken: string }

export function useSendCodeMutation() {
  return useMutation({
    mutationFn: async ({ email, captchaToken }: SendCodeParams) => {
      // Если аккаунта нет, Supabase создаст его; первый вход по коду подтверждает почту
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, captchaToken },
      })
      if (error) throw error
    },
  })
}

export type VerifyCodeParams = { email: string; code: string }

export function useVerifyCodeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, code }: VerifyCodeParams) => {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
      if (error) throw error
      return data.session
    },
    onSuccess: (session) => {
      queryClient.setQueryData(authKeys.session, session)
    },
  })
}

export function useSignOutMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      // Данные прошлого пользователя не должны остаться в кэше
      queryClient.clear()
      queryClient.setQueryData(authKeys.session, null)
    },
  })
}
