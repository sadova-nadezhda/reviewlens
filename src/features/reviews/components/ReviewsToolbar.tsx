import { ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { SENTIMENT_LABELS, TOPIC_LABELS } from '../labels'
import { SENTIMENTS, TOPICS, normalizeSearchText } from '../schema'
import { useReviewFilters } from '../use-review-filters'

export const SEARCH_DEBOUNCE_MS = 300

export function ReviewsToolbar() {
  const { filters, setFilters, setSearchText, resetFilters, hasActiveFilters } = useReviewFilters()
  const [searchFieldKey, setSearchFieldKey] = useState(0)

  // Сброс пересоздаёт поле поиска: так отменяется ещё не записанный в URL ввод.
  // Сам q при этом может не измениться, если текст не успел записаться, — поле этого бы не заметило.
  function handleReset() {
    setSearchFieldKey((key) => key + 1)
    resetFilters()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchField key={searchFieldKey} value={filters.q} onSearch={setSearchText} />
      <MultiSelectFilter
        label="Тональность"
        options={SENTIMENTS}
        labels={SENTIMENT_LABELS}
        selected={filters.sentiment}
        onChange={(sentiment) => setFilters({ sentiment })}
      />
      <MultiSelectFilter
        label="Тема"
        options={TOPICS}
        labels={TOPIC_LABELS}
        selected={filters.topic}
        onChange={(topic) => setFilters({ topic })}
      />
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <X data-icon="inline-start" aria-hidden />
          Сбросить
        </Button>
      )}
    </div>
  )
}

function SearchField({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const [text, setText] = useState(value)
  // Значение q из URL, с которым сейчас согласовано поле
  const [syncedValue, setSyncedValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastWrittenRef = useRef(value)

  // q изменился не из этого поля («Назад», сброс, переход по ссылке) — показываем новое значение.
  // Своя запись заранее обновляет syncedValue, поэтому не перетирает то, что пользователь успел допечатать.
  if (value !== syncedValue) {
    setSyncedValue(value)
    setText(value)
  }

  // Внешнее изменение отменяет ещё не записанный ввод
  useEffect(() => {
    if (syncedValue !== lastWrittenRef.current) clearTimeout(timerRef.current)
  }, [syncedValue])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value
    setText(next)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const normalized = normalizeSearchText(next)
      lastWrittenRef.current = normalized
      setSyncedValue(normalized)
      onSearch(next)
    }, SEARCH_DEBOUNCE_MS)
  }

  return (
    <div className="relative w-full sm:w-72">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={text}
        onChange={handleChange}
        placeholder="Поиск по тексту"
        aria-label="Поиск по тексту отзывов"
        className="pl-8"
      />
    </div>
  )
}

function MultiSelectFilter<T extends string>({
  label,
  options,
  labels,
  selected,
  onChange,
}: {
  label: string
  options: readonly T[]
  labels: Record<T, string>
  selected: readonly T[]
  onChange: (selected: T[]) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="tabular-nums" aria-label={`выбрано: ${selected.length}`}>
              {selected.length}
            </Badge>
          )}
          <ChevronDown data-icon="inline-end" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={selected.includes(option)}
            onCheckedChange={(checked) =>
              onChange(checked ? [...selected, option] : selected.filter((value) => value !== option))
            }
            // Меню не закрывается: можно отметить несколько значений подряд
            onSelect={(event) => event.preventDefault()}
          >
            {labels[option]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
