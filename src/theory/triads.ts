/**
 * Three-note triad voicings, using the same chord-tone-gap idea as the
 * V-System: close packs, open spreads, and a wide bass-plus-cluster.
 */

import type { ChordTone, ParsedChord } from './chords'
import { findIntervalFingerings, previewScore, type SearchOptions } from './fretboard'
import { mod12 } from './pitch'
import type { VoicingShape } from './vsystem'
import {
  voicingId,
  type GroupResult,
  type InversionOption,
  type Voicing,
} from './voicings'

export interface TriadGroup {
  id: string
  number: number
  gaps: [number, number]
  dropName?: string
  description: string
}

export const TRIAD_GROUPS: TriadGroup[] = [
  {
    id: 'Close',
    number: 1,
    gaps: [0, 0],
    dropName: 'close triad',
    description:
      'Three voices packed as tightly as they go. The stock guitar triad in every inversion.',
  },
  {
    id: 'Spread',
    number: 2,
    gaps: [1, 1],
    dropName: 'open triad',
    description:
      'A spread voicing: skip a chord tone between each pair so the outer voices span a tenth.',
  },
  {
    id: 'Wide',
    number: 3,
    gaps: [3, 0],
    dropName: 'wide triad',
    description:
      'The third and fifth sit as a close pair an octave above the bass. Big, pianistic.',
  },
]

export const TRIAD_GROUPS_BY_ID: Record<string, TriadGroup> = Object.fromEntries(
  TRIAD_GROUPS.map((group) => [group.id, group])
)

export function isTriadGroupId(id: string): boolean {
  return id in TRIAD_GROUPS_BY_ID
}

/**
 * The 1–3–5 (or sus / dim / aug) triad implied by a parsed chord, ignoring
 * sevenths and extensions the V-System added to reach four voices.
 */
export function triadTones(chord: ParsedChord): ChordTone[] | null {
  const pool = chord.allTones.length > 0 ? chord.allTones : chord.tones
  const root =
    pool.find((tone) => tone.role === 'root' || tone.semitones === 0) ?? null
  const third = pool.find((tone) => tone.role === 'third') ?? null
  const fifth =
    pool.find(
      (tone) =>
        tone.role === 'fifth' ||
        tone.degree === '5' ||
        tone.degree === '♭5' ||
        tone.degree === '♯5'
    ) ?? null

  if (!root || !third || !fifth) return null

  const unique = new Map<number, ChordTone>()
  for (const tone of [root, third, fifth]) unique.set(tone.semitones, tone)
  if (unique.size !== 3) return null

  return [...unique.values()].sort((a, b) => a.semitones - b.semitones)
}

export function buildTriadShape(
  tones: ChordTone[],
  group: TriadGroup,
  inversion: number
): VoicingShape {
  if (tones.length !== 3) {
    throw new Error('Triad voicings need exactly three distinct chord tones')
  }

  const sorted = [...tones].sort((a, b) => a.semitones - b.semitones)
  const toneAt = (i: number) => {
    const tone = sorted[((i % 3) + 3) % 3]
    return {
      tone,
      pitch: tone.semitones + 12 * Math.floor(i / 3),
    }
  }

  const [gapBM, gapMT] = group.gaps
  const indices = [inversion]
  indices.push(indices[0] + 1 + gapBM)
  indices.push(indices[1] + 1 + gapMT)

  const voices = indices.map(toneAt)
  const bassPitch = voices[0].pitch
  const intervals = voices.map((voice) => voice.pitch - bassPitch)

  return {
    group,
    inversion,
    intervals,
    voiceTones: voices.map((voice) => voice.tone),
    span: intervals[intervals.length - 1] ?? 0,
  }
}

export function generateTriadGroup(
  chord: ParsedChord,
  group: TriadGroup,
  options: SearchOptions = {}
): GroupResult {
  const tones = triadTones(chord)
  if (!tones) {
    return {
      group,
      inversions: [],
      preview: null,
      voicingCount: 0,
      unreachable: true,
    }
  }

  const inversions: InversionOption[] = []
  let voicingCount = 0

  for (let inversion = 0; inversion < 3; inversion++) {
    const shape = buildTriadShape(tones, group, inversion)
    const bassPc = mod12(chord.rootPc + shape.voiceTones[0].semitones)
    const fingerings = findIntervalFingerings(shape.intervals, bassPc, options)

    const voicings: Voicing[] = fingerings.map((fingering) => ({
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

  const byPreviewScore = (a: Voicing, b: Voicing) =>
    previewScore(a.fingering) - previewScore(b.fingering) ||
    a.fingering.lowestFret - b.fingering.lowestFret

  const rootPosition = [...(inversions[0]?.voicings ?? [])].sort(byPreviewScore)
  const anyInversion = inversions.flatMap((item) => item.voicings).sort(byPreviewScore)
  const preview = rootPosition[0] ?? anyInversion[0] ?? null

  return {
    group,
    inversions,
    preview,
    voicingCount,
    unreachable: voicingCount === 0,
  }
}

export function generateAllTriads(
  chord: ParsedChord,
  options: SearchOptions = {}
): GroupResult[] {
  return TRIAD_GROUPS.map((group) => generateTriadGroup(chord, group, options))
}
