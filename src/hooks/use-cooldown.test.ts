import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCooldown } from './use-cooldown'

describe('useCooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('без запуска ничего не отсчитывает', () => {
    const { result } = renderHook(() => useCooldown())
    expect(result.current.remainingSeconds).toBe(0)
  })

  it('отсчитывает секунды до нуля', () => {
    const { result } = renderHook(() => useCooldown())

    act(() => result.current.start(60))
    expect(result.current.remainingSeconds).toBe(60)

    act(() => vi.advanceTimersByTime(20_000))
    expect(result.current.remainingSeconds).toBe(40)

    act(() => vi.advanceTimersByTime(40_000))
    expect(result.current.remainingSeconds).toBe(0)
  })
})
