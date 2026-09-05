/**
 * Chord symbol parsing.
 *
 * Accepts jazz shorthand as well as the more verbose spellings, so all of
 * `E-7`, `Em7`, `Emin7` and `Emi7` mean the same thing, and `EΔ7`, `Eø7`,
 * `E°7` work as written.
 *
 * The V-System describes four-note, non-doubling voicings, so every parsed
 * chord is reduced (or extended) to exactly four distinct chord tones. Any
 * adjustment made along the way is reported so the UI can be honest about it.
 */

import { mod12, parseNoteName, spellDegree, type PitchClass } from './pitch'

/** How essential a tone is to the chord's identity, used when trimming to four. */
export type ToneRole =
  | 'root'
  | 'third'
  | 'fifth'
  | 'seventh'
  | 'extension'
  | 'alteration'

export interface ChordTone {
  /** Semitones above the root, 0-11. */
  semitones: number
  /** Degree label as musicians write it, e.g. `♭7`, `♯11`. */
  degree: string
  role: ToneRole
  pc: PitchClass
  /** Note name, spelled to suit the root. */
  name: string
}

export interface ParsedChord {
  /** The symbol exactly as the user typed it. */
  input: string
  /** Normalized display symbol, e.g. `E-7` -> `Em7`. */
  symbol: string
  rootName: string
  rootPc: PitchClass
  qualityLabel: string
  /** Exactly four distinct tones, ascending from the root. */
  tones: ChordTone[]
  /** All tones the symbol implies, before reducing to four. */
  allTones: ChordTone[]
  /** Human-readable notes about tones added or omitted to reach four. */
  adjustments: string[]
}

export class ChordParseError extends Error {}

/** Priority for keeping a tone when a chord has more than four notes. */
const ROLE_PRIORITY: Record<ToneRole, number> = {
  third: 100,
  seventh: 95,
  alteration: 90,
  extension: 60,
  root: 50,
  fifth: 20,
}

interface ToneSpec {
  semitones: number
  degree: string
  role: ToneRole
}

/** Normalizes the unicode and shorthand musicians actually type. */
function normalizeSymbol(raw: string): string {
  return raw
    .trim()
    .replace(/[♯]/g, '#')
    .replace(/[♭]/g, 'b')
    .replace(/[Δ∆]/g, '^')
    .replace(/[ø∅Ø]/g, '%')
    .replace(/[°º˚]/g, 'dim')
    .replace(/\s+/g, '')
}

interface QualityResult {
  tones: ToneSpec[]
  label: string
  /** Canonical suffix for the normalized display symbol. */
  suffix: string
}

const THIRD_MAJOR: ToneSpec = { semitones: 4, degree: '3', role: 'third' }
const THIRD_MINOR: ToneSpec = { semitones: 3, degree: '♭3', role: 'third' }
const FIFTH_PERFECT: ToneSpec = { semitones: 7, degree: '5', role: 'fifth' }
const FIFTH_DIM: ToneSpec = { semitones: 6, degree: '♭5', role: 'alteration' }
const FIFTH_AUG: ToneSpec = { semitones: 8, degree: '♯5', role: 'alteration' }
const SEVENTH_MAJ: ToneSpec = { semitones: 11, degree: '7', role: 'seventh' }
const SEVENTH_MIN: ToneSpec = { semitones: 10, degree: '♭7', role: 'seventh' }
const SEVENTH_DIM: ToneSpec = { semitones: 9, degree: '♭♭7', role: 'seventh' }
const SIXTH: ToneSpec = { semitones: 9, degree: '6', role: 'seventh' }

const NINTH: ToneSpec = { semitones: 2, degree: '9', role: 'extension' }
const ELEVENTH: ToneSpec = { semitones: 5, degree: '11', role: 'extension' }
const THIRTEENTH: ToneSpec = { semitones: 9, degree: '13', role: 'extension' }

/** One button per pitch class for the custom interval picker. */
export interface IntervalOption {
  semitones: number
  /** Stored in custom symbols, e.g. `b7`. */
  token: string
  /** Shown on the button. */
  label: string
  /** Longer hover text. */
  title: string
  role: ToneRole
  /** Display degree on diagrams, e.g. `♭7`. */
  degree: string
}

export const INTERVAL_OPTIONS: IntervalOption[] = [
  { semitones: 0, token: 'R', label: 'R', title: 'root', role: 'root', degree: 'R' },
  { semitones: 1, token: 'b9', label: '♭9', title: '♭2 / ♭9', role: 'alteration', degree: '♭9' },
  { semitones: 2, token: '9', label: '9', title: '2 / 9', role: 'extension', degree: '9' },
  { semitones: 3, token: 'b3', label: '♭3', title: '♭3 / ♯9', role: 'third', degree: '♭3' },
  { semitones: 4, token: '3', label: '3', title: 'major 3rd', role: 'third', degree: '3' },
  { semitones: 5, token: '4', label: '4', title: '4 / 11', role: 'third', degree: '4' },
  { semitones: 6, token: 'b5', label: '♭5', title: '♭5 / ♯11', role: 'alteration', degree: '♭5' },
  { semitones: 7, token: '5', label: '5', title: 'perfect 5th', role: 'fifth', degree: '5' },
  { semitones: 8, token: '#5', label: '♯5', title: '♯5 / ♭13', role: 'alteration', degree: '♯5' },
  { semitones: 9, token: '6', label: '6', title: '6 / 13', role: 'seventh', degree: '6' },
  { semitones: 10, token: 'b7', label: '♭7', title: 'minor 7th', role: 'seventh', degree: '♭7' },
  { semitones: 11, token: '7', label: '7', title: 'major 7th', role: 'seventh', degree: '7' },
]

const DEGREE_TOKENS: Record<string, Omit<IntervalOption, 'label' | 'title'>> = {
  r: INTERVAL_OPTIONS[0],
  '1': INTERVAL_OPTIONS[0],
  b2: INTERVAL_OPTIONS[1],
  b9: INTERVAL_OPTIONS[1],
  '2': INTERVAL_OPTIONS[2],
  '9': INTERVAL_OPTIONS[2],
  b3: INTERVAL_OPTIONS[3],
  '#9': INTERVAL_OPTIONS[3],
  '#2': INTERVAL_OPTIONS[3],
  '3': INTERVAL_OPTIONS[4],
  '4': INTERVAL_OPTIONS[5],
  '11': INTERVAL_OPTIONS[5],
  b5: INTERVAL_OPTIONS[6],
  '#4': INTERVAL_OPTIONS[6],
  '#11': INTERVAL_OPTIONS[6],
  '5': INTERVAL_OPTIONS[7],
  '#5': INTERVAL_OPTIONS[8],
  b6: INTERVAL_OPTIONS[8],
  b13: INTERVAL_OPTIONS[8],
  '6': INTERVAL_OPTIONS[9],
  '13': INTERVAL_OPTIONS[9],
  bb7: { semitones: 9, token: 'bb7', role: 'seventh', degree: '♭♭7' },
  b7: INTERVAL_OPTIONS[10],
  '7': INTERVAL_OPTIONS[11],
}

export function parseDegreeToken(raw: string): ToneSpec | null {
  const key = raw
    .trim()
    .replace(/[♯]/g, '#')
    .replace(/[♭]/g, 'b')
    .replace(/^Δ$/, '7')
    .toLowerCase()
  const option = DEGREE_TOKENS[key]
  if (!option) return null
  return { semitones: option.semitones, degree: option.degree, role: option.role }
}

export function formatCustomSymbol(rootName: string, tokens: string[]): string {
  return `${rootName}[${tokens.join(',')}]`
}

const ALTERATIONS: Record<string, ToneSpec> = {
  b5: FIFTH_DIM,
  '#5': FIFTH_AUG,
  b9: { semitones: 1, degree: '♭9', role: 'alteration' },
  '#9': { semitones: 3, degree: '♯9', role: 'alteration' },
  '#11': { semitones: 6, degree: '♯11', role: 'alteration' },
  b13: { semitones: 8, degree: '♭13', role: 'alteration' },
  '#13': { semitones: 10, degree: '♯13', role: 'alteration' },
  b11: { semitones: 4, degree: '♭11', role: 'alteration' },
}

/**
 * Reads the quality portion of a symbol (everything after the root) and
 * returns the tones it implies plus any trailing text still to be parsed.
 */
function parseQuality(rest: string): { quality: QualityResult; rest: string } {
  let s = rest

  const take = (token: string): boolean => {
    if (s.startsWith(token)) {
      s = s.slice(token.length)
      return true
    }
    return false
  }

  // Reads a trailing extension number and returns the implied tones.
  const extensionTones = (): { tones: ToneSpec[]; label: string } => {
    if (take('13')) return { tones: [NINTH, THIRTEENTH], label: '13' }
    if (take('11')) return { tones: [NINTH, ELEVENTH], label: '11' }
    if (take('9')) return { tones: [NINTH], label: '9' }
    if (take('7')) return { tones: [], label: '7' }
    return { tones: [], label: '' }
  }

  // --- Half-diminished -----------------------------------------------------
  if (take('%')) {
    take('7')
    return {
      quality: {
        tones: [THIRD_MINOR, FIFTH_DIM, SEVENTH_MIN],
        label: 'half-diminished 7th',
        suffix: 'm7♭5',
      },
      rest: s,
    }
  }

  // --- Diminished ----------------------------------------------------------
  if (take('dim') || take('o') || take('O')) {
    // dimMaj7 / °Δ7: diminished triad with a major seventh — one of Ted's 43.
    if (take('^') || take('maj') || take('Maj') || take('MAJ') || take('M')) {
      take('7')
      return {
        quality: {
          tones: [THIRD_MINOR, FIFTH_DIM, SEVENTH_MAJ],
          label: 'diminished major 7th',
          suffix: '°Maj7',
        },
        rest: s,
      }
    }
    if (take('7')) {
      return {
        quality: {
          tones: [THIRD_MINOR, FIFTH_DIM, SEVENTH_DIM],
          label: 'diminished 7th',
          suffix: '°7',
        },
        rest: s,
      }
    }
    return {
      quality: {
        tones: [THIRD_MINOR, FIFTH_DIM],
        label: 'diminished triad',
        suffix: '°',
      },
      rest: s,
    }
  }

  // --- Minor (including minor-major) --------------------------------------
  // Longer spellings first, so `mi7` isn't read as a bare `m` plus junk.
  // A lone `m` only means minor when it isn't the start of `maj`/`ma7`.
  const isMinor =
    take('-') ||
    take('min') ||
    take('mi') ||
    (/^m(?!aj|a\d|a$)/.test(s) && take('m'))

  if (isMinor) {
    // minor-major seventh: m^7, mMaj7, m#7
    if (take('^') || take('maj') || take('Maj') || take('MAJ') || take('#')) {
      const ext = extensionTones()
      return {
        quality: {
          tones: [THIRD_MINOR, FIFTH_PERFECT, SEVENTH_MAJ, ...ext.tones],
          label: 'minor-major 7th',
          suffix: `mMaj${ext.label || '7'}`,
        },
        rest: s,
      }
    }
    if (take('6')) {
      if (take('/9') || take('9')) {
        return {
          quality: {
            tones: [THIRD_MINOR, FIFTH_PERFECT, SIXTH, NINTH],
            label: 'minor six-nine',
            suffix: 'm6/9',
          },
          rest: s,
        }
      }
      return {
        quality: {
          tones: [THIRD_MINOR, FIFTH_PERFECT, SIXTH],
          label: 'minor 6th',
          suffix: 'm6',
        },
        rest: s,
      }
    }
    const ext = extensionTones()
    if (ext.label) {
      return {
        quality: {
          tones: [THIRD_MINOR, FIFTH_PERFECT, SEVENTH_MIN, ...ext.tones],
          label: `minor ${ext.label}th`,
          suffix: `m${ext.label}`,
        },
        rest: s,
      }
    }
    return {
      quality: {
        tones: [THIRD_MINOR, FIFTH_PERFECT],
        label: 'minor triad',
        suffix: 'm',
      },
      rest: s,
    }
  }

  // --- Augmented -----------------------------------------------------------
  if (take('aug') || take('+')) {
    const ext = extensionTones()
    if (ext.label) {
      return {
        quality: {
          tones: [THIRD_MAJOR, FIFTH_AUG, SEVENTH_MIN, ...ext.tones],
          label: `augmented ${ext.label}th`,
          suffix: `${ext.label}♯5`,
        },
        rest: s,
      }
    }
    return {
      quality: {
        tones: [THIRD_MAJOR, FIFTH_AUG],
        label: 'augmented triad',
        suffix: '+',
      },
      rest: s,
    }
  }

  // --- Major seventh family ------------------------------------------------
  if (take('^') || take('maj') || take('Maj') || take('MAJ') || take('ma')) {
    if (take('6')) {
      return {
        quality: {
          tones: [THIRD_MAJOR, FIFTH_PERFECT, SIXTH],
          label: 'major 6th',
          suffix: '6',
        },
        rest: s,
      }
    }
    const ext = extensionTones()
    return {
      quality: {
        tones: [THIRD_MAJOR, FIFTH_PERFECT, SEVENTH_MAJ, ...ext.tones],
        label: `major ${ext.label || '7'}th`,
        suffix: `Maj${ext.label || '7'}`,
      },
      rest: s,
    }
  }

  // Capital `M` followed by a number also means a major seventh (CM7).
  if (/^M\d/.test(s) && take('M')) {
    const ext = extensionTones()
    return {
      quality: {
        tones: [THIRD_MAJOR, FIFTH_PERFECT, SEVENTH_MAJ, ...ext.tones],
        label: `major ${ext.label || '7'}th`,
        suffix: `Maj${ext.label || '7'}`,
      },
      rest: s,
    }
  }

  // --- Suspended -----------------------------------------------------------
  if (/^\d*sus/.test(s)) {
    const seventhLabel = take('13')
      ? '13'
      : take('11')
        ? '11'
        : take('9')
          ? '9'
          : take('7')
            ? '7'
            : ''
    take('sus')
    const susTwo = take('2')
    if (!susTwo) take('4')
    const susTone: ToneSpec = susTwo
      ? { semitones: 2, degree: '2', role: 'third' }
      : { semitones: 5, degree: '4', role: 'third' }
    const tones = [susTone, FIFTH_PERFECT]
    if (seventhLabel) tones.push(SEVENTH_MIN)
    if (seventhLabel === '9' || seventhLabel === '11' || seventhLabel === '13') {
      tones.push(NINTH)
    }
    if (seventhLabel === '13') tones.push(THIRTEENTH)
    return {
      quality: {
        tones,
        label: susTwo ? 'suspended 2nd' : 'suspended 4th',
        suffix: `${seventhLabel}sus${susTwo ? '2' : '4'}`,
      },
      rest: s,
    }
  }

  // --- Sixth and six-nine --------------------------------------------------
  if (take('6/9') || take('69')) {
    return {
      quality: {
        tones: [THIRD_MAJOR, FIFTH_PERFECT, SIXTH, NINTH],
        label: 'six-nine',
        suffix: '6/9',
      },
      rest: s,
    }
  }
  if (take('6')) {
    return {
      quality: {
        tones: [THIRD_MAJOR, FIFTH_PERFECT, SIXTH],
        label: 'major 6th',
        suffix: '6',
      },
      rest: s,
    }
  }

  // --- Dominant ------------------------------------------------------------
  const ext = extensionTones()
  if (ext.label) {
    return {
      quality: {
        tones: [THIRD_MAJOR, FIFTH_PERFECT, SEVENTH_MIN, ...ext.tones],
        label: `dominant ${ext.label}th`,
        suffix: ext.label,
      },
      rest: s,
    }
  }

  // --- Bare triad ----------------------------------------------------------
  return {
    quality: {
      tones: [THIRD_MAJOR, FIFTH_PERFECT],
      label: 'major triad',
      suffix: '',
    },
    rest: s,
  }
}

/** Applies trailing alterations such as `b9`, `#11`, `alt`, `add9`, `no5`. */
function applyModifiers(
  tones: ToneSpec[],
  rest: string
): { tones: ToneSpec[]; suffix: string } {
  let s = rest
  let result = [...tones]
  let suffix = ''

  const removeSemitone = (semitones: number) => {
    result = result.filter((t) => t.semitones !== semitones)
  }

  while (s.length > 0) {
    // Strip decorative parens and separators.
    if (/^[()\s,/]/.test(s)) {
      s = s.slice(1)
      continue
    }

    if (s.startsWith('alt')) {
      s = s.slice(3)
      removeSemitone(FIFTH_PERFECT.semitones)
      result.push(ALTERATIONS['b9'], ALTERATIONS['#5'])
      suffix += 'alt'
      continue
    }

    const noMatch = /^no(\d+)/.exec(s)
    if (noMatch) {
      s = s.slice(noMatch[0].length)
      const degree = noMatch[1]
      if (degree === '5') removeSemitone(FIFTH_PERFECT.semitones)
      if (degree === '3') result = result.filter((t) => t.role !== 'third')
      if (degree === '1') removeSemitone(0)
      suffix += `no${degree}`
      continue
    }

    const addMatch = /^add([#b]?)(\d+)/.exec(s)
    if (addMatch) {
      s = s.slice(addMatch[0].length)
      const key = `${addMatch[1]}${addMatch[2]}`
      const spec =
        ALTERATIONS[key] ??
        (addMatch[2] === '9'
          ? NINTH
          : addMatch[2] === '11'
            ? ELEVENTH
            : addMatch[2] === '13'
              ? THIRTEENTH
              : null)
      if (spec) {
        result.push({ ...spec, role: 'extension' })
        suffix += `add${key}`
      }
      continue
    }

    const altMatch = /^([#b])(\d+)/.exec(s)
    if (altMatch) {
      s = s.slice(altMatch[0].length)
      const key = `${altMatch[1]}${altMatch[2]}`
      const spec = ALTERATIONS[key]
      if (spec) {
        // An altered 5th replaces the perfect 5th; altered 9ths/13ths replace
        // their natural counterparts.
        if (altMatch[2] === '5') removeSemitone(FIFTH_PERFECT.semitones)
        if (altMatch[2] === '9') removeSemitone(NINTH.semitones)
        if (altMatch[2] === '11') removeSemitone(ELEVENTH.semitones)
        if (altMatch[2] === '13') removeSemitone(THIRTEENTH.semitones)
        result.push(spec)
        suffix += key.replace('#', '♯').replace('b', '♭')
      }
      continue
    }

    // Unrecognized trailing text: stop rather than silently misreading it.
    throw new ChordParseError(`Don't understand "${s}" in the chord symbol`)
  }

  return { tones: result, suffix }
}

/**
 * Candidate tones for filling a chord out to the four voices the V-System
 * needs, best first.
 *
 * The list must always contain something usable — a chord with three or fewer
 * tones can never exhaust it — because anything shorter than four voices
 * cannot be voiced at all.
 */
function completingTones(
  tones: ToneSpec[]
): { spec: ToneSpec; why: string }[] {
  const has = (semitones: number) => tones.some((t) => t.semitones === semitones)

  // A 6th, ♭7 or 7 all occupy the chord's "seventh" voice.
  const hasSeventh =
    has(SIXTH.semitones) ||
    has(SEVENTH_MIN.semitones) ||
    has(SEVENTH_MAJ.semitones)

  const candidates: { spec: ToneSpec; why: string }[] = []

  const hasSus2 = tones.some((t) => t.degree === '2' || t.degree === '9')
  const hasSus4 = tones.some((t) => t.degree === '4' || t.degree === '11')

  // A triad's most natural fourth voice is the seventh that suits its third.
  // Suspended chords must not grow a 3rd — that would unsuspend them.
  if (!hasSeventh) {
    if (hasSus2 && !hasSus4) {
      candidates.push({
        spec: { semitones: 5, degree: '4', role: 'third' },
        why: 'added 4 to make sus2/4',
      })
    } else if (hasSus4 && !has(THIRD_MAJOR.semitones) && !has(THIRD_MINOR.semitones)) {
      candidates.push({
        spec: SEVENTH_MIN,
        why: 'added ♭7 to make a 7sus4',
      })
    } else if (has(FIFTH_DIM.semitones) && has(THIRD_MINOR.semitones)) {
      candidates.push({
        spec: SEVENTH_DIM,
        why: 'added ♭♭7 to make a diminished 7th',
      })
    } else if (has(THIRD_MINOR.semitones)) {
      candidates.push({
        spec: SEVENTH_MIN,
        why: 'added ♭7 to make a minor 7th',
      })
    } else if (has(FIFTH_AUG.semitones)) {
      candidates.push({ spec: SEVENTH_MIN, why: 'added ♭7 to make a 7♯5' })
    } else if (has(THIRD_MAJOR.semitones)) {
      candidates.push({
        spec: SIXTH,
        why: 'added the 6th to make a major 6th',
      })
    }
  }

  const fillOrder =
    hasSus2 || hasSus4
      ? [ELEVENTH, SIXTH, NINTH, SEVENTH_MIN, FIFTH_PERFECT, SEVENTH_MAJ]
      : [
          NINTH,
          FIFTH_PERFECT,
          THIRD_MAJOR,
          SIXTH,
          ELEVENTH,
          SEVENTH_MIN,
          SEVENTH_MAJ,
          THIRD_MINOR,
        ]

  for (const spec of fillOrder) {
    candidates.push({ spec, why: `added the ${spec.degree}` })
  }

  return candidates.filter((c) => !has(c.spec.semitones))
}

/**
 * Picks four tones that still read as the named quality on guitar.
 *
 * The root is never dropped — a rooted shape is what you grab on the neck.
 * After that: the third, then every alteration that fits (so 7♭9♯5 keeps both
 * colours), then the seventh, then the highest extension, then the fifth.
 */
function trimToFour(specs: ToneSpec[]): {
  kept: ToneSpec[]
  dropped: ToneSpec[]
} {
  let pool = [...specs]

  const degreeOf = (degree: string) => pool.find((t) => t.degree === degree)
  const dropDegree = (degree: string) => {
    pool = pool.filter((t) => t.degree !== degree)
  }

  if (degreeOf('13') && degreeOf('9')) dropDegree('9')
  if (degreeOf('13') && degreeOf('11')) dropDegree('11')
  if (degreeOf('11') && degreeOf('9')) dropDegree('9')

  if (pool.length > 4) {
    const take = (role: ToneRole) =>
      pool
        .filter((t) => t.role === role)
        .sort((a, b) => b.semitones - a.semitones)

    const ordered = [
      ...take('root'),
      ...take('third'),
      ...take('alteration'),
      ...take('seventh'),
      ...take('extension'),
      ...take('fifth'),
    ]
    const keep = new Set(ordered.slice(0, 4).map((t) => t.semitones))
    pool = pool.filter((t) => keep.has(t.semitones))
  }

  const keptSemitones = new Set(pool.map((t) => t.semitones))
  return {
    kept: specs.filter((t) => keptSemitones.has(t.semitones)),
    dropped: specs.filter((t) => !keptSemitones.has(t.semitones)),
  }
}

function parseCustomChord(
  input: string,
  rootName: string,
  rootLetter: string,
  rootPc: PitchClass,
  afterRoot: string
): ParsedChord {
  const close = afterRoot.indexOf(']')
  if (close < 0) {
    throw new ChordParseError('Custom intervals need a closing ]')
  }
  const leftover = afterRoot.slice(close + 1).trim()
  if (leftover) {
    throw new ChordParseError(`Don't understand "${leftover}" after the intervals`)
  }

  const tokens = afterRoot
    .slice(1, close)
    .split(/[,+\s]+/)
    .filter(Boolean)
  if (tokens.length === 0) {
    throw new ChordParseError('Pick four intervals')
  }

  const bySemitone = new Map<number, ToneSpec>()
  for (const token of tokens) {
    const spec = parseDegreeToken(token)
    if (!spec) throw new ChordParseError(`Unknown interval "${token}"`)
    if (!bySemitone.has(spec.semitones)) bySemitone.set(spec.semitones, spec)
  }

  if (bySemitone.size !== 4) {
    throw new ChordParseError(
      `Custom voicings need exactly four different intervals (you have ${bySemitone.size})`
    )
  }

  const specs = [...bySemitone.values()].sort((a, b) => a.semitones - b.semitones)
  const canonical = specs.map((spec) => {
    const option = INTERVAL_OPTIONS.find((o) => o.semitones === spec.semitones)
    return option?.token ?? spec.degree
  })

  const tones = specs.map((spec) => {
    const pc = mod12(rootPc + spec.semitones)
    return {
      semitones: spec.semitones,
      degree: spec.degree,
      role: spec.role,
      pc,
      name: spellDegree(rootLetter, spec.degree, pc),
    }
  })

  return {
    input,
    symbol: formatCustomSymbol(
      spellDegree(rootLetter, 'R', rootPc),
      canonical
    ),
    rootName,
    rootPc,
    qualityLabel: 'custom four-note',
    tones,
    allTones: tones,
    adjustments: [],
  }
}

/**
 * Parses a chord symbol into exactly four distinct chord tones.
 * Throws {@link ChordParseError} for symbols it cannot read.
 */
export function parseChord(input: string): ParsedChord {
  const trimmed = input.trim()
  if (!trimmed) throw new ChordParseError('Enter a chord symbol')

  const normalized = normalizeSymbol(trimmed)
  const rootMatch = /^([A-Ga-g][#b]*)/.exec(normalized)
  if (!rootMatch) {
    throw new ChordParseError(`"${trimmed}" doesn't start with a note name`)
  }

  const parsedRoot = parseNoteName(rootMatch[1])
  if (!parsedRoot) throw new ChordParseError(`Unknown root "${rootMatch[1]}"`)

  const rootName =
    parsedRoot.letter +
    (parsedRoot.accidental > 0
      ? '#'.repeat(parsedRoot.accidental)
      : 'b'.repeat(-parsedRoot.accidental))

  const afterRoot = normalized.slice(rootMatch[0].length)
  if (afterRoot.startsWith('[')) {
    return parseCustomChord(trimmed, rootName, parsedRoot.letter, parsedRoot.pc, afterRoot)
  }

  const { quality, rest } = parseQuality(afterRoot)
  const { tones: withMods, suffix: modSuffix } = applyModifiers(
    quality.tones,
    rest
  )

  const adjustments: string[] = []
  const root: ToneSpec = { semitones: 0, degree: 'R', role: 'root' }

  // Collapse duplicate semitones, keeping the more specific label.
  const bySemitone = new Map<number, ToneSpec>()
  for (const tone of [root, ...withMods]) {
    const existing = bySemitone.get(tone.semitones)
    if (!existing || ROLE_PRIORITY[tone.role] > ROLE_PRIORITY[existing.role]) {
      bySemitone.set(tone.semitones, tone)
    }
  }
  let specs = [...bySemitone.values()].sort((a, b) => a.semitones - b.semitones)

  // Bring the chord to exactly four distinct tones. Each pass adds a tone the
  // chord doesn't already have, so this always terminates.
  while (specs.length < 4) {
    const [next] = completingTones(specs)
    if (!next) break
    specs.push(next.spec)
    specs.sort((a, b) => a.semitones - b.semitones)
    adjustments.push(next.why)
  }

  const allSpecs = [...specs]

  if (specs.length > 4) {
    const { kept, dropped } = trimToFour(specs)
    specs = kept
    adjustments.push(
      `omitted ${dropped.map((t) => t.degree).join(' and ')} to keep four voices`
    )
  }

  if (specs.length !== 4) {
    throw new ChordParseError(
      `"${trimmed}" can't be made into a four-note voicing`
    )
  }

  const toChordTone = (spec: ToneSpec): ChordTone => {
    const pc = mod12(parsedRoot.pc + spec.semitones)
    return {
      semitones: spec.semitones,
      degree: spec.degree,
      role: spec.role,
      pc,
      name: spellDegree(parsedRoot.letter, spec.degree, pc),
    }
  }

  return {
    input: trimmed,
    symbol: `${spellDegree(parsedRoot.letter, 'R', parsedRoot.pc)}${quality.suffix}${modSuffix}`,
    rootName,
    rootPc: parsedRoot.pc,
    qualityLabel: quality.label,
    tones: specs.map(toChordTone),
    allTones: allSpecs.map(toChordTone),
    adjustments,
  }
}

/** Parses without throwing; returns null on failure. */
export function tryParseChord(
  input: string
): { chord: ParsedChord; error: null } | { chord: null; error: string } {
  try {
    return { chord: parseChord(input), error: null }
  } catch (err) {
    return {
      chord: null,
      error: err instanceof Error ? err.message : 'Could not read that chord',
    }
  }
}
