import { describe, expect, it } from 'vitest'

import type { ProgressionStep } from './diatonic'
import { clampSpiciness, generateProgression, spiceReadout } from './generateProgression'

const zero = () => 0
const high = () => 0.99

describe('generateProgression', () => {
  it('walks a major key along the top functional moves', () => {
    const progression = generateProgression({
      count: 4,
      keyRoot: 'C',
      mode: 'ionian',
      spiciness: 0,
      random: zero,
    })
    expect(progression.steps.map((step) => step.symbol)).toEqual([
      'CΔ7',
      'A-7',
      'D-7',
      'G7',
    ])
    expect(progression.steps.every((step) => step.kind === 'diatonic')).toBe(true)
  })

  it('cadences a minor key with its major V7', () => {
    const progression = generateProgression({
      count: 4,
      keyRoot: 'A',
      mode: 'aeolian',
      spiciness: 0,
      random: zero,
    })
    expect(progression.steps.map((step) => step.symbol)).toEqual([
      'A-7',
      'FΔ7',
      'Bø7',
      'E7',
    ])
  })

  it('keeps plain progressions inside the key', () => {
    for (const seed of [1, 2, 3, 7, 11, 42, 99]) {
      const progression = generateProgression({
        count: 8,
        keyRoot: 'C',
        mode: 'ionian',
        spiciness: 0,
        random: mulberry32(seed),
      })
      expect(progression.steps).toHaveLength(8)
      expect(progression.steps.every(isInsideKey)).toBe(true)
      expect(noAdjacentRepeat(progression.steps)).toBe(true)
    }
  })

  it('can stay diatonic at mild spiciness when the rolls stay functional', () => {
    const progression = generateProgression({
      count: 6,
      keyRoot: 'C',
      mode: 'ionian',
      spiciness: 1,
      random: high,
    })
    expect(progression.steps.every(isInsideKey)).toBe(true)
  })

  it('drops an applied dominant in front of its target', () => {
    const progression = generateProgression({
      count: 4,
      keyRoot: 'C',
      mode: 'ionian',
      spiciness: 2,
      random: zero,
    })
    expect(progression.steps.map((step) => step.symbol)).toEqual([
      'CΔ7',
      'E7',
      'A-7',
      'D-7',
    ])
    expect(progression.steps[1]).toMatchObject({
      roman: 'V7/VI',
      kind: 'secondary-dominant',
    })
  })

  it('opens a wild progression with an outside chord that resolves', () => {
    const progression = generateProgression({
      count: 4,
      keyRoot: 'C',
      mode: 'ionian',
      spiciness: 4,
      random: zero,
    })
    expect(progression.steps.map((step) => step.symbol)).toEqual([
      'Bb7',
      'CΔ7',
      'E7',
      'A-7',
    ])
    expect(progression.steps[0]?.roman).toBe('bVII7')
    expect(progression.steps[2]?.roman).toBe('V7/VI')
  })

  it('clamps the length', () => {
    expect(
      generateProgression({
        count: 0,
        keyRoot: 'C',
        spiciness: 0,
        random: zero,
      }).steps,
    ).toHaveLength(1)
    expect(
      generateProgression({
        count: 40,
        keyRoot: 'C',
        spiciness: 0,
        random: zero,
      }).steps,
    ).toHaveLength(16)
  })

  it('keeps fractional readings between the named steps', () => {
    expect(clampSpiciness(2.246)).toBe(2.25)
    expect(clampSpiciness(2)).toBe(2)
    expect(spiceReadout(2.2).label).toBe('Medium')
    expect(spiceReadout(2.6).label).toBe('Spicy')
  })

  it('brings in outside chords gradually as the slider rises', () => {
    const outside = (spice: number) => {
      let count = 0
      for (let seed = 1; seed <= 40; seed++) {
        const progression = generateProgression({
          count: 8,
          keyRoot: 'C',
          mode: 'ionian',
          spiciness: spice,
          random: mulberry32(seed),
        })
        count += progression.steps.filter((step) => !isInsideKey(step)).length
      }
      return count
    }
    const mild = outside(0.4)
    const hot = outside(3.6)
    expect(outside(0)).toBe(0)
    expect(mild).toBeGreaterThan(0)
    expect(hot).toBeGreaterThan(mild)
  })
})

function isInsideKey(step: ProgressionStep): boolean {
  if (step.kind === 'diatonic') return true
  return (
    (step.kind === 'secondary-dominant' || step.kind === 'secondary-ii') &&
    step.degree === 1
  )
}

function noAdjacentRepeat(steps: readonly ProgressionStep[]): boolean {
  return steps.every(
    (step, index) => index === 0 || step.symbol !== steps[index - 1]?.symbol,
  )
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
