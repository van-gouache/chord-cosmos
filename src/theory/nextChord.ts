/**
 * Next-chord suggestions from the last chord in a group.
 * Functional moves (ii–V–I, deceptive vi, applied dominants) in the
 * group's key, or in a key inferred from the chords already there.
 */

import { tryParseChord } from './chords'
import {
  DEFAULT_MODE,
  isKeyCenter,
  progressionFamilies,
  type KeyCenter,
  type ModeId,
  type ProgressionStep,
} from './diatonic'
import { suggestKeyCenters } from './keySuggestions'

export interface NextChordSuggestion {
  step: ProgressionStep
  reason: string
}

export interface NextChordPlan {
  keyRoot: KeyCenter
  mode: ModeId
  inferred: boolean
  suggestions: NextChordSuggestion[]
}

const MAX_SUGGESTIONS = 4
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const

const MINOR_MODES: ReadonlySet<ModeId> = new Set([
  'dorian',
  'phrygian',
  'aeolian',
  'locrian',
  'harmonic-minor',
  'melodic-minor',
])

interface Wish {
  id: string
  fallbackId?: string
  reason: string
  score: number
}

export function suggestNextChords(
  symbols: readonly string[],
  keyRoot?: string | null,
  mode: ModeId = DEFAULT_MODE,
): NextChordPlan | null {
  const explicit = isKeyCenter(keyRoot) ? keyRoot : null
  const inferred = explicit ? null : suggestKeyCenters([...symbols])[0]
  const key = explicit ?? inferred?.keyRoot ?? null
  const scale = explicit ? mode : (inferred?.mode ?? mode)
  if (!key) return null

  const steps = progressionFamilies(key, scale).flatMap((family) => family.steps)
  if (steps.length === 0) return null

  const played = playableSymbols(symbols)
  const last = played[played.length - 1]
  const previous = played.length > 1 ? played[played.length - 2] : null
  const source = last ? stepForSymbol(last, steps) : undefined
  const prior = previous ? stepForSymbol(previous, steps) : undefined
  const wishes = source
    ? withContext(wishesFor(source), source, prior)
    : openingWishes(scale)

  const used = new Set<string>()
  if (last) used.add(canonical(last))
  const suggestions = takeSuggestions(steps, wishes, used)
  if (suggestions.length === 0) return null

  return {
    keyRoot: key,
    mode: scale,
    inferred: explicit === null,
    suggestions,
  }
}

function playableSymbols(symbols: readonly string[]): string[] {
  return symbols.filter((symbol) => tryParseChord(symbol).chord)
}

function canonical(symbol: string): string {
  return tryParseChord(symbol).chord?.symbol ?? symbol
}

function stepForSymbol(
  symbol: string,
  steps: readonly ProgressionStep[],
): ProgressionStep | undefined {
  const chord = tryParseChord(symbol).chord
  if (!chord) return undefined
  return (
    steps.find((step) => step.symbol === chord.symbol) ??
    steps.find((step) => {
      const other = tryParseChord(step.symbol).chord
      return other?.rootPc === chord.rootPc && step.kind === 'diatonic'
    })
  )
}

function wishesFor(source: ProgressionStep): Wish[] {
  if (
    source.kind === 'secondary-ii' ||
    source.id.startsWith('sec-ii-') ||
    source.id.startsWith('sec-iio-')
  ) {
    const target = source.degree
    return [
      {
        id: `sec-v-${target}`,
        fallbackId: target === 1 ? 'diatonic-5' : undefined,
        reason: target === 1 ? 'ii–V' : `V7 of ${ROMAN[target - 1]}`,
        score: 10,
      },
      {
        id: `diatonic-${target}`,
        reason: target === 1 ? 'Skip ahead to I' : `Skip ahead to ${ROMAN[target - 1]}`,
        score: 4,
      },
    ]
  }

  if (
    source.kind === 'secondary-dominant' ||
    source.kind === 'tritone' ||
    source.id.startsWith('sec-v-') ||
    source.id.startsWith('tt-')
  ) {
    const target = source.degree
    const wishes: Wish[] = [
      {
        id: `diatonic-${target}`,
        reason:
          target === 1 ? 'Resolves to I' : `Resolves to ${ROMAN[target - 1]}`,
        score: 10,
      },
    ]
    if (target === 1) {
      wishes.push(
        { id: 'diatonic-6', reason: 'Deceptive, to vi', score: 6 },
        {
          id: 'sec-ii-1',
          fallbackId: 'diatonic-2',
          reason: 'Back into a ii–V',
          score: 3,
        },
      )
    }
    return wishes
  }

  if (source.roman === 'bVII7' || source.roman === 'bVIIΔ7') {
    return [
      { id: 'diatonic-1', reason: 'Backdoor to I', score: 10 },
      { id: 'diatonic-4', reason: 'To the subdominant', score: 4 },
    ]
  }

  if (source.roman === 'iv-7' || source.roman === 'iv6') {
    return [
      { id: 'diatonic-1', reason: 'Minor plagal to I', score: 9 },
      {
        id: 'sec-v-1',
        fallbackId: 'diatonic-5',
        reason: 'To the dominant',
        score: 5,
      },
    ]
  }

  if (source.kind === 'passing-dim') {
    const passing: Record<string, Wish> = {
      '#IV°7': { id: 'diatonic-5', reason: 'Passing up to V', score: 9 },
      '#I°7': { id: 'diatonic-2', reason: 'Passing up to ii', score: 9 },
      '#II°7': { id: 'diatonic-3', reason: 'Passing up to iii', score: 8 },
      '#V°7': { id: 'diatonic-6', reason: 'Passing up to vi', score: 8 },
      'I°7': { id: 'diatonic-1', reason: 'Back to I', score: 8 },
    }
    const wish = passing[source.roman]
    if (wish) return [wish, { id: 'diatonic-1', reason: 'Back to I', score: 3 }]
  }

  if (source.roman === 'I6' || source.roman === 'I7') return degreeWishes(1)
  if (source.roman === 'IV6' || source.roman === 'IV7') return degreeWishes(4)
  return degreeWishes(source.degree)
}

function degreeWishes(degree: number): Wish[] {
  switch (degree) {
    case 1:
      return [
        { id: 'diatonic-6', reason: 'Away from the tonic', score: 6 },
        { id: 'diatonic-4', reason: 'To the subdominant', score: 5 },
        {
          id: 'diatonic-2',
          fallbackId: 'sec-ii-1',
          reason: 'Start a ii–V',
          score: 5,
        },
        {
          id: 'diatonic-5',
          fallbackId: 'sec-v-1',
          reason: 'To the dominant',
          score: 4,
        },
      ]
    case 2:
      return [
        {
          id: 'sec-v-1',
          fallbackId: 'diatonic-5',
          reason: 'ii–V',
          score: 10,
        },
        { id: 'diatonic-1', reason: 'Back to the tonic', score: 3 },
        { id: 'diatonic-4', reason: 'To the subdominant', score: 2 },
      ]
    case 3:
      return [
        { id: 'diatonic-6', reason: 'Down a fifth', score: 7 },
        { id: 'diatonic-4', reason: 'To the subdominant', score: 5 },
        {
          id: 'sec-v-1',
          fallbackId: 'diatonic-5',
          reason: 'To the dominant',
          score: 3,
        },
      ]
    case 4:
      return [
        {
          id: 'sec-v-1',
          fallbackId: 'diatonic-5',
          reason: 'IV–V',
          score: 7,
        },
        { id: 'diatonic-1', reason: 'Plagal, back to I', score: 6 },
        { id: 'diatonic-2', reason: 'To ii', score: 4 },
      ]
    case 5:
      return [
        { id: 'diatonic-1', reason: 'Resolves to I', score: 10 },
        { id: 'diatonic-6', reason: 'Deceptive, to vi', score: 6 },
        { id: 'diatonic-2', reason: 'Back into a ii–V', score: 3 },
      ]
    case 6:
      return [
        { id: 'diatonic-2', reason: 'vi–ii', score: 7 },
        { id: 'diatonic-4', reason: 'To the subdominant', score: 5 },
        {
          id: 'sec-v-1',
          fallbackId: 'diatonic-5',
          reason: 'To the dominant',
          score: 4,
        },
      ]
    case 7:
      return [
        { id: 'diatonic-1', reason: 'Leading tone to I', score: 8 },
        { id: 'diatonic-3', reason: 'To iii', score: 4 },
        {
          id: 'sec-v-1',
          fallbackId: 'diatonic-5',
          reason: 'To the dominant',
          score: 3,
        },
      ]
    default:
      return [{ id: 'diatonic-1', reason: 'Back to the tonic', score: 5 }]
  }
}

function withContext(
  wishes: Wish[],
  source: ProgressionStep,
  previous: ProgressionStep | undefined,
): Wish[] {
  if (!previous) return wishes
  const previousIsTwo =
    previous.degree === 2 &&
    (previous.kind === 'diatonic' || previous.kind === 'secondary-ii')
  const sourceIsTonicDominant =
    source.roman === 'V7' ||
    source.id === 'sec-v-1' ||
    (source.kind === 'diatonic' && source.degree === 5 && source.roman.startsWith('V'))
  if (!previousIsTwo || !sourceIsTonicDominant) return wishes
  return wishes.map((wish) =>
    wish.id === 'diatonic-1'
      ? { ...wish, score: wish.score + 5, reason: 'ii–V–I' }
      : wish,
  )
}

function openingWishes(mode: ModeId): Wish[] {
  if (MINOR_MODES.has(mode)) {
    return [
      { id: 'diatonic-1', reason: 'Start on the tonic', score: 8 },
      { id: 'diatonic-4', reason: 'Start on the subdominant', score: 6 },
      {
        id: 'sec-v-1',
        fallbackId: 'diatonic-5',
        reason: 'Start on the dominant',
        score: 5,
      },
      { id: 'diatonic-6', reason: 'Start on VI', score: 4 },
    ]
  }
  return [
    { id: 'diatonic-1', reason: 'Start on the tonic', score: 8 },
    { id: 'diatonic-6', reason: 'Start on vi', score: 6 },
    { id: 'diatonic-2', reason: 'Start a ii–V', score: 5 },
    { id: 'diatonic-4', reason: 'Start on IV', score: 4 },
  ]
}

function takeSuggestions(
  steps: readonly ProgressionStep[],
  wishes: readonly Wish[],
  used: Set<string>,
): NextChordSuggestion[] {
  const ranked = [...wishes].sort((a, b) => b.score - a.score)
  const suggestions: NextChordSuggestion[] = []
  for (const wish of ranked) {
    if (suggestions.length >= MAX_SUGGESTIONS) break
    const step = resolveWish(steps, wish)
    if (!step || used.has(step.symbol)) continue
    used.add(step.symbol)
    suggestions.push({ step, reason: wish.reason })
  }
  return suggestions
}

function resolveWish(
  steps: readonly ProgressionStep[],
  wish: Wish,
): ProgressionStep | undefined {
  return (
    steps.find((step) => step.id === wish.id) ??
    (wish.fallbackId
      ? steps.find((step) => step.id === wish.fallbackId)
      : undefined)
  )
}
