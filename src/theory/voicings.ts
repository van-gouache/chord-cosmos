/**
 * Ties the pieces together: a chord symbol in, a full map of V-System
 * voicings and their guitar fingerings out.
 */

import type { ChordTone, ParsedChord } from './chords'
import {
  findFingerings,
  previewScore,
  shiftFingering,
  tabLabel,
  type Fingering,
  type SearchOptions,
} from './fretboard'
import { buildShape, V_GROUPS, type VGroup, type VoicingShape } from './vsystem'

/** One concrete, selectable chord: a shape plus the way you'd finger it. */
export interface Voicing {
  /** Stable across renders, and safe to persist in a saved sequence. */
  id: string
  chordSymbol: string
  rootName: string
  groupId: string
  inversion: number
  shape: VoicingShape
  fingering: Fingering
}

/** One of the four systematic inversions of a group, with its fingerings. */
export interface InversionOption {
  inversion: number
  bassTone: ChordTone
  shape: VoicingShape
  voicings: Voicing[]
}

/** Everything the app knows about one voicing group for the current chord. */
export interface GroupResult {
  group: VoicingShape['group']
  inversions: InversionOption[]
  /** Easiest fingering in the whole group, used for the preview diagram. */
  preview: Voicing | null
  voicingCount: number
  /** True when no inversion of this group is playable in standard tuning. */
  unreachable: boolean
}

export function voicingId(
  chordSymbol: string,
  groupId: string,
  inversion: number,
  fingering: Fingering
): string {
  return `${chordSymbol}|${groupId}|${inversion}|${tabLabel(fingering)}`
}

/** Builds every playable voicing of one group for one chord. */
export function generateGroup(
  chord: ParsedChord,
  group: VGroup,
  options: SearchOptions = {}
): GroupResult {
  const inversions: InversionOption[] = []
  let voicingCount = 0

  for (let inversion = 0; inversion < 4; inversion++) {
    const shape = buildShape(chord.tones, group, inversion)
    const fingerings = findFingerings(shape, chord.rootPc, options)

    const voicings = fingerings.map((fingering) => ({
      id: voicingId(chord.symbol, group.id, inversion, fingering),
      chordSymbol: chord.symbol,
      rootName: chord.rootName,
      groupId: group.id,
      inversion,
      shape,
      fingering,
    }))

    voicingCount += voicings.length
    inversions.push({
      inversion,
      bassTone: shape.voiceTones[0],
      shape,
      voicings,
    })
  }

  // Previews are pinned to root position so the grid compares the one thing
  // the V-System is about: spacing. Groups whose root position can't be played
  // fall back to whichever inversion can.
  const byPreviewScore = (a: Voicing, b: Voicing) =>
    previewScore(a.fingering) - previewScore(b.fingering) ||
    a.fingering.lowestFret - b.fingering.lowestFret

  const rootPosition = [...inversions[0].voicings].sort(byPreviewScore)
  const anyInversion = inversions
    .flatMap((inv) => inv.voicings)
    .sort(byPreviewScore)

  const preview = rootPosition[0] ?? anyInversion[0] ?? null

  return {
    group,
    inversions,
    preview,
    voicingCount,
    unreachable: voicingCount === 0,
  }
}

/** Builds all 14 groups for a chord, in V-System order. */
export function generateAllGroups(
  chord: ParsedChord,
  options: SearchOptions = {}
): GroupResult[] {
  return V_GROUPS.map((group) => generateGroup(chord, group, options))
}

/** Label for an inversion, e.g. `♭7 in bass`. */
export function inversionLabel(option: InversionOption): string {
  const degree = option.bassTone.degree
  return degree === 'R' ? 'Root in bass' : `${degree} in bass`
}

export function inversionOrdinal(inversion: number): string {
  return ['Root position', '1st inversion', '2nd inversion', '3rd inversion'][
    inversion
  ]
}

/** Same voicing, moved ±12 frets. Null when the shape would leave the neck. */
export function shiftVoicing(
  voicing: Voicing,
  deltaFrets: number
): Voicing | null {
  const fingering = shiftFingering(voicing.fingering, deltaFrets)
  if (!fingering) return null
  return {
    ...voicing,
    id: voicingId(voicing.chordSymbol, voicing.groupId, voicing.inversion, fingering),
    fingering,
  }
}
