/**
 * Ted Greene's V-System: the 14 four-note, non-doubling voicing groups.
 *
 * Every group is defined by its "chord tone gaps" — how many chord tones fit
 * in the space between bass and tenor, tenor and alto, and alto and soprano.
 * That table (Ted Greene, "Method 2 — The Chord Tone Gap Method") is enough to
 * generate every voicing in the system, so the shapes here are computed rather
 * than transcribed.
 */

import type { ChordTone } from './chords'

export type VoiceName = 'bass' | 'tenor' | 'alto' | 'soprano'

export interface VGroup {
  /** `V-1` ... `V-14`. */
  id: string
  /** Numeric index 1-14, for sorting. */
  number: number
  /** Chord tones fitting in the [bass-tenor, tenor-alto, alto-soprano] gaps. */
  gaps: [number, number, number]
  /** Equivalent arranger's "drop" name, where a common one exists. */
  dropName?: string
  /** One-line character sketch of the group. */
  description: string
}

/**
 * The Chord Tone Gap Table. Each row says how many chord tones are skipped
 * between adjacent voices, reading from the bass upward.
 */
export const V_GROUPS: VGroup[] = [
  {
    id: 'V-1',
    number: 1,
    gaps: [0, 0, 0],
    dropName: 'close position',
    description:
      'Four-way close. Every voice as tight as it can be, outer voices inside an octave.',
  },
  {
    id: 'V-2',
    number: 2,
    gaps: [1, 0, 1],
    dropName: 'drop 2',
    description:
      'The workhorse group and the easiest on guitar. The "Wes chords" used for comping and block-chord soloing.',
  },
  {
    id: 'V-3',
    number: 3,
    gaps: [0, 1, 2],
    dropName: 'drop 2 & 3',
    description:
      'Bottom three voices bunched with the soprano off on its own. Distinctive higher up the neck.',
  },
  {
    id: 'V-4',
    number: 4,
    gaps: [2, 1, 0],
    dropName: 'drop 3',
    description:
      'The other great stock jazz group — the "Freddie Green" big-band rhythm chords.',
  },
  {
    id: 'V-5',
    number: 5,
    gaps: [1, 2, 1],
    dropName: 'drop 2 & 4',
    description:
      'A wide, symmetric spread with the gap in the middle. Still very playable.',
  },
  {
    id: 'V-6',
    number: 6,
    gaps: [4, 0, 0],
    dropName: 'drop 4',
    description:
      'A V-1 cluster with the bass dropped an octave beneath it. Big, open, pianistic.',
  },
  {
    id: 'V-7',
    number: 7,
    gaps: [5, 0, 1],
    description: 'A V-2 with the bass an octave lower. Wide bass separation.',
  },
  {
    id: 'V-8',
    number: 8,
    gaps: [2, 2, 2],
    description:
      'Evenly spread across all six strings — the most symmetric of the wide voicings.',
  },
  {
    id: 'V-9',
    number: 9,
    gaps: [1, 0, 5],
    description: 'A V-2 with the soprano an octave higher. Isolated melody note on top.',
  },
  {
    id: 'V-10',
    number: 10,
    gaps: [1, 4, 1],
    description: 'A V-2 split in half, with a wide gap opened up in the middle.',
  },
  {
    id: 'V-11',
    number: 11,
    gaps: [2, 1, 4],
    description: 'A V-4 with the soprano an octave higher. Rare and very wide.',
  },
  {
    id: 'V-12',
    number: 12,
    gaps: [4, 1, 2],
    description: 'A V-3 with the bass an octave lower. Rare and very wide.',
  },
  {
    id: 'V-13',
    number: 13,
    gaps: [0, 4, 0],
    description: 'A V-1 cluster on top of a low two-note pair. Rare, big stretches.',
  },
  {
    id: 'V-14',
    number: 14,
    gaps: [0, 0, 4],
    description: 'A close triad with the melody lifted an octave clear above it.',
  },
]

export const V_GROUPS_BY_ID: Record<string, VGroup> = Object.fromEntries(
  V_GROUPS.map((g) => [g.id, g])
)

export const VOICE_NAMES: VoiceName[] = ['bass', 'tenor', 'alto', 'soprano']

/** A vertical structure, described as intervals above the bass. */
export interface VoicingShape {
  group: {
    id: string
    number: number
    gaps: readonly number[]
    dropName?: string
    description: string
  }
  /** Which chord tone is in the bass: 0 = lowest tone of the chord, etc. */
  inversion: number
  /** Semitones above the bass for each voice, bass first (always 0). */
  intervals: number[]
  /** The chord tone sitting in each voice, bass first. */
  voiceTones: ChordTone[]
  /** Total span from bass to soprano, in semitones. */
  span: number
}

/**
 * Builds the four-voice structure for one group and one inversion.
 *
 * Chord tones are treated as an endlessly ascending cycle (the four tones,
 * then the same four an octave up, and so on). Starting from the chosen bass
 * tone, each gap says how many tones of that cycle to skip before the next
 * voice.
 */
export function buildShape(
  chordTones: ChordTone[],
  group: VGroup,
  inversion: number
): VoicingShape {
  if (chordTones.length !== 4) {
    throw new Error('The V-System requires exactly four distinct chord tones')
  }

  const sorted = [...chordTones].sort((a, b) => a.semitones - b.semitones)

  /** The i-th tone of the endlessly ascending chord-tone cycle. */
  const toneAt = (i: number) => {
    const tone = sorted[((i % 4) + 4) % 4]
    return {
      tone,
      pitch: tone.semitones + 12 * Math.floor(i / 4),
    }
  }

  const [gapBT, gapTA, gapAS] = group.gaps
  const indices = [inversion]
  indices.push(indices[0] + 1 + gapBT)
  indices.push(indices[1] + 1 + gapTA)
  indices.push(indices[2] + 1 + gapAS)

  const voices = indices.map(toneAt)
  const bassPitch = voices[0].pitch

  const intervals = voices.map((v) => v.pitch - bassPitch)

  return {
    group,
    inversion,
    intervals,
    voiceTones: voices.map((v) => v.tone),
    span: intervals[intervals.length - 1] ?? 0,
  }
}

/** All four systematic inversions of a group, bass tone ascending. */
export function buildShapes(
  chordTones: ChordTone[],
  group: VGroup
): VoicingShape[] {
  return [0, 1, 2, 3].map((inv) => buildShape(chordTones, group, inv))
}

/**
 * Classifies an arbitrary set of pitches into its voicing group, which is the
 * inverse of {@link buildShape}. Returns null if the pitches are not a
 * four-note non-doubling chord, or fall outside the 14 groups.
 */
export function classifyVoicing(pitches: number[]): VGroup | null {
  if (pitches.length !== 4) return null

  const sorted = [...pitches].sort((a, b) => a - b)
  const pcs = new Set(sorted.map((p) => ((p % 12) + 12) % 12))
  if (pcs.size !== 4) return null

  // Reconstruct the ascending chord-tone cycle from the chord's pitch classes.
  const cycle = [...pcs].sort((a, b) => a - b)
  const indexOfPitch = (pitch: number) => {
    const pc = ((pitch % 12) + 12) % 12
    const within = cycle.indexOf(pc)
    // How many complete cycles above the bass's octave this pitch sits.
    const octave = Math.floor((pitch - pc) / 12)
    return within + 4 * octave
  }

  const idx = sorted.map(indexOfPitch)
  const gaps = [
    idx[1] - idx[0] - 1,
    idx[2] - idx[1] - 1,
    idx[3] - idx[2] - 1,
  ] as [number, number, number]

  return (
    V_GROUPS.find(
      (g) =>
        g.gaps[0] === gaps[0] && g.gaps[1] === gaps[1] && g.gaps[2] === gaps[2]
    ) ?? null
  )
}
