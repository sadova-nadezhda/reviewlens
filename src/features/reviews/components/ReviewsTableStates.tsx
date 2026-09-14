import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { COLUMN_CLASS, TABLE_MIN_WIDTH_CLASS } from './columns'

const SKELETON_ROWS = 10
const SKELETON_COLUMNS = Object.entries(COLUMN_CLASS)

export function ReviewsTableSkeleton() {
  return (
    <div className="h-full overflow-hidden rounded-lg border" aria-busy aria-label="Загружаем отзывы">
      <div className={cn('flex h-10 border-b', TABLE_MIN_WIDTH_CLASS)} />
      {Array.from({ length: SKELETON_ROWS }, (_, row) => (
        <div key={row} className={cn('flex h-16 items-center border-b', TABLE_MIN_WIDTH_CLASS)}>
          {SKELETON_COLUMNS.map(([id, className]) => (
            <div key={id} className={cn('px-3', className)}>
              <Skeleton className={id === 'body' ? 'h-4 w-3/4' : 'h-4 w-16'} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function ReviewsErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border p-8 text-center">
      <p className="font-medium">Не удалось загрузить отзывы</p>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        Повторить
      </Button>
    </div>
  )
}

export function ReviewsEmptyState({ canReset, onReset }: { canReset: boolean; onReset: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border p-8 text-center">
      <p className="font-medium">Ничего не найдено</p>
      {canReset ? (
        <>
          <p className="text-sm text-muted-foreground">Попробуйте изменить или сбросить фильтры.</p>
          <Button variant="outline" onClick={onReset}>
            Сбросить фильтры
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">В этом датасете пока нет отзывов.</p>
      )}
    </div>
  )
}
