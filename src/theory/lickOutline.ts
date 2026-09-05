/**
 * Nearby chord tones around a grip — the notes you would reach for in a
 * lick that still outlines the same chord. Only the chord’s four voices
 * count; omitted extensions stay off the chart.
 *
 * Search is a rectangle: every string, and a few frets past the grip.
 * A string-and-fret halo was dropping the high E whenever the shape sat
 * on the lower four strings, or when the next chord tone on a string was
 * a minor/major third away.
 */

import type { ParsedChord } from './chords'
import {
  MAX_PLAYABLE_FRET,
  STANDARD_TUNING,
  STRING_COUNT,
  type Fingering,
} from './fretboard'
import { mod12 } from './pitch'

/** Frets above and below the grip to include on every string. */
export const LICK_FRET_PAD = 4

export interface LickOutlineNote {
  string: number
  fret: number
  pc: number
  degree: string
  name: string
}

function chordTonesByPc(
  chord: ParsedChord
): Map<number, { degree: string; name: string }> {
  const map = new Map<number, { degree: string; name: string }>()
  for (const tone of chord.tones) {
    if (!map.has(tone.pc)) {
      map.set(tone.pc, { degree: tone.degree, name: tone.name })
    }
  }
  return map
}

export function lickOutlineWindow(fingering: Fingering): {
  lo: number
  hi: number
} {
  const frets = fingering.notes.map((note) => note.fret)
  const lo = Math.max(0, Math.min(...frets) - LICK_FRET_PAD)
  const hi = Math.min(MAX_PLAYABLE_FRET, Math.max(...frets) + LICK_FRET_PAD)
  return { lo, hi }
}

export function lickOutlineNotes(
  fingering: Fingering,
  chord: ParsedChord
): LickOutlineNote[] {
  if (fingering.notes.length === 0) return []

  const tones = chordTonesByPc(chord)
  const occupied = new Set(
    fingering.notes.map((note) => `${note.string}:${note.fret}`)
  )
  const { lo, hi } = lickOutlineWindow(fingering)
  const notes: LickOutlineNote[] = []

  for (let string = 0; string < STRING_COUNT; string++) {
    for (let fret = lo; fret <= hi; fret++) {
      if (occupied.has(`${string}:${fret}`)) continue
      const pc = mod12(STANDARD_TUNING[string] + fret)
      const tone = tones.get(pc)
      if (!tone) continue
      notes.push({
        string,
        fret,
        pc,
        degree: tone.degree,
        name: tone.name,
      })
    }
  }

  return notes
}
