import { Link, useRouterState } from '@tanstack/react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { useSession, useSignOutMutation } from '@/features/auth/api'

export function AppHeader() {
  const { data: session } = useSession()
  const signOut = useSignOutMutation()
  const location = useRouterState({ select: (state) => state.location })

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4">
      <Link to="/" className="font-semibold">
        ReviewLens
      </Link>
      <nav className="flex items-center gap-2 text-sm">
        {session ? (
          <>
            <Link to="/datasets/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Загрузить CSV
            </Link>
            <span className="hidden max-w-48 truncate text-muted-foreground sm:inline" title={session.user.email}>
              {session.user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
              Выйти
            </Button>
          </>
        ) : (
          session === null &&
          location.pathname !== '/login' && (
            <Link
              to="/login"
              search={{ redirect: location.href }}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Войти
            </Link>
          )
        )}
      </nav>
    </header>
  )
}
