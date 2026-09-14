export type NpsGroup = 'promoter' | 'passive' | 'detractor'

/** Группа NPS по оценке 0–10: 9–10 — промоутеры, 7–8 — нейтральные, 0–6 — критики */
export function npsGroup(score: number): NpsGroup {
  if (!Number.isInteger(score) || score < 0 || score > 10) {
    throw new RangeError(`Оценка NPS должна быть целым числом от 0 до 10, получено ${score}`)
  }
  if (score >= 9) return 'promoter'
  if (score >= 7) return 'passive'
  return 'detractor'
}
