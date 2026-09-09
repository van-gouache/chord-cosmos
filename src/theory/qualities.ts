/**
 * Named four-note qualities offered as chips.
 *
 * Every suffix here must parse to four distinct pitch classes. Homonyms
 * (C6 / Am7) stay as separate chips because they function differently.
 */

export interface QualityChip {
  label: string
  /** Appended to the root when the chip is clicked. */
  suffix: string
  title: string
}

export interface QualityGroup {
  heading: string
  chips: QualityChip[]
}

export const QUALITY_GROUPS: QualityGroup[] = [
  {
    heading: 'Dominant',
    chips: [
      { label: '7', suffix: '7', title: 'dominant 7th — R 3 5 ♭7' },
      { label: '9', suffix: '9', title: 'dominant 9th — R 3 ♭7 9' },
      { label: '11', suffix: '11', title: 'dominant 11th — R 3 ♭7 11' },
      { label: '13', suffix: '13', title: 'dominant 13th — R 3 ♭7 13' },
      { label: 'sus2', suffix: 'sus2', title: 'suspended 2nd — completed as R 2 4 5' },
      { label: 'sus4', suffix: 'sus4', title: 'suspended 4th — completed as 7sus4' },
      { label: '7sus2', suffix: '7sus2', title: 'R 2 5 ♭7' },
      { label: '7sus4', suffix: '7sus4', title: 'R 4 5 ♭7' },
      { label: '9sus4', suffix: '9sus4', title: 'R 4 ♭7 9' },
      { label: '7sus♭9', suffix: '7sus4♭9', title: 'Phrygian — R 4 ♭7 ♭9' },
      { label: '7♭5', suffix: '7♭5', title: 'R 3 ♭5 ♭7' },
      { label: '7♭9', suffix: '7♭9', title: 'R 3 ♭7 ♭9' },
      { label: '7♯9', suffix: '7♯9', title: 'Hendrix — R 3 ♭7 ♯9' },
      { label: '7♯11', suffix: '7♯11', title: 'R 3 ♭7 ♯11' },
      { label: '7♭13', suffix: '7♭13', title: 'R 3 ♭7 ♭13' },
      { label: '7alt', suffix: '7alt', title: 'altered — R 3 ♭9 ♯5' },
      { label: '9♯11', suffix: '9♯11', title: 'R 3 ♭7 ♯11' },
      { label: '13♭9', suffix: '13♭9', title: 'R 3 13 ♭9' },
      { label: '13♯11', suffix: '13♯11', title: 'R 3 13 ♯11' },
      { label: '7♭9♭5', suffix: '7♭9♭5', title: 'R 3 ♭9 ♭5' },
      { label: '7♭9♯5', suffix: '7♭9♯5', title: 'R 3 ♭9 ♯5' },
      { label: '7♯9♭5', suffix: '7♯9♭5', title: 'R 3 ♯9 ♭5' },
      { label: '7♯9♯5', suffix: '7♯9♯5', title: 'R 3 ♯9 ♯5' },
      { label: '7♭9♯11', suffix: '7♭9♯11', title: 'R 3 ♭9 ♯11' },
      { label: '7♯9♯11', suffix: '7♯9♯11', title: 'R 3 ♯9 ♯11' },
    ],
  },
  {
    heading: 'Minor',
    chips: [
      { label: '-', suffix: '-', title: 'minor triad — completed as a minor 7th' },
      { label: '-7', suffix: '-7', title: 'minor 7th — R ♭3 5 ♭7' },
      { label: '-6', suffix: '-6', title: 'minor 6th — R ♭3 5 6' },
      { label: '-Δ7', suffix: '-Δ7', title: 'minor-major 7th — R ♭3 5 7' },
      { label: '-6/9', suffix: '-6/9', title: 'minor six-nine — R ♭3 6 9' },
      { label: '-9', suffix: '-9', title: 'minor 9th — R ♭3 ♭7 9' },
      { label: '-11', suffix: '-11', title: 'minor 11th — R ♭3 ♭7 11' },
      { label: '-13', suffix: '-13', title: 'minor 13th — R ♭3 ♭7 13' },
      { label: '-add9', suffix: '-add9', title: 'minor add 9 — R ♭3 5 9' },
      { label: '-7♯5', suffix: '-7♯5', title: 'R ♭3 ♯5 ♭7' },
    ],
  },
  {
    heading: 'Major',
    chips: [
      { label: 'maj', suffix: '', title: 'major triad — completed as a 6th' },
      { label: 'Δ7', suffix: 'Δ7', title: 'major 7th — R 3 5 7' },
      { label: '6', suffix: '6', title: 'major 6th — R 3 5 6' },
      { label: '6/9', suffix: '6/9', title: 'six-nine — R 3 6 9' },
      { label: 'add9', suffix: 'add9', title: 'add 9 — R 3 5 9' },
      { label: 'Δ9', suffix: 'Δ9', title: 'major 9th — R 3 7 9' },
      { label: 'Δ13', suffix: 'Δ13', title: 'major 13th — R 3 7 13' },
      { label: 'Δ7♯11', suffix: 'Δ7♯11', title: 'Lydian major 7th — R 3 7 ♯11' },
      { label: 'Δ7♭5', suffix: 'Δ7♭5', title: 'major 7th flat five — R 3 ♭5 7' },
    ],
  },
  {
    heading: 'Dim',
    chips: [
      { label: '°', suffix: '°', title: 'diminished triad — completed as °7' },
      { label: 'ø7', suffix: 'ø7', title: 'half-diminished — R ♭3 ♭5 ♭7' },
      { label: '°7', suffix: '°7', title: 'diminished 7th — R ♭3 ♭5 ♭♭7' },
      { label: '°Δ7', suffix: '°Δ7', title: 'diminished major 7th — R ♭3 ♭5 7' },
      { label: '-9♭5', suffix: '-9♭5', title: 'half-diminished 9th — R ♭3 ♭5 ♭7' },
    ],
  },
  {
    heading: 'Aug',
    chips: [
      { label: '+', suffix: '+', title: 'augmented triad — completed as 7♯5' },
      { label: '7♯5', suffix: '7♯5', title: 'R 3 ♯5 ♭7' },
      { label: 'Δ7♯5', suffix: 'Δ7♯5', title: 'augmented major 7th — R 3 ♯5 7' },
    ],
  },
]

export const ALL_QUALITY_CHIPS: QualityChip[] = QUALITY_GROUPS.flatMap(
  (group) => group.chips
)

/** Qualities that are actually three-note triads (or sus triads). */
export const TRIAD_QUALITY_GROUPS: QualityGroup[] = [
  {
    heading: 'Dominant',
    chips: [
      { label: 'sus2', suffix: 'sus2', title: 'suspended 2nd — R 2 5' },
      { label: 'sus4', suffix: 'sus4', title: 'suspended 4th — R 4 5' },
    ],
  },
  {
    heading: 'Minor',
    chips: [
      { label: '-', suffix: '-', title: 'minor triad — R ♭3 5' },
    ],
  },
  {
    heading: 'Major',
    chips: [
      { label: 'maj', suffix: '', title: 'major triad — R 3 5' },
    ],
  },
  {
    heading: 'Dim',
    chips: [
      { label: '°', suffix: '°', title: 'diminished triad — R ♭3 ♭5' },
    ],
  },
  {
    heading: 'Aug',
    chips: [
      { label: '+', suffix: '+', title: 'augmented triad — R 3 ♯5' },
    ],
  },
]

export const TRIAD_QUALITY_CHIPS: QualityChip[] = TRIAD_QUALITY_GROUPS.flatMap(
  (group) => group.chips
)

const TRIAD_SUFFIX_BY_SEMITONES: Record<string, string> = {
  '0,4,7': '',
  '0,3,7': '-',
  '0,4,8': '+',
  '0,3,6': '°',
  '0,2,7': 'sus2',
  '0,5,7': 'sus4',
}

const TRIAD_LABEL_BY_SUFFIX: Record<string, string> = {
  '': 'major triad',
  '-': 'minor triad',
  '+': 'augmented triad',
  '°': 'diminished triad',
  sus2: 'suspended 2nd',
  sus4: 'suspended 4th',
}

/** Exact pitch-class set (from the root) → jazz suffix. */
const JAZZ_SUFFIX_BY_SEMITONES: Record<string, string> = {
  ...TRIAD_SUFFIX_BY_SEMITONES,
  '0,4,7,11': 'Δ7',
  '0,3,7,10': '-7',
  '0,4,7,10': '7',
  '0,3,6,10': 'ø7',
  '0,3,6,9': '°7',
  '0,4,7,9': '6',
  '0,3,7,9': '-6',
  '0,3,7,11': '-Δ7',
  '0,3,6,11': '°Δ7',
  '0,2,4,9': '6/9',
  '0,2,3,9': '-6/9',
  '0,2,5,7': 'sus2',
  '0,5,7,10': '7sus4',
  '0,2,7,10': '7sus2',
  '0,2,5,10': '9sus4',
  '0,1,5,10': '7sus4♭9',
  '0,2,4,10': '9',
  '0,4,5,10': '11',
  '0,4,9,10': '13',
  '0,2,4,11': 'Δ9',
  '0,4,9,11': 'Δ13',
  '0,2,3,10': '-9',
  '0,3,5,10': '-11',
  '0,3,9,10': '-13',
  '0,2,4,7': 'add9',
  '0,2,3,7': '-add9',
  '0,4,6,11': 'Δ7♯11',
  '0,4,8,11': 'Δ7♯5',
  '0,4,6,10': '7♭5',
  '0,4,8,10': '7♯5',
  '0,1,4,10': '7♭9',
  '0,3,4,10': '7♯9',
  '0,1,4,8': '7alt',
  '0,1,4,9': '13♭9',
  '0,4,6,9': '13♯11',
  '0,3,8,10': '-7♯5',
  '0,1,4,6': '7♭9♭5',
  '0,3,4,6': '7♯9♭5',
  '0,3,4,8': '7♯9♯5',
  '0,5,7,9': '6sus4',
  '0,5,7,11': 'Δ7sus4',
  '0,2,7,9': '6sus2',
  '0,2,7,11': 'Δ7sus2',
  '0,2,5,11': 'Δ9sus4',
}

const JAZZ_LABEL_BY_SUFFIX: Record<string, string> = {
  ...TRIAD_LABEL_BY_SUFFIX,
  Δ7: 'major 7th',
  '-7': 'minor 7th',
  '7': 'dominant 7th',
  ø7: 'half-diminished 7th',
  '°7': 'diminished 7th',
  '6': 'major 6th',
  '-6': 'minor 6th',
  '-Δ7': 'minor-major 7th',
  '°Δ7': 'diminished major 7th',
  '6/9': 'six-nine',
  '-6/9': 'minor six-nine',
  '7sus4': 'dominant 7th suspended 4th',
  '7sus2': 'dominant 7th suspended 2nd',
  '9sus4': 'dominant 9th suspended 4th',
  '7sus4♭9': 'dominant 7th suspended Phrygian',
  '9': 'dominant 9th',
  '11': 'dominant 11th',
  '13': 'dominant 13th',
  Δ9: 'major 9th',
  Δ13: 'major 13th',
  '-9': 'minor 9th',
  '-11': 'minor 11th',
  '-13': 'minor 13th',
  add9: 'add 9',
  '-add9': 'minor add 9',
  'Δ7♯11': 'Lydian major 7th',
  'Δ7♯5': 'augmented major 7th',
  'Δ7♭5': 'major 7th flat five',
  '7♭5': 'dominant 7th flat five',
  '7♯5': 'dominant 7th sharp five',
  '7♭9': 'dominant 7th flat nine',
  '7♯9': 'dominant 7th sharp nine',
  '7♯11': 'dominant 7th sharp eleven',
  '7♭13': 'dominant 7th flat thirteen',
  '7alt': 'altered dominant',
  '13♭9': 'dominant 13th flat nine',
  '13♯11': 'dominant 13th sharp eleven',
  '-7♯5': 'minor 7th sharp five',
  '7♭9♭5': 'dominant 7th flat nine flat five',
  '7♯9♭5': 'dominant 7th sharp nine flat five',
  '7♯9♯5': 'dominant 7th sharp nine sharp five',
  '6sus4': 'major 6th suspended 4th',
  'Δ7sus4': 'major 7th suspended 4th',
  '6sus2': 'major 6th suspended 2nd',
  'Δ7sus2': 'major 7th suspended 2nd',
  'Δ9sus4': 'major 9th suspended 4th',
}

export function triadSuffixFromSemitones(
  semitones: Iterable<number>
): string | null {
  const key = [...new Set(semitones)].sort((a, b) => a - b).join(',')
  return Object.prototype.hasOwnProperty.call(TRIAD_SUFFIX_BY_SEMITONES, key)
    ? TRIAD_SUFFIX_BY_SEMITONES[key]
    : null
}

export function triadQualityLabel(suffix: string): string {
  return TRIAD_LABEL_BY_SUFFIX[suffix] ?? 'triad'
}

export function jazzSuffixFromSemitones(
  semitones: Iterable<number>
): string | null {
  const key = [...new Set(semitones)].sort((a, b) => a - b).join(',')
  return Object.prototype.hasOwnProperty.call(JAZZ_SUFFIX_BY_SEMITONES, key)
    ? JAZZ_SUFFIX_BY_SEMITONES[key]
    : null
}

export interface JazzSetName {
  /** Quality after the root, e.g. `Δ7♯11` or `Δ7♯11(add5)-R`. */
  suffix: string
  label: string
}

/**
 * Names a pitch-class set from the root. Rootless four-note grips that are a
 * known quality plus extra tones become `Δ7♯11(add5)-R` rather than brackets.
 */
export function jazzDescribeSet(
  semitones: Iterable<number>
): JazzSetName | null {
  const pcs = [...new Set(semitones)].sort((a, b) => a - b)
  const exact = jazzSuffixFromSemitones(pcs)
  if (exact !== null) {
    return { suffix: exact, label: jazzQualityLabel(exact) }
  }
  if (pcs.length !== 4 || pcs.includes(0)) return null

  const have = new Set(pcs)
  let best: { suffix: string; extras: number[]; score: number } | null = null
  for (const [key, suffix] of Object.entries(JAZZ_SUFFIX_BY_SEMITONES)) {
    const quality = key.split(',').map(Number)
    if (quality.length !== 4 || !quality.includes(0)) continue
    const body = quality.filter((pc) => pc !== 0)
    if (!body.every((pc) => have.has(pc))) continue
    const extras = pcs.filter((pc) => !body.includes(pc))
    const score =
      extras.length * 10 + extras.reduce((sum, pc) => sum + extraCost(pc), 0)
    if (!best || score < best.score) best = { suffix, extras, score }
  }
  if (!best) return null
  const adds = best.extras
    .map((pc) => addToken(pc, best!.suffix, have))
    .join(',')
  return {
    suffix: `${best.suffix}(add${adds})-R`,
    label: `rootless ${jazzQualityLabel(best.suffix)}, add ${adds}`,
  }
}

function extraCost(pc: number): number {
  if (pc === 7) return 0
  if (pc === 2 || pc === 9) return 1
  if (pc === 5) return 2
  return 4
}

function addToken(pc: number, suffix: string, have: Set<number>): string {
  if (pc === 7) return '5'
  if (pc === 2) return '9'
  if (pc === 5) return suffix.includes('7') || have.has(10) || have.has(11) ? '11' : '4'
  if (pc === 9) return have.has(10) || have.has(11) || suffix.includes('7') ? '13' : '6'
  if (pc === 6) {
    return /Δ|maj|#11|♯11/i.test(suffix) || have.has(11) ? '#11' : 'b5'
  }
  if (pc === 8) return have.has(10) ? 'b13' : '#5'
  if (pc === 1) return 'b9'
  if (pc === 3) return have.has(4) ? '#9' : 'b3'
  if (pc === 4) return '3'
  if (pc === 10) return 'b7'
  if (pc === 11) return '7'
  return String(pc)
}

export function jazzQualityLabel(suffix: string): string {
  return JAZZ_LABEL_BY_SUFFIX[suffix] ?? (suffix ? suffix : 'major triad')
}

export function isKnownJazzSuffix(suffix: string): boolean {
  return Object.prototype.hasOwnProperty.call(JAZZ_LABEL_BY_SUFFIX, suffix)
}
