/**
 * Builds a chord progression in a key.
 *
 * Chord choice is a 0–4 reading. The low end stays on functional diatonic
 * moves (and the minor key's normal V7). As it rises, outside chords —
 * applied dominants, tritone subs, backdoor, borrowed color — fade in,
 * and the next chord resolves them. Grip exoticism is chosen separately.
 */

import {
  DEFAULT_MODE,
  isModeId,
  progressionFamilies,
  type KeyCenter,
  type ModeId,
  type ProgressionStep,
} from './diatonic'
import { suggestNextChords } from './nextChord'

export const MIN_GENERATED_CHORDS = 1
export const MAX_GENERATED_CHORDS = 16
export const SPICINESS_MAX = 4

export const SPICINESS_LABELS = [
  'Plain',
  'Mild',
  'Medium',
  'Spicy',
  'Wild',
] as const

export const SPICINESS_HINTS = [
  'Stays inside the key',
  'An applied dominant now and then',
  'Secondary dominants and a little color',
  'Tritone subs, backdoor, and borrowed chords',
  'Outside changes show up often',
] as const

export interface GenerateProgressionChoice {
  count: number
  keyRoot: KeyCenter
  mode?: ModeId
  spiciness: number
  /** 0 keeps drop 2. Higher values make tough V-system groups more likely. */
  exoticism?: number
  random?: () => number
}

export interface GeneratedProgression {
  keyRoot: KeyCenter
  mode: ModeId
  steps: ProgressionStep[]
}

/** How often the next chord is the top functional choice, then the runners-up. */
const FUNCTIONAL_WEIGHTS: readonly (readonly number[])[] = [
  [0.55, 0.25, 0.14, 0.06],
  [0.62, 0.24, 0.1, 0.04],
  [0.48, 0.28, 0.16, 0.08],
  [0.34, 0.28, 0.22, 0.16],
  [0.22, 0.26, 0.26, 0.26],
]

/** Chance a step is an outside approach instead of the functional chord. */
const APPROACH_CHANCE = [0, 0.16, 0.36, 0.55, 0.74] as const

interface OddChange {
  step: ProgressionStep
  /** Played on the following beat so the outside chord has somewhere to go. */
  resolution?: ProgressionStep
  minSpice: number
}

export function clampGeneratedCount(value: number): number {
  const count = Math.round(value)
  if (!Number.isFinite(count)) return 4
  return Math.min(
    MAX_GENERATED_CHORDS,
    Math.max(MIN_GENERATED_CHORDS, count),
  )
}

/** Keeps a slider reading on the 0–4 scale without snapping it to a whole step. */
export function clampSpiciness(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (value >= SPICINESS_MAX) return SPICINESS_MAX
  return Math.round(value * 100) / 100
}

/** The nearest named step, for the label beside the continuous slider. */
export function spiceReadout(spice: number): {
  value: number
  label: (typeof SPICINESS_LABELS)[number]
  hint: (typeof SPICINESS_HINTS)[number]
} {
  const value = clampSpiciness(spice)
  const x = Math.min(SPICINESS_LABELS.length - 1, value)
  const lower = Math.floor(x)
  const upper = Math.min(SPICINESS_LABELS.length - 1, lower + 1)
  const index = x - lower < 0.5 ? lower : upper
  return {
    value,
    label: SPICINESS_LABELS[index],
    hint: SPICINESS_HINTS[index],
  }
}

export function generateProgression(
  choice: GenerateProgressionChoice,
): GeneratedProgression {
  const mode = choice.mode && isModeId(choice.mode) ? choice.mode : DEFAULT_MODE
  const spice = clampSpiciness(choice.spiciness)
  const count = clampGeneratedCount(choice.count)
  const random = choice.random ?? Math.random
  const byId = stepsById(choice.keyRoot, mode)
  const steps: ProgressionStep[] = []
  const queue: ProgressionStep[] = []

  for (let index = 0; index < count; index++) {
    const queued = queue.shift()
    if (queued) {
      steps.push(queued)
      continue
    }

    const plan = suggestNextChords(
      steps.map((step) => step.symbol),
      choice.keyRoot,
      mode,
    )
    const choices = plan?.suggestions.map((item) => item.step) ?? []
    if (choices.length === 0) break

    const chosen = weightedPick(choices, weightsAt(spice), random)
    const last = index === count - 1
    const opening = index > 0 ? 1 : spice <= 2 ? 0 : Math.min(1, spice - 2)
    const chance = approachChanceAt(spice) * opening
    if (!last && chance > 0 && random() < chance) {
      const odd = pickApproach(
        chosen,
        byId,
        spice,
        steps.at(-1)?.symbol,
        random,
      )
      if (odd) {
        steps.push(odd.step)
        if (odd.resolution) queue.push(odd.resolution)
        continue
      }
    }
    steps.push(chosen)
  }

  return { keyRoot: choice.keyRoot, mode, steps }
}

function stepsById(
  keyRoot: KeyCenter,
  mode: ModeId,
): Map<string, ProgressionStep> {
  const map = new Map<string, ProgressionStep>()
  for (const family of progressionFamilies(keyRoot, mode)) {
    for (const step of family.steps) {
      if (!map.has(step.id)) map.set(step.id, step)
    }
  }
  return map
}

function oddChanges(
  destination: ProgressionStep,
  byId: Map<string, ProgressionStep>,
): OddChange[] {
  if (destination.kind !== 'diatonic') return []
  const degree = destination.degree
  const changes: OddChange[] = []

  const add = (
    id: string,
    minSpice: number,
    resolution?: ProgressionStep,
  ) => {
    const step = byId.get(id)
    if (!step || step.symbol === destination.symbol) return
    if (resolution && resolution.symbol === step.symbol) return
    changes.push({ step, resolution, minSpice })
  }

  if (degree === 1) {
    add('chromatic-bVII7', 2, destination)
    add('chromatic-iv-7', 2, destination)
    add('tt-1', 3, destination)
    add('chromatic-bVIΔ7', 3, destination)
    add('chromatic-bIIIΔ7', 4, destination)
    add('chromatic-bIIΔ7', 4, destination)
    add('dim-tonic', 4, destination)
  } else {
    const applied = byId.get(`sec-v-${degree}`)
    if (applied && applied.symbol !== destination.symbol) {
      changes.push({ step: applied, resolution: destination, minSpice: 1 })
      const setup = byId.get(`sec-ii-${degree}`)
      if (
        setup &&
        setup.symbol !== applied.symbol &&
        setup.symbol !== destination.symbol
      ) {
        changes.push({ step: setup, resolution: applied, minSpice: 2 })
      }
    }
    add(`tt-${degree}`, 3, destination)
    const passing: Partial<Record<number, string>> = {
      2: 'dim-sharp-1',
      3: 'dim-sharp-2',
      5: 'dim-sharp-4',
      6: 'dim-sharp-5',
    }
    const dimId = passing[degree]
    if (dimId) add(dimId, 3, destination)
  }

  add(`borrowed-${degree}`, 3)
  return changes
}

/** Blends the five anchor rows so a fractional slider reading sits between them. */
function weightsAt(spice: number): number[] {
  return blendAnchors(FUNCTIONAL_WEIGHTS, spice)
}

function approachChanceAt(spice: number): number {
  return blendAnchors(
    APPROACH_CHANCE.map((chance) => [chance]),
    spice,
  )[0]
}

function blendAnchors(
  anchors: readonly (readonly number[])[],
  spice: number,
): number[] {
  const x = Math.min(Math.max(spice, 0), anchors.length - 1)
  const lower = Math.floor(x)
  const upper = Math.min(anchors.length - 1, lower + 1)
  const t = x - lower
  return anchors[lower].map(
    (weight, index) => weight * (1 - t) + anchors[upper][index] * t,
  )
}

/**
 * An outside change fades in across the step below its anchor, and is fully
 * available once the slider reaches that anchor. Whole-number readings match
 * the old on/off gates.
 */
function approachWeight(minSpice: number, spice: number): number {
  if (minSpice <= 0) return 1
  const start = minSpice - 1
  if (spice <= start) return 0
  if (spice >= minSpice) return 1
  const t = (spice - start) / (minSpice - start)
  return t * t
}

function pickApproach(
  destination: ProgressionStep,
  byId: Map<string, ProgressionStep>,
  spice: number,
  previousSymbol: string | undefined,
  random: () => number,
): OddChange | null {
  const eligible = oddChanges(destination, byId)
    .map((change) => ({
      change,
      weight:
        change.step.symbol === previousSymbol
          ? 0
          : approachWeight(change.minSpice, spice),
    }))
    .filter((entry) => entry.weight > 0)
  if (eligible.length === 0) return null
  return weightedPick(
    eligible.map((entry) => entry.change),
    eligible.map((entry) => entry.weight),
    random,
  )
}

function weightedPick<T>(
  items: readonly T[],
  weights: readonly number[],
  random: () => number,
): T {
  const paired = items.map((item, index) => ({
    item,
    weight: Math.max(0, weights[index] ?? 0),
  }))
  const usable = paired.filter((entry) => entry.weight > 0)
  const pool =
    usable.length > 0 ? usable : paired.map((entry) => ({ item: entry.item, weight: 1 }))
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = random() * total
  for (const entry of pool) {
    roll -= entry.weight
    if (roll <= 0) return entry.item
  }
  return pool[pool.length - 1].item
}
