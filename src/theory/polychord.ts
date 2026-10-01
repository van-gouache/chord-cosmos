/**
 * Upper structures for a chord already in the sequence.
 *
 * Each suggestion is a chord that can sit on top of the current one:
 * diatonic neighbors, chords that keep three of the four notes, extensions
 * (9 / 11 / 13), and familiar substitutes such as a minor 7th against the
 * major 9th a major 3rd lower.
 */

import { tryParseChord, type ChordTone, type ParsedChord } from './chords'
import {
  DEFAULT_MODE,
  diatonicSteps,
  isKeyCenter,
  MODE_OPTIONS,
  romanForChord,
  type KeyCenter,
  type ModeId,
} from './diatonic'
import {
  jazzSuffixFromSemitones,
  triadSuffixFromSemitones,
} from './qualities'
import { mod12, parseNoteName, spellDegree, FLAT_NAMES, SHARP_NAMES } from './pitch'
import { triadTones } from './triads'

export type PolychordCategory =
  | 'diatonic'
  | 'common-tones'
  | 'extensions'
  | 'substitutes'

export type StackWorkshop = 'vsystem' | 'triads'

export interface PolychordStack {
  id: string
  category: PolychordCategory
  /** Canonical symbol to load in the voicing workshop. */
  symbol: string
  /** The sequencer chord this stack sits on. */
  lowerSymbol: string
  workshop: StackWorkshop
  qualityLabel: string
  reason: string
  sharedNames: string[]
  addedNames: string[]
  /** Degrees of the new notes, measured from the lower root (`9`, `♯11`). */
  addedDegrees: string[]
  /** Lower chord plus the upper structure, in a close voicing. */
  midiNotes: number[]
}

export interface PolychordFamily {
  id: PolychordCategory
  heading: string
  hint: string
  stacks: PolychordStack[]
}

export interface PolychordHarmony {
  keyRoot?: string | null
  mode?: ModeId | null
}

const DEGREE_LABELS = [
  'R',
  '♭9',
  '9',
  '♭3',
  '3',
  '11',
  '♯11',
  '5',
  '♭13',
  '13',
  '♭7',
  '7',
] as const

const INTERVAL_NAMES = [
  '',
  'minor 2nd',
  'major 2nd',
  'minor 3rd',
  'major 3rd',
  'perfect 4th',
  'tritone',
  'perfect 5th',
  'minor 6th',
  'major 6th',
  'minor 7th',
  'major 7th',
] as const

const BASIC_SUFFIXES = new Set([
  'Δ7',
  'Δ9',
  'Δ13',
  'Δ7♯11',
  '-7',
  '-9',
  '-6',
  '7',
  '9',
  '13',
  '6',
  '-6',
  'ø7',
  '6/9',
  'add9',
  '-add9',
])

const SKIP_COMMON_SUFFIXES = new Set([
  '7alt',
  '7♯9♯5',
  '7♭9♭5',
  '7♯9♭5',
  '7♭9♯5',
  '°7',
  '°Δ7',
  'sus2',
  'sus4',
  '7sus4♭9',
])

const FAMILY_ORDER: PolychordCategory[] = [
  'diatonic',
  'common-tones',
  'extensions',
  'substitutes',
]

const FAMILY_COPY: Record<
  PolychordCategory,
  { heading: string; hint: string }
> = {
  diatonic: {
    heading: 'Diatonic',
    hint: 'Chords of the key that already share notes with this one',
  },
  'common-tones': {
    heading: 'Common tones',
    hint: 'A different chord that keeps three of these four notes',
  },
  extensions: {
    heading: 'Extensions',
    hint: 'Upper structures that add a 9th, 11th, or 13th',
  },
  substitutes: {
    heading: 'Substitutes',
    hint: 'Familiar swaps that keep the notes doing the work',
  },
}

interface Analysis {
  sharedNames: string[]
  addedNames: string[]
  addedDegrees: string[]
  addedPcs: number[]
  setKey: string
  upperPcs: number[]
}

interface StackDraft {
  category: PolychordCategory
  symbol: string
  workshop: StackWorkshop
  qualityLabel: string
  reason: string
  analysis: Analysis
  score: number
}

interface Recipe {
  id: string
  match: (semitones: Set<number>) => boolean
  shift: number
  degree: string
  suffix: string
  workshop: StackWorkshop
  minShare: number
  reason: (lower: ParsedChord, upper: ParsedChord, info: Analysis) => string
}

export function polychordFamilies(
  chord: ParsedChord,
  harmony?: PolychordHarmony
): PolychordFamily[] {
  const usedSymbols = new Set<string>([chord.symbol])
  const usedSets = new Set<string>([setKey(chord.tones.map((tone) => tone.pc))])
  const buckets = new Map<PolychordCategory, StackDraft[]>()
  for (const id of FAMILY_ORDER) buckets.set(id, [])

  const claim = (draft: StackDraft | null) => {
    if (!draft) return
    if (usedSymbols.has(draft.symbol) || usedSets.has(draft.analysis.setKey)) return
    if (draft.analysis.setKey === setKey(chord.tones.map((tone) => tone.pc))) return
    usedSymbols.add(draft.symbol)
    usedSets.add(draft.analysis.setKey)
    buckets.get(draft.category)?.push(draft)
  }

  for (const recipe of SUBSTITUTE_RECIPES) {
    if (!recipe.match(semitoneSet(chord))) continue
    claim(draftFromRecipe(chord, recipe, 'substitutes'))
  }

  for (const recipe of EXTENSION_RECIPES) {
    if (!recipe.match(semitoneSet(chord))) continue
    const draft = draftFromRecipe(chord, recipe, 'extensions')
    if (!draft) continue
    if (draft.analysis.addedPcs.length === 0) continue
    if (addsElevenAgainstMajorThird(chord, draft.analysis.addedPcs)) continue
    claim(draft)
  }

  for (const draft of rankCommonTones(chord, usedSymbols, usedSets)) {
    claim(draft)
  }

  const scale = resolveScale(chord, harmony)
  if (scale) {
    for (const draft of diatonicDrafts(chord, scale)) {
      if ((buckets.get('diatonic')?.length ?? 0) >= 8) break
      claim(draft)
    }
  }

  return FAMILY_ORDER.flatMap((id) => {
    const stacks = (buckets.get(id) ?? []).map((draft) => toStack(chord, draft))
    if (stacks.length === 0) return []
    const copy = FAMILY_COPY[id]
    const hint =
      id === 'diatonic' && scale
        ? scale.keyed
          ? `Other chords in ${scale.root} ${scale.label} that share notes with this one`
          : `No group key yet — chords of ${scale.root} ${scale.label}, the scale this chord comes from`
        : copy.hint
    return [{ id, heading: copy.heading, hint, stacks }]
  })
}

function toStack(lower: ParsedChord, draft: StackDraft): PolychordStack {
  return {
    id: `${draft.category}:${draft.symbol}`,
    category: draft.category,
    symbol: draft.symbol,
    lowerSymbol: lower.symbol,
    workshop: draft.workshop,
    qualityLabel: draft.qualityLabel,
    reason: draft.reason,
    sharedNames: draft.analysis.sharedNames,
    addedNames: draft.analysis.addedNames,
    addedDegrees: draft.analysis.addedDegrees,
    midiNotes: closeMidi(lower.rootPc, [
      ...new Set([
        ...lower.tones.map((tone) => tone.pc),
        ...draft.analysis.upperPcs,
      ]),
    ]),
  }
}

const SUBSTITUTE_RECIPES: Recipe[] = [
  {
    id: 'm7-maj9-below',
    match: isMinorSeventh,
    shift: -4,
    degree: '6',
    suffix: 'Δ9',
    workshop: 'vsystem',
    minShare: 3,
    reason: (lower, upper, info) =>
      `${lower.symbol} shares three of its four notes (${listJoin(info.sharedNames)}) with ${upper.symbol}, a major 9th built a major 3rd lower.`,
  },
  {
    id: 'maj9-m7-above',
    match: isMajorNinth,
    shift: 4,
    degree: '3',
    suffix: '-7',
    workshop: 'vsystem',
    minShare: 3,
    reason: (lower, upper, info) =>
      `${upper.symbol} is a minor 7th built a major 3rd higher. It shares three of ${lower.symbol}'s four notes (${listJoin(info.sharedNames)}).`,
  },
  {
    id: 'm7-relative-major',
    match: isMinorSeventh,
    shift: 3,
    degree: '♭3',
    suffix: 'Δ7',
    workshop: 'vsystem',
    minShare: 3,
    reason: (lower, upper, info) =>
      `${upper.symbol} is the relative major, a major 7th a minor 3rd higher. It shares three of ${lower.symbol}'s four notes (${listJoin(info.sharedNames)}).`,
  },
  {
    id: 'maj7-relative-minor',
    match: isMajorSeventh,
    shift: -3,
    degree: '6',
    suffix: '-7',
    workshop: 'vsystem',
    minShare: 3,
    reason: (lower, upper, info) =>
      `${upper.symbol} is the relative minor, a minor 7th a minor 3rd lower. It shares three of ${lower.symbol}'s four notes (${listJoin(info.sharedNames)}).`,
  },
  {
    id: 'tritone',
    match: isDominant,
    shift: 6,
    degree: '♭5',
    suffix: '7',
    workshop: 'vsystem',
    minShare: 2,
    reason: (lower, upper, info) =>
      `${upper.symbol} is the tritone substitute for ${lower.symbol}. ${guideTones(lower, info.sharedNames)}.`,
  },
  {
    id: 'ii-to-v',
    match: isMinorSeventh,
    shift: 5,
    degree: '4',
    suffix: '7',
    workshop: 'vsystem',
    minShare: 2,
    reason: (lower, upper, info) =>
      `${upper.symbol} is the dominant a perfect 4th higher — the V7 that usually follows ${lower.symbol}. They share ${listJoin(info.sharedNames)}.`,
  },
  {
    id: 'v-to-ii',
    match: isDominant,
    shift: -5,
    degree: '5',
    suffix: '-7',
    workshop: 'vsystem',
    minShare: 2,
    reason: (lower, upper, info) =>
      `${upper.symbol} is the ii-7 a perfect 4th lower, the chord that usually sets up ${lower.symbol}. They share ${listJoin(info.sharedNames)}.`,
  },
  {
    id: 'half-dim-to-v',
    match: isHalfDiminished,
    shift: 5,
    degree: '4',
    suffix: '7',
    workshop: 'vsystem',
    minShare: 2,
    reason: (lower, upper, info) =>
      `${upper.symbol} is the dominant a perfect 4th higher, the V7 ${lower.symbol} usually moves to. They share ${listJoin(info.sharedNames)}.`,
  },
  {
    id: 'mediant-up',
    match: isMajorSeventh,
    shift: 4,
    degree: '3',
    suffix: 'Δ7',
    workshop: 'vsystem',
    minShare: 2,
    reason: (lower, upper, info) =>
      `${upper.symbol} is a chromatic mediant of ${lower.symbol} — a major 7th a major 3rd higher that keeps ${listJoin(info.sharedNames)}.`,
  },
  {
    id: 'mediant-down',
    match: isMajorSeventh,
    shift: -4,
    degree: '♭6',
    suffix: 'Δ7',
    workshop: 'vsystem',
    minShare: 2,
    reason: (lower, upper, info) =>
      `${upper.symbol} is a chromatic mediant of ${lower.symbol} — a major 7th a major 3rd lower that keeps ${listJoin(info.sharedNames)}.`,
  },
]

const EXTENSION_RECIPES: Recipe[] = [
  {
    id: 'min-triad-5',
    match: (semis) => isMinorSeventh(semis) || isMinMaj(semis),
    shift: 7,
    degree: '5',
    suffix: '-',
    workshop: 'triads',
    minShare: 1,
    reason: (lower, _upper, info) =>
      extensionReason('Minor triad on the 5th', lower, info),
  },
  {
    id: 'maj-triad-b7',
    match: (semis) => isMinorSeventh(semis) || isHalfDiminished(semis),
    shift: 10,
    degree: '♭7',
    suffix: '',
    workshop: 'triads',
    minShare: 1,
    reason: (lower, _upper, info) =>
      extensionReason('Major triad on the ♭7', lower, info),
  },
  {
    id: 'min-triad-9',
    match: isMinorSeventh,
    shift: 2,
    degree: '9',
    suffix: '-',
    workshop: 'triads',
    minShare: 0,
    reason: (lower, _upper, info) =>
      extensionReason('Minor triad on the 9th', lower, info),
  },
  {
    id: 'min7-on-5',
    match: isMinorSeventh,
    shift: 7,
    degree: '5',
    suffix: '-7',
    workshop: 'vsystem',
    minShare: 1,
    reason: (lower, _upper, info) =>
      extensionReason('Minor 7th on the 5th', lower, info),
  },
  {
    id: 'half-min7-on-b3',
    match: isHalfDiminished,
    shift: 3,
    degree: '♭3',
    suffix: '-7',
    workshop: 'vsystem',
    minShare: 2,
    reason: (lower, _upper, info) =>
      extensionReason('Minor 7th on the ♭3', lower, info),
  },
  {
    id: 'maj-triad-5',
    match: isMajorish,
    shift: 7,
    degree: '5',
    suffix: '',
    workshop: 'triads',
    minShare: 1,
    reason: (lower, _upper, info) =>
      extensionReason('Major triad on the 5th', lower, info),
  },
  {
    id: 'dom-min-triad-5',
    match: isDominant,
    shift: 7,
    degree: '5',
    suffix: '-',
    workshop: 'triads',
    minShare: 1,
    reason: (lower, _upper, info) =>
      extensionReason('Minor triad on the 5th', lower, info),
  },
  {
    id: 'min-triad-6',
    match: isMajorish,
    shift: 9,
    degree: '6',
    suffix: '-',
    workshop: 'triads',
    minShare: 1,
    reason: (lower, _upper, info) =>
      extensionReason('Minor triad on the 6th', lower, info),
  },
  {
    id: 'min7-on-3',
    match: isMajorish,
    shift: 4,
    degree: '3',
    suffix: '-7',
    workshop: 'vsystem',
    minShare: 2,
    reason: (lower, _upper, info) =>
      extensionReason('Minor 7th on the 3rd', lower, info),
  },
  {
    id: 'lydian-triad-9',
    match: (semis) => isMajorish(semis) || isDominant(semis),
    shift: 2,
    degree: '9',
    suffix: '',
    workshop: 'triads',
    minShare: 0,
    reason: (lower, _upper, info) =>
      extensionReason('Major triad on the 9th', lower, info),
  },
  {
    id: 'lydian-triad-7',
    match: isMajorish,
    shift: 11,
    degree: '7',
    suffix: '-',
    workshop: 'triads',
    minShare: 1,
    reason: (lower, _upper, info) =>
      extensionReason('Minor triad on the 7th', lower, info),
  },
  {
    id: 'altered-triad-tritone',
    match: isDominant,
    shift: 6,
    degree: '♭5',
    suffix: '',
    workshop: 'triads',
    minShare: 1,
    reason: (lower, _upper, info) =>
      extensionReason('Major triad a tritone higher', lower, info),
  },
  {
    id: 'ust-13',
    match: isDominant,
    shift: 9,
    degree: '13',
    suffix: '',
    workshop: 'triads',
    minShare: 1,
    reason: (lower, _upper, info) =>
      extensionReason('Major triad on the 13th', lower, info),
  },
  {
    id: 'ust-b13',
    match: isDominant,
    shift: 8,
    degree: '♭13',
    suffix: '',
    workshop: 'triads',
    minShare: 1,
    reason: (lower, _upper, info) =>
      extensionReason('Major triad on the ♭13', lower, info),
  },
]

function draftFromRecipe(
  lower: ParsedChord,
  recipe: Recipe,
  category: PolychordCategory
): StackDraft | null {
  const rootPc = mod12(lower.rootPc + recipe.shift)
  const root = spellFrom(lower, rootPc, recipe.degree)
  if (!root) return null
  const upper = parsedSymbol(root, recipe.suffix)
  if (!upper || upper.rootPc !== rootPc) return null
  if (upper.symbol === lower.symbol) return null
  const analysis = analyze(lower, upper, recipe.workshop)
  if (analysis.sharedNames.length < recipe.minShare) return null
  return {
    category,
    symbol: upper.symbol,
    workshop: recipe.workshop,
    qualityLabel: qualityLabel(upper, recipe.workshop),
    reason: recipe.reason(lower, upper, analysis),
    analysis,
    score: 0,
  }
}

function rankCommonTones(
  lower: ParsedChord,
  usedSymbols: Set<string>,
  usedSets: Set<string>
): StackDraft[] {
  const pcs = lower.tones.map((tone) => tone.pc)
  const drafts: StackDraft[] = []
  const seen = new Set<string>()

  for (let drop = 0; drop < pcs.length; drop++) {
    const kept = pcs.filter((_, index) => index !== drop)
    for (let added = 0; added < 12; added++) {
      if (pcs.includes(added)) continue
      const next = [...kept, added]
      for (const rootPc of next) {
        const semitones = next.map((pc) => mod12(pc - rootPc)).sort((a, b) => a - b)
        const suffix = jazzSuffixFromSemitones(semitones)
        if (!suffix || SKIP_COMMON_SUFFIXES.has(suffix)) continue
        if (semitones.length !== 4) continue
        const root = spellPcFrom(lower, rootPc)
        if (!root) continue
        const upper = parsedSymbol(root, suffix)
        if (!upper || upper.rootPc !== rootPc) continue
        const sounding = upper.tones.map((tone) => tone.pc)
        if (setKey(sounding) !== setKey(next)) continue
        if (upper.symbol === lower.symbol) continue
        if (usedSymbols.has(upper.symbol) || seen.has(upper.symbol)) continue
        const analysis = analyze(lower, upper, 'vsystem')
        if (analysis.sharedNames.length !== 3) continue
        if (usedSets.has(analysis.setKey) || seen.has(analysis.setKey)) continue
        seen.add(upper.symbol)
        seen.add(analysis.setKey)
        const dropped = lower.tones[drop]
        drafts.push({
          category: 'common-tones',
          symbol: upper.symbol,
          workshop: 'vsystem',
          qualityLabel: upper.qualityLabel,
          reason: commonToneReason(lower, upper, analysis),
          analysis,
          score: commonToneScore(lower, upper, dropped, analysis, suffix),
        })
      }
    }
  }

  drafts.sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
  return drafts.slice(0, 6)
}

function commonToneReason(
  lower: ParsedChord,
  upper: ParsedChord,
  info: Analysis
): string {
  const added = info.addedNames[0]
  const degree = info.addedDegrees[0]
  const built = builtPhrase(lower.rootPc, upper.rootPc)
  const fresh = added && degree ? ` The new note is ${added}, the ${degree} of ${lower.rootName}.` : ''
  return `${upper.symbol} shares three of ${lower.symbol}'s four notes (${listJoin(info.sharedNames)}). It's ${article(upper.qualityLabel)} ${upper.qualityLabel} built ${built}.${fresh}`
}

function commonToneScore(
  lower: ParsedChord,
  upper: ParsedChord,
  dropped: ChordTone | undefined,
  info: Analysis,
  suffix: string
): number {
  let score = 0
  if (BASIC_SUFFIXES.has(suffix)) score += 20
  if (dropped && (dropped.semitones === 7 || dropped.role === 'fifth')) score += 12
  const degree = info.addedDegrees[0]
  if (degree && ['9', '♭9', '11', '♯11', '13', '♭13'].includes(degree)) score += 10
  const up = mod12(upper.rootPc - lower.rootPc)
  if ([3, 4, 8, 9].includes(up)) score += 10
  if ([7, 10].includes(up)) score += 6
  return score
}

interface ScaleContext {
  root: KeyCenter
  mode: ModeId
  label: string
  keyed: boolean
}

function resolveScale(
  chord: ParsedChord,
  harmony?: PolychordHarmony
): ScaleContext | null {
  const requested = harmony?.keyRoot
  if (requested && isKeyCenter(requested)) {
    const mode = harmony?.mode && isMode(harmony.mode) ? harmony.mode : DEFAULT_MODE
    return {
      root: requested,
      mode,
      label: modeLabel(mode),
      keyed: true,
    }
  }
  const root = keyCenterForPc(chord.rootPc, chord.rootName)
  if (!root) return null
  const mode = parentMode(semitoneSet(chord))
  return { root, mode, label: modeLabel(mode), keyed: false }
}

function diatonicDrafts(lower: ParsedChord, scale: ScaleContext): StackDraft[] {
  const drafts: StackDraft[] = []
  for (const step of diatonicSteps(scale.root, scale.mode)) {
    const seventh = tryParseChord(step.symbol).chord
    if (seventh) {
      const draft = diatonicDraft(lower, seventh, 'vsystem', scale)
      if (draft) drafts.push(draft)
    }
    const triadSymbol = triadSymbolFromSeventh(step.symbol)
    if (!triadSymbol) continue
    const triad = tryParseChord(triadSymbol).chord
    if (!triad) continue
    const draft = diatonicDraft(lower, triad, 'triads', scale)
    if (draft) drafts.push(draft)
  }
  drafts.sort(
    (a, b) =>
      b.analysis.sharedNames.length - a.analysis.sharedNames.length ||
      b.score - a.score ||
      a.symbol.localeCompare(b.symbol)
  )
  return drafts
}

function diatonicDraft(
  lower: ParsedChord,
  upper: ParsedChord,
  workshop: StackWorkshop,
  scale: ScaleContext
): StackDraft | null {
  if (upper.rootPc === lower.rootPc) return null
  const analysis = analyze(lower, upper, workshop)
  if (analysis.sharedNames.length < 2) return null
  const roman = romanForChord(upper.symbol, scale.root, scale.mode)
  const share =
    analysis.addedNames.length === 0
      ? `Uses ${listJoin(analysis.sharedNames)}, already in ${lower.symbol}`
      : `Shares ${listJoin(analysis.sharedNames)} and adds ${listJoin(
          analysis.addedDegrees.map((degree, index) => {
            const name = analysis.addedNames[index]
            return name ? `${name} (${degree})` : degree
          })
        )}`
  const where = roman ? `${roman} · ${upper.symbol}` : upper.symbol
  return {
    category: 'diatonic',
    symbol: upper.symbol,
    workshop,
    qualityLabel: qualityLabel(upper, workshop),
    reason: `${where} in ${scale.root} ${scale.label}. ${share}.`,
    analysis,
    score: analysis.sharedNames.length * 10 + (workshop === 'triads' ? 1 : 0),
  }
}

function triadSymbolFromSeventh(symbol: string): string | null {
  const chord = tryParseChord(symbol).chord
  if (!chord) return null
  const tones = triadTones(chord)
  if (!tones) return null
  const suffix = triadSuffixFromSemitones(tones.map((tone) => tone.semitones))
  if (suffix === null) return null
  return `${chord.rootName}${suffix}`
}

function analyze(
  lower: ParsedChord,
  upper: ParsedChord,
  workshop: StackWorkshop
): Analysis {
  const upperTones = soundingTones(upper, workshop)
  const upperPcs = upperTones.map((tone) => tone.pc)
  const upperSet = new Set(upperPcs)
  const lowerSet = new Set(lower.tones.map((tone) => tone.pc))
  const sharedNames = lower.tones
    .filter((tone) => upperSet.has(tone.pc))
    .map((tone) => tone.name)
  const added = upperTones.filter((tone) => !lowerSet.has(tone.pc))
  return {
    sharedNames,
    addedNames: added.map((tone) => tone.name),
    addedDegrees: added.map((tone) => DEGREE_LABELS[mod12(tone.pc - lower.rootPc)]),
    addedPcs: added.map((tone) => tone.pc),
    setKey: setKey(upperPcs),
    upperPcs,
  }
}

function soundingTones(chord: ParsedChord, workshop: StackWorkshop): ChordTone[] {
  if (workshop === 'triads') return triadTones(chord) ?? chord.tones
  return chord.tones
}

function extensionReason(role: string, lower: ParsedChord, info: Analysis): string {
  const share = info.sharedNames.length
    ? `Shares ${listJoin(info.sharedNames)}`
    : `Sits above ${lower.symbol}`
  const adds = info.addedDegrees.length
    ? `${info.sharedNames.length ? ', and adds' : '. Adds'} ${listJoin(
        info.addedDegrees.map((degree, index) => {
          const name = info.addedNames[index]
          return name ? `${name} (${degree})` : degree
        })
      )}`
    : ''
  return `${role} of ${lower.symbol}. ${share}${adds}.`
}

function guideTones(lower: ParsedChord, sharedNames: string[]): string {
  const third = lower.tones.find((tone) => tone.semitones === 4)
  const seventh = lower.tones.find((tone) => tone.semitones === 10)
  if (
    third &&
    seventh &&
    sharedNames.includes(third.name) &&
    sharedNames.includes(seventh.name)
  ) {
    return `The 3rd and ♭7 stay put (${third.name} and ${seventh.name})`
  }
  return `They share ${listJoin(sharedNames)}`
}

function builtPhrase(fromPc: number, toPc: number): string {
  const up = mod12(toPc - fromPc)
  if (up === 0) return 'on the same root'
  if (up === 6) return 'a tritone away'
  if (up < 6) return `a ${INTERVAL_NAMES[up]} higher`
  return `a ${INTERVAL_NAMES[12 - up]} lower`
}

function addsElevenAgainstMajorThird(lower: ParsedChord, addedPcs: number[]): boolean {
  if (!lower.tones.some((tone) => tone.semitones === 4)) return false
  const eleven = mod12(lower.rootPc + 5)
  const have = new Set(lower.tones.map((tone) => tone.pc))
  return addedPcs.some((pc) => pc === eleven && !have.has(pc))
}

function qualityLabel(chord: ParsedChord, workshop: StackWorkshop): string {
  if (workshop === 'triads') {
    const tones = triadTones(chord)
    const suffix = tones
      ? triadSuffixFromSemitones(tones.map((tone) => tone.semitones))
      : null
    if (suffix !== null) {
      return (
        {
          '': 'major triad',
          '-': 'minor triad',
          '+': 'augmented triad',
          '°': 'diminished triad',
          sus2: 'suspended 2nd',
          sus4: 'suspended 4th',
        } as Record<string, string>
      )[suffix] ?? chord.qualityLabel
    }
  }
  return chord.qualityLabel
}

function parsedSymbol(root: string, suffix: string): ParsedChord | null {
  return tryParseChord(`${root}${suffix}`).chord
}

function spellPcFrom(lower: ParsedChord, pc: number): string | null {
  const distance = mod12(pc - lower.rootPc)
  const spelled = spellFrom(lower, pc, DEGREE_LABELS[distance])
  if (spelled) return spelled
  if (distance === 6) return spellFrom(lower, pc, '♭5')
  return null
}

function spellFrom(lower: ParsedChord, pc: number, degree: string): string | null {
  const parsed = parseNoteName(lower.rootName)
  if (!parsed) return null
  const ascii = spellDegree(parsed.letter, degree, pc)
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
  const check = parseNoteName(ascii)
  if (!check || check.pc !== mod12(pc)) return null
  return ascii
}

function closeMidi(rootPc: number, pcs: number[]): number[] {
  const bass = 48 + mod12(rootPc)
  return [...pcs]
    .sort((a, b) => mod12(a - rootPc) - mod12(b - rootPc))
    .map((pc) => bass + mod12(pc - rootPc))
}

function semitoneSet(chord: ParsedChord): Set<number> {
  return new Set(chord.tones.map((tone) => tone.semitones))
}

function setKey(pcs: number[]): string {
  return [...new Set(pcs)].sort((a, b) => a - b).join(',')
}

function isMinorSeventh(semis: Set<number>): boolean {
  return semis.has(3) && semis.has(10) && !semis.has(4) && !semis.has(6)
}

function isMajorSeventh(semis: Set<number>): boolean {
  return semis.has(0) && semis.has(4) && semis.has(7) && semis.has(11) && !semis.has(2)
}

function isMajorNinth(semis: Set<number>): boolean {
  return semis.has(0) && semis.has(2) && semis.has(4) && semis.has(11) && !semis.has(7)
}

function isMajorish(semis: Set<number>): boolean {
  return semis.has(4) && semis.has(11) && !semis.has(10)
}

function isDominant(semis: Set<number>): boolean {
  return semis.has(4) && semis.has(10)
}

function isHalfDiminished(semis: Set<number>): boolean {
  return semis.has(3) && semis.has(6) && semis.has(10) && !semis.has(4)
}

function isMinMaj(semis: Set<number>): boolean {
  return semis.has(3) && semis.has(7) && semis.has(11) && !semis.has(4)
}

function parentMode(semis: Set<number>): ModeId {
  if (isHalfDiminished(semis)) return 'locrian'
  if (isMinMaj(semis)) return 'melodic-minor'
  if (isMinorSeventh(semis)) return 'dorian'
  if (isDominant(semis)) return 'mixolydian'
  return 'ionian'
}

function modeLabel(mode: ModeId): string {
  return MODE_OPTIONS.find((option) => option.id === mode)?.label ?? mode
}

function isMode(value: ModeId): boolean {
  return MODE_OPTIONS.some((option) => option.id === value)
}

function keyCenterForPc(pc: number, prefer?: string): KeyCenter | null {
  if (prefer && isKeyCenter(prefer)) return prefer
  const flat = FLAT_NAMES[mod12(pc)]
  if (isKeyCenter(flat)) return flat
  const sharp = SHARP_NAMES[mod12(pc)]
  if (isKeyCenter(sharp)) return sharp
  return null
}

function article(label: string): string {
  return /^[aeiou]/i.test(label) ? 'an' : 'a'
}

function listJoin(items: string[]): string {
  const names = items.filter(Boolean)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}
