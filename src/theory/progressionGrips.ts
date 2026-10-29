/**
 * Chooses a V-System grip for each chord in a generated progression.
 *
 * Everyday comping lives on drop 2. Wider groups — drop 3, close position,
 * then the octave-displaced and very wide shapes — are tougher to hold.
 * Exoticism raises the odds of those tough groups. It does not remove the
 * easy ones, so a hot setting still lands on drop 2 some of the time.
 * The inversion and neck position voice-lead from the previous grip.
 */

import type { ParsedChord } from './chords'
import {
  defaultProgressionVoicing,
  generateAllGroups,
  type GroupResult,
  type Voicing,
} from './voicings'

/**
 * Distance from drop-2 comping. Stock guitar groups sit low; the rare wide
 * groups from Ted Greene's table sit high.
 */
const EXOTICNESS: Record<string, number> = {
  'V-2': 0,
  'V-4': 1,
  'V-1': 2,
  'V-3': 2.5,
  'V-5': 3.5,
  'V-6': 5,
  'V-7': 5.5,
  'V-8': 6,
  'V-9': 6.5,
  'V-10': 7,
  'V-14': 8,
  'V-11': 8.5,
  'V-12': 9,
  'V-13': 10,
}

export const EXOTICISM_MAX = 4

const TOUGH_EXOTICNESS = 6

export function gripExoticness(groupId: string): number {
  return EXOTICNESS[groupId] ?? 10
}

export function clampExoticism(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (value >= EXOTICISM_MAX) return EXOTICISM_MAX
  return Math.round(value * 100) / 100
}

/**
 * Stock weight always prefers drop 2. A second weight, mixed in by the
 * slider, prefers the wide groups around V-11. Both stay in the draw once
 * the slider leaves zero.
 */
export function gripPreference(groupId: string, exoticism: number): number {
  const exotic = gripExoticness(groupId)
  const level = clampExoticism(exoticism)
  if (level <= 0) return exotic === 0 ? 1 : 0

  const openness = level / EXOTICISM_MAX
  const stock = Math.exp(-exotic / 2.4)
  const delta = (exotic - 8.5) / 3.4
  const wild = Math.exp(-(delta * delta))
  const mix = Math.pow(openness, 1.15)
  return stock * (1 - mix * 0.45) + wild * (mix * 0.55)
}

/** What the exoticism slider is doing to the draw, in one line. */
export function exoticismLabel(exoticism: number): string {
  const level = clampExoticism(exoticism)
  if (level <= 0) return 'Drop 2 only'
  if (level < 1.2) return 'Mostly drop 2, with a wider grip now and then'
  if (level < 2.4) return 'Stock grips, and open voicings some of the time'
  if (level < 3.4) return 'Tough grips come up often, easy ones still do'
  return 'Tough wide grips are likely, not guaranteed'
}

export function isToughGrip(groupId: string): boolean {
  return gripExoticness(groupId) >= TOUGH_EXOTICNESS
}

/**
 * One grip per chord. Randomness only picks the group; the fingering is the
 * one that moves least from the previous chord.
 */
export function voiceProgressionGrips(
  chords: readonly (ParsedChord | null)[],
  exoticism: number,
  random: () => number = Math.random,
): (Voicing | null)[] {
  const level = clampExoticism(exoticism)
  const groupsBySymbol = new Map<string, GroupResult[]>()
  const grips: (Voicing | null)[] = []
  let previous: Voicing | null = null
  for (const chord of chords) {
    const grip: Voicing | null = chord
      ? pickGrip(chord, level, random, previous, groupsBySymbol)
      : null
    grips.push(grip)
    if (grip) previous = grip
  }
  return grips
}

function pickGrip(
  chord: ParsedChord,
  exoticism: number,
  random: () => number,
  previous: Voicing | null,
  groupsBySymbol: Map<string, GroupResult[]>,
): Voicing | null {
  let groups = groupsBySymbol.get(chord.symbol)
  if (!groups) {
    groups = generateAllGroups(chord)
    groupsBySymbol.set(chord.symbol, groups)
  }

  const pool = groups
    .filter((result) => result.voicingCount > 0)
    .map((result) => ({
      result,
      weight:
        gripPreference(result.group.id, exoticism) *
        varietyFactor(result.group.id === previous?.groupId, exoticism),
    }))
    .filter((entry) => entry.weight > 0)

  if (pool.length === 0) {
    return defaultProgressionVoicing(chord, previous?.fingering.lowestFret)
  }

  const chosen = pickWeighted(pool, random)
  const voicings = chosen.result.inversions.flatMap((option) => option.voicings)
  return bestVoiceLeading(voicings, previous)
}

/** Repeating one spacing is fine when exoticism is low, and less so as it rises. */
function varietyFactor(sameGroup: boolean, exoticism: number): number {
  if (!sameGroup || exoticism <= 1) return 1
  const t = Math.min(1, (exoticism - 1) / (EXOTICISM_MAX - 1))
  return 1 - t * 0.7
}

function bestVoiceLeading(
  voicings: readonly Voicing[],
  previous: Voicing | null,
): Voicing | null {
  if (voicings.length === 0) return null
  return [...voicings].sort(
    (a, b) => voiceLeadCost(a, previous) - voiceLeadCost(b, previous),
  )[0]
}

function voiceLeadCost(voicing: Voicing, previous: Voicing | null): number {
  if (!previous) {
    return (
      voicing.inversion * 100 +
      voicing.fingering.difficulty +
      voicing.fingering.lowestFret * 0.1
    )
  }
  const from = [...previous.fingering.midiNotes].sort((a, b) => a - b)
  const to = [...voicing.fingering.midiNotes].sort((a, b) => a - b)
  let motion = 0
  const count = Math.min(from.length, to.length)
  for (let index = 0; index < count; index++) {
    motion += Math.abs(to[index] - from[index])
  }
  const fromPcs = new Set(from.map(pitchClass))
  let shared = 0
  for (const midi of to) {
    const pc = pitchClass(midi)
    if (fromPcs.has(pc)) {
      shared += 1
      fromPcs.delete(pc)
    }
  }
  const position = Math.abs(
    voicing.fingering.lowestFret - previous.fingering.lowestFret,
  )
  return motion + position * 2 - shared * 4 + voicing.fingering.difficulty * 0.5
}

function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12
}

function pickWeighted<T extends { weight: number }>(
  items: readonly T[],
  random: () => number,
): T {
  const pool = [...items].sort((a, b) => b.weight - a.weight)
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = random() * total
  for (const entry of pool) {
    roll -= entry.weight
    if (roll <= 0) return entry
  }
  return pool[pool.length - 1]
}
