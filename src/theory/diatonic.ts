/**
 * Key-center harmony for the progression builder.
 *
 * Families are diatonic sevenths plus established non-diatonic moves:
 * secondary ii / V7, tritone subs, leftover chromatic bII / bVI / bVII,
 * modal interchange, passing diminished sevenths. Duplicate symbols
 * keep the secondary-function name (V7/II, subV7/V) rather than a
 * chromatic bII7-style label.
 */

import { tryParseChord, type ParsedChord } from './chords'
import { jazzSuffixFromSemitones } from './qualities'
import { mod12, parseNoteName } from './pitch'

export const KEY_CENTERS = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const

export type KeyCenter = (typeof KEY_CENTERS)[number]

export const MODE_OPTIONS = [
  { id: 'ionian', label: 'Ionian', hint: 'major', family: 'mode' },
  { id: 'dorian', label: 'Dorian', hint: 'minor', family: 'mode' },
  { id: 'phrygian', label: 'Phrygian', hint: 'minor', family: 'mode' },
  { id: 'lydian', label: 'Lydian', hint: 'major', family: 'mode' },
  { id: 'mixolydian', label: 'Mixolydian', hint: 'dominant', family: 'mode' },
  { id: 'aeolian', label: 'Aeolian', hint: 'natural minor', family: 'mode' },
  { id: 'locrian', label: 'Locrian', hint: 'half-diminished', family: 'mode' },
  {
    id: 'harmonic-minor',
    label: 'Harmonic minor',
    hint: 'minor ♯7',
    family: 'scale',
  },
  {
    id: 'melodic-minor',
    label: 'Melodic minor',
    hint: 'jazz minor',
    family: 'scale',
  },
  {
    id: 'harmonic-major',
    label: 'Harmonic major',
    hint: 'major ♭6',
    family: 'scale',
  },
] as const

export type ModeId = (typeof MODE_OPTIONS)[number]['id']

export const DEFAULT_MODE: ModeId = 'ionian'

export type ProgressionStepKind =
  | 'diatonic'
  | 'chromatic'
  | 'secondary-dominant'
  | 'secondary-ii'
  | 'borrowed'
  | 'tritone'
  | 'passing-dim'

export interface ProgressionStep {
  id: string
  kind: ProgressionStepKind
  /** Home-key or applied scale degree 1–7. */
  degree: number
  /** Roman numeral plus quality, e.g. `II-7` or `V7/V`. */
  roman: string
  /** Absolute symbol for the V-system workshop, e.g. `D-7`. */
  symbol: string
  /** Nested follow-ons (unused on the chips themselves). */
  children: ProgressionStep[]
}

export interface ProgressionFamily {
  id: string
  heading: string
  hint: string
  steps: ProgressionStep[]
}

const MODE_INTERVALS: Record<ModeId, readonly number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11],
  'harmonic-major': [0, 2, 4, 5, 7, 8, 11],
}

const MAJOR_MODES: readonly ModeId[] = [
  'ionian',
  'lydian',
  'mixolydian',
  'harmonic-major',
]
const MINOR_MODES: readonly ModeId[] = [
  'dorian',
  'phrygian',
  'aeolian',
  'harmonic-minor',
  'melodic-minor',
]

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const LETTER_PCS = [0, 2, 4, 5, 7, 9, 11]
const CHROMATIC_ROMAN = [
  'I',
  'bII',
  'II',
  'bIII',
  'III',
  'IV',
  '#IV',
  'V',
  'bVI',
  'VI',
  'bVII',
  'VII',
] as const

export function isModeId(value: unknown): value is ModeId {
  return MODE_OPTIONS.some((mode) => mode.id === value)
}

export function isKeyCenter(value: unknown): value is KeyCenter {
  return KEY_CENTERS.some((root) => root === value)
}

/** Diatonic seventh chords of `mode` in `keyRoot`, I through VII. */
export function diatonicSteps(
  keyRoot: string,
  mode: ModeId
): ProgressionStep[] {
  return scaleSevenths(keyRoot, mode, 'diatonic', 'diatonic')
}

/** Diatonic plus established non-diatonic families, duplicates removed. */
export function progressionFamilies(
  keyRoot: string,
  mode: ModeId
): ProgressionFamily[] {
  const parsed = parseNoteName(keyRoot)
  if (!parsed) return []

  const used = new Set<string>()
  const take = (steps: ProgressionStep[]) => {
    const kept: ProgressionStep[] = []
    for (const step of steps) {
      if (used.has(step.symbol)) continue
      used.add(step.symbol)
      kept.push(step)
    }
    return kept
  }

  const diatonic = take(diatonicSteps(keyRoot, mode))
  const families: ProgressionFamily[] = [
    {
      id: 'diatonic',
      heading: 'Diatonic',
      hint: 'Sevenths of the scale',
      steps: diatonic,
    },
  ]

  const secondaryV = take(secondaryDominants(mode, parsed))
  if (secondaryV.length > 0) {
    families.push({
      id: 'secondary-dominant',
      heading: 'Secondary V7',
      hint: 'Applied dominants',
      steps: secondaryV,
    })
  }

  const secondaryIi = take(secondarySupertonics(mode, parsed))
  if (secondaryIi.length > 0) {
    families.push({
      id: 'secondary-ii',
      heading: 'Secondary II-7',
      hint: 'ii of an applied key',
      steps: secondaryIi,
    })
  }

  const tritones = take(tritoneSubs(mode, parsed))
  if (tritones.length > 0) {
    families.push({
      id: 'tritone',
      heading: 'Tritone sub',
      hint: 'Dominant a half-step above the target',
      steps: tritones,
    })
  }

  const chromatic = take(chromaticSteps(parsed))
  if (chromatic.length > 0) {
    families.push({
      id: 'chromatic',
      heading: 'Chromatic',
      hint: 'bII, iv, bVI, bVII leftover after applied dominants',
      steps: chromatic,
    })
  }

  const borrowed = take(borrowedSteps(keyRoot, mode))
  if (borrowed.length > 0) {
    families.push({
      id: 'borrowed',
      heading: 'Borrowed',
      hint: 'Parallel major / minor',
      steps: borrowed,
    })
  }

  const dims = take(passingDiminished(parsed))
  if (dims.length > 0) {
    families.push({
      id: 'passing-dim',
      heading: 'Passing °7',
      hint: 'Chromatic diminished sevenths',
      steps: dims,
    })
  }

  return families
}

const TARGET_NAME = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const

/** Typical jazz use for a progression-builder chip (hover text). */
export function progressionStepHint(step: ProgressionStep): string {
  const target = TARGET_NAME[step.degree - 1] ?? 'I'
  switch (step.kind) {
    case 'diatonic':
      return diatonicUsage(step)
    case 'secondary-dominant':
      return step.degree === 1
        ? `${step.symbol} — V7 of the tonic. Resolves to I.`
        : `${step.symbol} — V7 of ${target}. Usually resolves to ${target} (often II-7/${target} → ${step.roman} → ${target}).`
    case 'secondary-ii':
      return step.degree === 1
        ? `${step.symbol} — ii of the tonic. Typically II-7 → V7 → I.`
        : `${step.symbol} — ii of ${target}. Typically ${step.roman} → V7/${target} → ${target}.`
    case 'tritone':
      return step.degree === 1
        ? `${step.symbol} — tritone sub for V7. Same destination as V7 (I), often a half-step above the tonic.`
        : `${step.symbol} — tritone sub for V7/${target}. Resolves to ${target} like the applied dominant it replaces.`
    case 'chromatic':
      return chromaticUsage(step)
    case 'borrowed':
      return `${step.symbol} — from the parallel mode. Mixes major/minor color without leaving the key center.`
    case 'passing-dim':
      return passingDimUsage(step)
  }
}

function diatonicUsage(step: ProgressionStep): string {
  switch (step.degree) {
    case 1:
      return `${step.symbol} — tonic. Home chord; progressions often start and cadence here.`
    case 2:
      return `${step.symbol} — supertonic / pre-dominant. Classic jazz move is II–V–I.`
    case 3:
      return `${step.symbol} — mediant. Tonic-area color; common in I–III–VI or III–VI–II–V.`
    case 4:
      return `${step.symbol} — subdominant. Plagal IV–I, or IV into V (or the dorian IV7 as a dominant).`
    case 5:
      return `${step.symbol} — dominant. Strong pull toward I; end of a II–V.`
    case 6:
      return `${step.symbol} — submediant. Relative minor in major; V–VI is the deceptive cadence.`
    case 7:
      return `${step.symbol} — leading-tone / VII. Often as ii of V, or a tense neighbor to I.`
    default:
      return `${step.symbol} — diatonic seventh of the mode.`
  }
}

function chromaticUsage(step: ProgressionStep): string {
  const roman = step.roman
  if (roman.startsWith('bIIΔ') || roman.startsWith('bII^')) {
    return `${step.symbol} — Neapolitan-major color. Lush bII that can slide toward V or I.`
  }
  if (roman.startsWith('bII7')) {
    return `${step.symbol} — bII7, often a tritone of V. Common as a direct approach to I.`
  }
  if (roman.startsWith('bIII')) {
    return `${step.symbol} — chromatic mediant. Parallel-major color on III; cinematic root motion.`
  }
  if (roman.startsWith('iv')) {
    return `${step.symbol} — borrowed minor iv. Plagal, hymn-like IV–I with a minor flavor.`
  }
  if (roman.startsWith('bVIIΔ') || roman.startsWith('bVII^')) {
    return `${step.symbol} — bVII major 7. Rock/modal mixture; often to I or as a IV of IV.`
  }
  if (roman.startsWith('bVII7')) {
    return `${step.symbol} — backdoor dominant. bVII7–I instead of V7–I.`
  }
  if (roman.startsWith('bVIΔ') || roman.startsWith('bVI^')) {
    return `${step.symbol} — bVI major 7. Modal mixture; often a warm neighbor to V or I.`
  }
  if (roman.startsWith('bVI7')) {
    return `${step.symbol} — bVI7. Mixolydian-flat-six / backdoor neighbor; can pull to V or I.`
  }
  return `${step.symbol} — chromatic mixture from outside the mode.`
}

function passingDimUsage(step: ProgressionStep): string {
  if (step.roman.startsWith('#IV')) {
    return `${step.symbol} — passing °7. Chromatic bass between IV and V (vii°7 of V).`
  }
  if (step.roman.startsWith('#II')) {
    return `${step.symbol} — passing °7. Chromatic bass between II and III.`
  }
  if (step.roman.startsWith('#I')) {
    return `${step.symbol} — passing °7. Chromatic bass between I and II (or a delayed tonic).`
  }
  return `${step.symbol} — passing diminished seventh; chromatic approach between diatonic chords.`
}

/**
 * Roman numeral for a chord in `keyRoot` / `mode`. Prefers progression-builder
 * names (V7/V over a generic II7). Unknown colors get a chromatic numeral.
 */
export function romanForChord(
  chordSymbol: string,
  keyRoot?: string | null,
  mode: ModeId = DEFAULT_MODE
): string | undefined {
  if (!keyRoot || !isKeyCenter(keyRoot)) return undefined
  const tonic = parseNoteName(keyRoot)
  const { chord } = tryParseChord(chordSymbol)
  if (!tonic || !chord) return undefined

  const suffix = chord.symbol.slice(chord.rootName.length)
  const tables = familyRomanTables(keyRoot, mode)
  const exact = tables.byHarmony.get(harmonyKey(chord))
  if (exact) return exact

  const sameRoot = tables.byRoot.get(chord.rootPc)
  if (sameRoot) return withChordSuffix(sameRoot.roman, sameRoot.suffix, suffix)

  const degree = MODE_INTERVALS[mode].findIndex(
    (step) => mod12(tonic.pc + step) === chord.rootPc
  )
  if (degree >= 0) return `${ROMAN[degree]}${suffix}`

  return modalRoman(mod12(chord.rootPc - tonic.pc), suffix)
}

/**
 * Corner-badge roman: keep function (III, V7/II) and drop long custom /
 * rootless clutter that would wrap over a diagram.
 */
export function romanBadge(roman: string): string {
  const core = roman.replace(/\(add[^)]*\)/g, '').replace(/-R$/, '')
  if (core.length <= 10) return core
  const match =
    /^(♭|♯|#|b)?(VII|VI|IV|III|II|I)(ø7|ø|°7|°|Δ7|Δ|\+7|\+|-7|-|13|11|9|7|6)?(\/(♭|♯|#|b)?(VII|VI|IV|III|II|I))?/.exec(
      core
    )
  return match?.[0] ?? core
}

function familyRomanTables(
  keyRoot: string,
  mode: ModeId
): {
  byHarmony: Map<string, string>
  byRoot: Map<number, { roman: string; suffix: string }>
} {
  const byHarmony = new Map<string, string>()
  const byRoot = new Map<number, { roman: string; suffix: string }>()
  for (const family of progressionFamilies(keyRoot, mode)) {
    for (const step of family.steps) {
      const parsed = tryParseChord(step.symbol).chord
      if (!parsed) continue
      const suffix = parsed.symbol.slice(parsed.rootName.length)
      const key = harmonyKey(parsed)
      if (!byHarmony.has(key)) byHarmony.set(key, step.roman)
      if (!byRoot.has(parsed.rootPc)) {
        byRoot.set(parsed.rootPc, { roman: step.roman, suffix })
      }
    }
  }
  return { byHarmony, byRoot }
}

function withChordSuffix(
  roman: string,
  familySuffix: string,
  suffix: string
): string {
  if (suffix === familySuffix) return roman
  if (familySuffix && roman.endsWith(familySuffix)) {
    return `${roman.slice(0, -familySuffix.length)}${suffix}`
  }
  return roman
}

function harmonyKey(chord: ParsedChord): string {
  return `${chord.rootPc}:${chord.symbol.slice(chord.rootName.length)}`
}

function scaleSevenths(
  keyRoot: string,
  mode: ModeId,
  kind: ProgressionStepKind,
  idPrefix: string
): ProgressionStep[] {
  const parsed = parseNoteName(keyRoot)
  if (!parsed) return []
  const tonicIndex = letterIndex(parsed.letter)
  if (tonicIndex < 0) return []
  const scalePcs = MODE_INTERVALS[mode].map((step) =>
    mod12(parsed.pc + step)
  )

  return ROMAN.map((numeral, degree) => {
    const chordPcs = [0, 2, 4, 6].map(
      (skip) => scalePcs[(degree + skip) % 7]
    )
    const rootPc = chordPcs[0]
    const suffix = suffixFromChordPcs(rootPc, chordPcs)
    const rootName = spellLetter((tonicIndex + degree) % 7, rootPc)
    const interval = mod12(rootPc - parsed.pc)
    const roman =
      kind === 'diatonic'
        ? `${numeral}${suffix}`
        : modalRoman(interval, suffix)
    return step({
      id: `${idPrefix}-${degree + 1}`,
      kind,
      degree: degree + 1,
      roman,
      symbol: `${rootName}${suffix}`,
    })
  })
}

function secondaryDominants(
  mode: ModeId,
  parsed: { pc: number; letter: string }
): ProgressionStep[] {
  const tonicIndex = letterIndex(parsed.letter)
  if (tonicIndex < 0) return []
  const scalePcs = MODE_INTERVALS[mode].map((step) =>
    mod12(parsed.pc + step)
  )
  const steps: ProgressionStep[] = []
  for (let degree = 0; degree < 7; degree++) {
    if (degree === 6) continue
    const targetPc = scalePcs[degree]
    const vPc = mod12(targetPc + 7)
    const rootName = spellLetter((tonicIndex + degree + 4) % 7, vPc)
    const roman = degree === 0 ? 'V7' : `V7/${ROMAN[degree]}`
    steps.push(
      step({
        id: `sec-v-${degree + 1}`,
        kind: 'secondary-dominant',
        degree: degree + 1,
        roman,
        symbol: `${rootName}7`,
      })
    )
  }
  return steps
}

function secondarySupertonics(
  mode: ModeId,
  parsed: { pc: number; letter: string }
): ProgressionStep[] {
  const tonicIndex = letterIndex(parsed.letter)
  if (tonicIndex < 0) return []
  const scalePcs = MODE_INTERVALS[mode].map((step) =>
    mod12(parsed.pc + step)
  )
  const steps: ProgressionStep[] = []
  for (let degree = 0; degree < 7; degree++) {
    if (degree === 6) continue
    const targetPc = scalePcs[degree]
    const iiPc = mod12(targetPc + 2)
    const rootName = spellLetter((tonicIndex + degree + 1) % 7, iiPc)
    const roman = degree === 0 ? 'II-7' : `II-7/${ROMAN[degree]}`
    steps.push(
      step({
        id: `sec-ii-${degree + 1}`,
        kind: 'secondary-ii',
        degree: degree + 1,
        roman,
        symbol: `${rootName}-7`,
      })
    )
  }
  return steps
}

function chromaticSteps(parsed: {
  pc: number
  letter: string
}): ProgressionStep[] {
  const tonicIndex = letterIndex(parsed.letter)
  if (tonicIndex < 0) return []
  const specs = [
    { roman: 'bIIΔ7', letterOff: 1, semitones: 1, suffix: 'Δ7', degree: 2 },
    { roman: 'bII7', letterOff: 1, semitones: 1, suffix: '7', degree: 2 },
    { roman: 'bIIIΔ7', letterOff: 2, semitones: 3, suffix: 'Δ7', degree: 3 },
    { roman: 'bIII7', letterOff: 2, semitones: 3, suffix: '7', degree: 3 },
    { roman: 'iv-7', letterOff: 3, semitones: 5, suffix: '-7', degree: 4 },
    { roman: 'bVIΔ7', letterOff: 5, semitones: 8, suffix: 'Δ7', degree: 6 },
    { roman: 'bVI7', letterOff: 5, semitones: 8, suffix: '7', degree: 6 },
    { roman: 'bVIIΔ7', letterOff: 6, semitones: 10, suffix: 'Δ7', degree: 7 },
    { roman: 'bVII7', letterOff: 6, semitones: 10, suffix: '7', degree: 7 },
  ] as const
  return specs.map((spec) => {
    const pc = mod12(parsed.pc + spec.semitones)
    const rootName = spellLetter((tonicIndex + spec.letterOff) % 7, pc)
    return step({
      id: `chromatic-${spec.roman}`,
      kind: 'chromatic',
      degree: spec.degree,
      roman: spec.roman,
      symbol: `${rootName}${spec.suffix}`,
    })
  })
}

function modalRoman(interval: number, suffix: string): string {
  const base = CHROMATIC_ROMAN[interval]
  const minorish =
    suffix.startsWith('-') || suffix.startsWith('ø') || suffix.startsWith('°')
  if (
    minorish &&
    (interval === 0 || interval === 2 || interval === 5 || interval === 7)
  ) {
    return `${base.toLowerCase()}${suffix}`
  }
  return `${base}${suffix}`
}

function borrowedSteps(keyRoot: string, mode: ModeId): ProgressionStep[] {
  const parallel = parallelMode(mode)
  if (!parallel) return []
  return scaleSevenths(keyRoot, parallel, 'borrowed', 'borrowed')
}

function tritoneSubs(
  mode: ModeId,
  parsed: { pc: number; letter: string }
): ProgressionStep[] {
  const tonicIndex = letterIndex(parsed.letter)
  if (tonicIndex < 0) return []
  const scalePcs = MODE_INTERVALS[mode].map((step) =>
    mod12(parsed.pc + step)
  )
  const steps: ProgressionStep[] = []
  for (let degree = 0; degree < 7; degree++) {
    if (degree === 6) continue
    const targetPc = scalePcs[degree]
    const subPc = mod12(targetPc + 1)
    const rootName = spellLetter((tonicIndex + degree + 1) % 7, subPc)
    const roman = degree === 0 ? 'subV7' : `subV7/${ROMAN[degree]}`
    steps.push(
      step({
        id: `tt-${degree + 1}`,
        kind: 'tritone',
        degree: degree + 1,
        roman,
        symbol: `${rootName}7`,
      })
    )
  }
  return steps
}

function passingDiminished(parsed: {
  pc: number
  letter: string
}): ProgressionStep[] {
  const tonicIndex = letterIndex(parsed.letter)
  if (tonicIndex < 0) return []
  const specs = [
    { id: 'sharp-1', roman: '#I°7', letter: tonicIndex, pc: mod12(parsed.pc + 1) },
    {
      id: 'sharp-2',
      roman: '#II°7',
      letter: (tonicIndex + 1) % 7,
      pc: mod12(parsed.pc + 3),
    },
    {
      id: 'sharp-4',
      roman: '#IV°7',
      letter: (tonicIndex + 3) % 7,
      pc: mod12(parsed.pc + 6),
    },
  ]
  return specs.map((spec) =>
    step({
      id: `dim-${spec.id}`,
      kind: 'passing-dim',
      degree: 1,
      roman: spec.roman,
      symbol: `${spellLetter(spec.letter, spec.pc)}°7`,
    })
  )
}

function parallelMode(mode: ModeId): ModeId | null {
  if (MAJOR_MODES.includes(mode)) return 'aeolian'
  if (MINOR_MODES.includes(mode)) return 'ionian'
  return null
}

function suffixFromChordPcs(rootPc: number, chordPcs: number[]): string {
  const semitones = [
    ...new Set(chordPcs.map((pc) => mod12(pc - rootPc))),
  ].sort((a, b) => a - b)
  return jazzSuffixFromSemitones(semitones) ?? '7'
}

function step(
  fields: Omit<ProgressionStep, 'children'>
): ProgressionStep {
  return { ...fields, children: [] }
}

function letterIndex(letter: string): number {
  return LETTERS.indexOf(letter.toUpperCase() as (typeof LETTERS)[number])
}

function spellLetter(index: number, pc: number): string {
  const letter = LETTERS[index]
  const natural = LETTER_PCS[index]
  let offset = mod12(pc - natural)
  if (offset > 6) offset -= 12
  const accidental =
    offset > 0 ? '#'.repeat(offset) : offset < 0 ? 'b'.repeat(-offset) : ''
  return `${letter}${accidental}`
}
