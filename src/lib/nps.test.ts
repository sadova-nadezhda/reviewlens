import { describe, expect, it } from 'vitest'
import { npsGroup } from './nps'

describe('npsGroup', () => {
  it.each([
    [0, 'detractor'],
    [6, 'detractor'],
    [7, 'passive'],
    [8, 'passive'],
    [9, 'promoter'],
    [10, 'promoter'],
  ] as const)('%i → %s', (score, group) => {
    expect(npsGroup(score)).toBe(group)
  })

  it.each([-1, 11, 7.5, Number.NaN])('отклоняет оценку %s', (score) => {
    expect(() => npsGroup(score)).toThrow(RangeError)
  })
})
