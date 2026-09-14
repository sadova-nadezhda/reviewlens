import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './use-debounced-value'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('обновляет значение только после паузы', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'к' },
    })

    rerender({ value: 'ку' })
    act(() => vi.advanceTimersByTime(200))
    rerender({ value: 'кур' })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('к')

    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe('кур')
  })
})
