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
    heading: 'Quality',
    chips: [
      { label: 'maj', suffix: '', title: 'major triad — completed as a 6th' },
      { label: 'm', suffix: 'm', title: 'minor triad — completed as a minor 7th' },
      { label: '+', suffix: '+', title: 'augmented triad — completed as 7♯5' },
      { label: '°', suffix: '°', title: 'diminished triad — completed as °7' },
      { label: 'Δ7', suffix: 'maj7', title: 'major 7th — R 3 5 7' },
      { label: '-7', suffix: '-7', title: 'minor 7th — R ♭3 5 ♭7' },
      { label: '7', suffix: '7', title: 'dominant 7th — R 3 5 ♭7' },
      { label: 'ø7', suffix: 'ø7', title: 'half-diminished — R ♭3 ♭5 ♭7' },
      { label: '°7', suffix: '°7', title: 'diminished 7th — R ♭3 ♭5 ♭♭7' },
      { label: '6', suffix: '6', title: 'major 6th — R 3 5 6' },
      { label: '-6', suffix: '-6', title: 'minor 6th — R ♭3 5 6' },
      { label: '-Δ7', suffix: '-Δ7', title: 'minor-major 7th — R ♭3 5 7' },
      { label: '°Δ7', suffix: '°Δ7', title: 'diminished major 7th — R ♭3 ♭5 7' },
      { label: '6/9', suffix: '6/9', title: 'six-nine — R 3 6 9' },
      { label: '-6/9', suffix: '-6/9', title: 'minor six-nine — R ♭3 6 9' },
    ],
  },
  {
    heading: 'Sus',
    chips: [
      { label: 'sus2', suffix: 'sus2', title: 'suspended 2nd — completed as R 2 4 5' },
      { label: 'sus4', suffix: 'sus4', title: 'suspended 4th — completed as 7sus4' },
      { label: '7sus2', suffix: '7sus2', title: 'R 2 5 ♭7' },
      { label: '7sus4', suffix: '7sus4', title: 'R 4 5 ♭7' },
      { label: '9sus4', suffix: '9sus4', title: 'R 4 ♭7 9' },
      { label: '7sus♭9', suffix: '7sus4b9', title: 'Phrygian — R 4 ♭7 ♭9' },
    ],
  },
  {
    heading: 'Colour',
    chips: [
      { label: '9', suffix: '9', title: 'dominant 9th — R 3 ♭7 9' },
      { label: '11', suffix: '11', title: 'dominant 11th — R 3 ♭7 11' },
      { label: '13', suffix: '13', title: 'dominant 13th — R 3 ♭7 13' },
      { label: 'Δ9', suffix: 'maj9', title: 'major 9th — R 3 7 9' },
      { label: 'Δ13', suffix: 'maj13', title: 'major 13th — R 3 7 13' },
      { label: '-9', suffix: '-9', title: 'minor 9th — R ♭3 ♭7 9' },
      { label: '-11', suffix: '-11', title: 'minor 11th — R ♭3 ♭7 11' },
      { label: '-13', suffix: '-13', title: 'minor 13th — R ♭3 ♭7 13' },
      { label: 'add9', suffix: 'add9', title: 'add 9 — R 3 5 9' },
      { label: '-add9', suffix: '-add9', title: 'minor add 9 — R ♭3 5 9' },
      { label: 'Δ7♯11', suffix: 'maj7#11', title: 'Lydian major 7th — R 3 7 ♯11' },
      { label: 'Δ7♯5', suffix: 'maj7#5', title: 'augmented major 7th — R 3 ♯5 7' },
      { label: 'Δ7♭5', suffix: 'maj7b5', title: 'major 7th flat five — R 3 ♭5 7' },
      { label: '7♭5', suffix: '7b5', title: 'R 3 ♭5 ♭7' },
      { label: '7♯5', suffix: '7#5', title: 'R 3 ♯5 ♭7' },
      { label: '7♭9', suffix: '7b9', title: 'R 3 ♭7 ♭9' },
      { label: '7♯9', suffix: '7#9', title: 'Hendrix — R 3 ♭7 ♯9' },
      { label: '7♯11', suffix: '7#11', title: 'R 3 ♭7 ♯11' },
      { label: '7♭13', suffix: '7b13', title: 'R 3 ♭7 ♭13' },
      { label: '7alt', suffix: '7alt', title: 'altered — R 3 ♭9 ♯5' },
      { label: '9♯11', suffix: '9#11', title: 'R 3 ♭7 ♯11' },
      { label: '13♭9', suffix: '13b9', title: 'R 3 13 ♭9' },
      { label: '13♯11', suffix: '13#11', title: 'R 3 13 ♯11' },
      { label: '-7♯5', suffix: '-7#5', title: 'R ♭3 ♯5 ♭7' },
      { label: '-9♭5', suffix: '-9b5', title: 'half-diminished 9th — R ♭3 ♭5 ♭7' },
    ],
  },
  {
    heading: 'Altered',
    chips: [
      { label: '7♭9♭5', suffix: '7b9b5', title: 'R 3 ♭9 ♭5' },
      { label: '7♭9♯5', suffix: '7b9#5', title: 'R 3 ♭9 ♯5' },
      { label: '7♯9♭5', suffix: '7#9b5', title: 'R 3 ♯9 ♭5' },
      { label: '7♯9♯5', suffix: '7#9#5', title: 'R 3 ♯9 ♯5' },
      { label: '7♭9♯11', suffix: '7b9#11', title: 'R 3 ♭9 ♯11' },
      { label: '7♯9♯11', suffix: '7#9#11', title: 'R 3 ♯9 ♯11' },
    ],
  },
]

export const ALL_QUALITY_CHIPS: QualityChip[] = QUALITY_GROUPS.flatMap(
  (group) => group.chips
)

/** Qualities that are actually three-note triads (or sus triads). */
export const TRIAD_QUALITY_GROUPS: QualityGroup[] = [
  {
    heading: 'Quality',
    chips: [
      { label: 'maj', suffix: '', title: 'major triad — R 3 5' },
      { label: 'm', suffix: 'm', title: 'minor triad — R ♭3 5' },
      { label: '+', suffix: '+', title: 'augmented triad — R 3 ♯5' },
      { label: '°', suffix: '°', title: 'diminished triad — R ♭3 ♭5' },
    ],
  },
  {
    heading: 'Sus',
    chips: [
      { label: 'sus2', suffix: 'sus2', title: 'suspended 2nd — R 2 5' },
      { label: 'sus4', suffix: 'sus4', title: 'suspended 4th — R 4 5' },
    ],
  },
]

export const TRIAD_QUALITY_CHIPS: QualityChip[] = TRIAD_QUALITY_GROUPS.flatMap(
  (group) => group.chips
)

const TRIAD_SUFFIX_BY_SEMITONES: Record<string, string> = {
  '0,4,7': '',
  '0,3,7': 'm',
  '0,4,8': '+',
  '0,3,6': '°',
  '0,2,7': 'sus2',
  '0,5,7': 'sus4',
}

const TRIAD_LABEL_BY_SUFFIX: Record<string, string> = {
  '': 'major triad',
  m: 'minor triad',
  '+': 'augmented triad',
  '°': 'diminished triad',
  sus2: 'suspended 2nd',
  sus4: 'suspended 4th',
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
