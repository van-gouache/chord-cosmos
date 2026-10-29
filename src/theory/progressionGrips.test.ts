import { describe, expect, it } from 'vitest'

import { parseChord } from './chords'
import {
  exoticismLabel,
  gripExoticness,
  gripPreference,
  isToughGrip,
  voiceProgressionGrips,
} from './progressionGrips'

const zero = () => 0

describe('progression grips', () => {
  it('stays on drop 2 when exoticism is off', () => {
    expect(gripPreference('V-13', 0)).toBe(0)
    expect(exoticismLabel(0)).toBe('Drop 2 only')
    const grips = voiceProgressionGrips(chords(), 0, zero)
    expect(grips.every((grip) => grip?.groupId === 'V-2')).toBe(true)
  })

  it('keeps a repeated chord in the same grip', () => {
    const [first, second] = voiceProgressionGrips(
      [parseChord('CΔ7'), parseChord('CΔ7')],
      0,
      zero,
    )
    expect(first?.id).toBe(second?.id)
  })

  it('makes tough grips more likely without dropping the easy ones', () => {
    expect(gripPreference('V-2', 4)).toBeGreaterThan(0)
    expect(gripPreference('V-13', 4)).toBeGreaterThan(gripPreference('V-13', 1))

    const mild = tally(1)
    const hot = tally(4)
    expect(mild.easy).toBeGreaterThan(mild.tough)
    expect(hot.tough).toBeGreaterThan(hot.easy)
    expect(hot.easy).toBeGreaterThan(0)
    expect(hot.tough / hot.total).toBeLessThan(0.92)
    expect(exoticismLabel(4)).toBe('Tough wide grips are likely, not guaranteed')
  })

  it('voice-leads even when the groups get wider', () => {
    const grips = voiceProgressionGrips(chords(), 3.2, mulberry32(7)).filter(
      (grip): grip is NonNullable<typeof grip> => grip != null,
    )
    expect(grips.length).toBeGreaterThan(1)
    const jumps = grips.slice(1).map((grip, index) =>
      Math.abs(grip.fingering.lowestFret - grips[index].fingering.lowestFret),
    )
    const mean = jumps.reduce((sum, jump) => sum + jump, 0) / jumps.length
    expect(mean).toBeLessThan(10)
  })
})

function chords() {
  return ['CΔ7', 'A-7', 'D-7', 'G7', 'CΔ7', 'E7', 'A-7', 'D-7'].map((symbol) =>
    parseChord(symbol),
  )
}

function tally(exoticism: number, seeds = 24) {
  let tough = 0
  let easy = 0
  let total = 0
  for (let seed = 1; seed <= seeds; seed++) {
    for (const grip of voiceProgressionGrips(chords(), exoticism, mulberry32(seed))) {
      if (!grip) continue
      total += 1
      if (isToughGrip(grip.groupId)) tough += 1
      if (gripExoticness(grip.groupId) <= 1) easy += 1
    }
  }
  return { tough, easy, total }
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let next = state
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}
