/**
 * The chord-tone ladder for a V-group (or triad family): the ascending
 * cycle of chord tones, with the group's gaps marking which rungs sound
 * and which are skipped.
 */

import type { ChordTone } from './chords'

export interface LadderRung {
  index: number
  tone: ChordTone
  /** SATB (or triad) label when this rung is a sounding voice. */
  voice: string | null
}

function voiceNames(count: number): string[] {
  if (count === 3) return ['bass', 'middle', 'top']
  return ['bass', 'tenor', 'alto', 'soprano']
}

/**
 * Walks the chord-tone cycle from the inversion's bass tone, using the
 * same gap rule as {@link buildShape}.
 */
export function buildLadderRungs(
  tones: ChordTone[],
  gaps: readonly number[],
  inversion: number
): LadderRung[] {
  const cycle = [...tones].sort((a, b) => a.semitones - b.semitones)
  const n = cycle.length
  if (n < 2 || gaps.length !== n - 1) return []

  const start = ((inversion % n) + n) % n
  const indices = [start]
  for (const gap of gaps) {
    indices.push(indices[indices.length - 1] + 1 + gap)
  }

  const names = voiceNames(n)
  const voiceAt = new Map<number, string>()
  indices.forEach((index, i) => {
    const name = names[i]
    if (name) voiceAt.set(index, name)
  })

  const top = indices[indices.length - 1] ?? start
  const rungs: LadderRung[] = []
  for (let i = start; i <= top; i++) {
    rungs.push({
      index: i,
      tone: cycle[((i % n) + n) % n],
      voice: voiceAt.get(i) ?? null,
    })
  }
  return rungs
}
