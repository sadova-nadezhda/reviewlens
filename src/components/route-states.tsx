import { Link, Outlet, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/button'

export function RootLayout() {
  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <AppHeader />
      <div className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}

export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <RouteMessage title="Что-то пошло не так" text={error instanceof Error ? error.message : 'Неизвестная ошибка'}>
      <Button onClick={() => void router.invalidate()}>Повторить</Button>
    </RouteMessage>
  )
}

export function PageNotFound() {
  return <RouteMessage title="Страница не найдена" />
}

export function DatasetNotFound() {
  return <RouteMessage title="Датасет не найден" text="Возможно, он удалён или у вас нет к нему доступа." />
}

function RouteMessage({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-3 px-4 py-16">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {text && <p className="text-muted-foreground">{text}</p>}
      {children ?? (
        <Link to="/" className="text-sm underline underline-offset-4">
          На главную
        </Link>
      )}
    </main>
  )
}
