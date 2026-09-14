import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewListItem } from '../api'
import { HEADER_HEIGHT, ROW_HEIGHT, ReviewsTable, type ReviewsTableProps } from './ReviewsTable'

const makeRow = (id: number, patch: Partial<ReviewListItem> = {}): ReviewListItem => ({
  id,
  body: `Отзыв ${id}`,
  score: 9,
  sentiment: 'positive',
  topic: 'delivery',
  author: 'Анна К.',
  source: 'Сайт',
  reviewed_at: '2026-09-01T10:00:00Z',
  analysis_status: 'done',
  ...patch,
})

const makeRows = (count: number) => Array.from({ length: count }, (_, i) => makeRow(i + 1))

function renderTable(props: Partial<ReviewsTableProps> = {}) {
  const onLoadMore = vi.fn()
  const onSortChange = vi.fn()
  render(
    <ReviewsTable
      rows={[]}
      total={null}
      sort="reviewed_at"
      order="desc"
      onSortChange={onSortChange}
      hasNextPage={false}
      isFetchingNextPage={false}
      isFetchNextPageError={false}
      isRefreshing={false}
      scrollResetKey=""
      onLoadMore={onLoadMore}
      {...props}
    />,
  )
  return { onLoadMore, onSortChange }
}

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row')
const scrollContainer = () => screen.getByRole('table').parentElement!

describe('ReviewsTable', () => {
  beforeEach(() => {
    // jsdom не считает размеры, а виртуализатор берёт высоту контейнера из offsetHeight
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(640)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('рендерит только видимые строки, а не весь список', () => {
    renderTable({ rows: makeRows(1000), total: 5000, hasNextPage: true })
    const rendered = bodyRows()
    expect(rendered.length).toBeGreaterThan(5)
    expect(rendered.length).toBeLessThan(40)
    expect(screen.getByText('Отзыв 1')).toBeInTheDocument()
    expect(screen.queryByText('Отзыв 1000')).not.toBeInTheDocument()
  })

  it('на большом смещении показывает нужные строки на своих местах', () => {
    renderTable({ rows: makeRows(5000), total: 5000 })
    const tbody = screen.getAllByRole('rowgroup')[1]
    // 5000 строк и служебная строка в конце
    expect(tbody).toHaveStyle({ height: `${5001 * ROW_HEIGHT}px` })

    const container = scrollContainer()
    act(() => {
      container.scrollTop = HEADER_HEIGHT + 4000 * ROW_HEIGHT
      fireEvent.scroll(container)
    })

    expect(screen.queryByText('Отзыв 1')).not.toBeInTheDocument()
    const row = screen.getByText('Отзыв 4001').closest('tr')!
    expect(row).toHaveAttribute('aria-rowindex', '4002')
    expect(row).toHaveStyle({ transform: `translateY(${4000 * ROW_HEIGHT}px)`, height: `${ROW_HEIGHT}px` })
  })

  it('показывает шесть колонок, статус анализа только для pending и error и «—» для пустых значений', () => {
    renderTable({
      rows: [
        makeRow(1, { score: null, sentiment: 'negative', topic: 'returns', analysis_status: 'pending' }),
        makeRow(2, { analysis_status: 'done' }),
      ],
      total: 2,
    })
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
    expect(headers).toEqual(['Дата', 'Оценка', 'Тональность', 'Тема', 'Текст отзыва', 'Анализ'])
    expect(screen.getByText('Негатив')).toBeInTheDocument()
    expect(screen.getByText('Возврат и обмен')).toBeInTheDocument()
    expect(screen.getAllByText('Ожидает анализа')).toHaveLength(1)
    expect(screen.queryByText('Проанализирован')).not.toBeInTheDocument()
    expect(screen.getAllByLabelText('Нет данных')).toHaveLength(1)
  })

  describe('сортировка', () => {
    it('отмечает текущую сортировку в заголовке', () => {
      renderTable({ rows: makeRows(3), total: 3, sort: 'score', order: 'asc' })
      expect(screen.getByRole('columnheader', { name: /Оценка/ })).toHaveAttribute('aria-sort', 'ascending')
      expect(screen.getByRole('columnheader', { name: /Дата/ })).toHaveAttribute('aria-sort', 'none')
      expect(screen.getByRole('columnheader', { name: 'Тема' })).not.toHaveAttribute('aria-sort')
    })

    it('клик по другой колонке сортирует её сначала по убыванию', async () => {
      const { onSortChange } = renderTable({ rows: makeRows(3), total: 3 })
      await userEvent.click(screen.getByRole('button', { name: /Оценка/ }))
      expect(onSortChange).toHaveBeenCalledWith({ sort: 'score', order: 'desc' })
    })

    it('клик по текущей колонке меняет направление, не снимая сортировку', async () => {
      const { onSortChange } = renderTable({ rows: makeRows(3), total: 3, sort: 'reviewed_at', order: 'desc' })
      await userEvent.click(screen.getByRole('button', { name: /Дата/ }))
      expect(onSortChange).toHaveBeenCalledWith({ sort: 'reviewed_at', order: 'asc' })
    })

    it('у несортируемых колонок нет кнопки', () => {
      renderTable({ rows: makeRows(3), total: 3 })
      expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Дата', 'Оценка'])
    })
  })

  describe('подгрузка', () => {
    it('запрашивает следующую страницу, когда до конца меньше 20 строк', () => {
      const { onLoadMore } = renderTable({ rows: makeRows(15), total: 500, hasNextPage: true })
      expect(onLoadMore).toHaveBeenCalled()
    })

    it.each([
      ['следующей страницы нет', { hasNextPage: false }],
      ['страница уже грузится', { hasNextPage: true, isFetchingNextPage: true }],
      ['прошлая подгрузка упала', { hasNextPage: true, isFetchNextPageError: true }],
    ])('не запрашивает, если %s', (_, props) => {
      const { onLoadMore } = renderTable({ rows: makeRows(15), total: 500, ...props })
      expect(onLoadMore).not.toHaveBeenCalled()
    })

    it('далеко от конца списка не запрашивает', () => {
      const { onLoadMore } = renderTable({ rows: makeRows(1000), total: 5000, hasNextPage: true })
      expect(onLoadMore).not.toHaveBeenCalled()
    })

    it('после ошибки подгрузки предлагает повторить', async () => {
      const { onLoadMore } = renderTable({
        rows: makeRows(15),
        total: 500,
        hasNextPage: true,
        isFetchNextPageError: true,
      })
      await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
      expect(onLoadMore).toHaveBeenCalledTimes(1)
    })

    it('в конце списка сообщает, что показаны все отзывы', () => {
      renderTable({ rows: makeRows(15), total: 15 })
      expect(screen.getByText(/Показаны все отзывы: 15/)).toBeInTheDocument()
    })
  })
})
