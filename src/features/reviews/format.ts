const numberFormat = new Intl.NumberFormat('ru-RU')

export function formatCount(value: number): string {
  return numberFormat.format(value)
}

type DateFormatters = { date: Intl.DateTimeFormat; time: Intl.DateTimeFormat }

const dateFormatters = new Map<string, DateFormatters>()

function formattersFor(timeZone: string | undefined): DateFormatters {
  const key = timeZone ?? 'local'
  let formatters = dateFormatters.get(key)
  if (!formatters) {
    formatters = {
      date: new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone }),
      time: new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone }),
    }
    dateFormatters.set(key, formatters)
  }
  return formatters
}

/** «14 сент. 2026» и «15:30» в часовом поясе пользователя (timeZone — для тестов) */
export function formatReviewDate(iso: string, timeZone?: string): { date: string; time: string } {
  const value = new Date(iso)
  const { date, time } = formattersFor(timeZone)
  return {
    // В краткой форме Intl добавляет «г.» — в узкой колонке это лишнее
    date: date.format(value).replace(/\s?г\.$/, ''),
    time: time.format(value),
  }
}
