import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AnalysisStatusBadge, ReviewDate, TWO_LINES_TEXT_CLASS, TextValue } from './cells'

describe('TextValue', () => {
  it.each([
    ['null', null],
    ['пустая строка', ''],
    ['только пробелы', '   '],
  ])('%s показывается как «—»', (_, value) => {
    render(<TextValue value={value} />)
    expect(screen.getByLabelText('Нет данных')).toHaveTextContent('—')
  })

  it('длинный текст ограничен двумя строками с высотой в px', () => {
    render(<TextValue value="Очень длинный отзыв" lines={2} />)
    const text = screen.getByText('Очень длинный отзыв')
    expect(text).toHaveClass(...TWO_LINES_TEXT_CLASS.split(' '))
    expect(text).toHaveAttribute('title', 'Очень длинный отзыв')
  })
})

describe('ReviewDate', () => {
  it('показывает только дату, время — в подсказке', () => {
    render(<ReviewDate value="2026-09-14T12:30:00Z" />)
    const time = screen.getByRole('time')
    expect(time.textContent).toMatch(/^\d{1,2}\s\S+\s2026$/)
    expect(time.getAttribute('title')).toMatch(/, \d{2}:\d{2}$/)
  })
})

describe('AnalysisStatusBadge', () => {
  it('для done ничего не показывает', () => {
    const { container } = render(<AnalysisStatusBadge status="done" />)
    expect(container).toBeEmptyDOMElement()
  })

  it.each([
    ['pending', 'Ожидает анализа'],
    ['error', 'Ошибка анализа'],
  ] as const)('для %s показывает бейдж «%s»', (status, label) => {
    render(<AnalysisStatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
