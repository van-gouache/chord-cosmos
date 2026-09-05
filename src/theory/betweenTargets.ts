/**
 * Target notes: pitch classes that belong to the next chord but are not
 * among the current chord's possible tones. Outlines on a grip use the
 * nearest empty cell that sounds that pitch class.
 */

import { mod12 } from './pitch'
import {
  MAX_PLAYABLE_FRET,
  STANDARD_TUNING,
  STRING_COUNT,
  type Fingering,
} from './fretboard'
import type { ParsedChord } from './chords'

export interface BetweenTarget {
  pc: number
  semitones: number
  degree: string
  name: string
  context: string
}

function possiblePcs(chord: ParsedChord): Set<number> {
  return new Set(
    [...chord.tones, ...chord.allTones].map((tone) => tone.pc)
  )
}

export function suggestForwardTargets(
  current: ParsedChord,
  next: ParsedChord
): BetweenTarget[] {
  const have = possiblePcs(current)
  const seen = new Set<number>()
  const targets: BetweenTarget[] = []

  for (const tone of [...next.tones, ...next.allTones]) {
    if (have.has(tone.pc) || seen.has(tone.pc)) continue
    seen.add(tone.pc)
    targets.push({
      pc: tone.pc,
      semitones: tone.semitones,
      degree: tone.degree,
      name: tone.name,
      context: `in ${next.symbol}`,
    })
  }

  return targets
}

export function nearestEmptyCell(
  pc: number,
  fingering: Fingering,
  window?: { startFret: number; fretRows: number; showNut: boolean } | null
): { string: number; fret: number } | null {
  const occupied = new Set(
    fingering.notes.map((note) => `${note.string}:${note.fret}`)
  )
  const preferLo = window ? (window.showNut ? 0 : window.startFret) : 0
  const preferHi = window
    ? window.startFret + window.fretRows - 1
    : MAX_PLAYABLE_FRET
  let best: { string: number; fret: number; score: number } | null = null

  for (let string = 0; string < STRING_COUNT; string++) {
    for (let fret = 0; fret <= MAX_PLAYABLE_FRET; fret++) {
      if (occupied.has(`${string}:${fret}`)) continue
      const midi = STANDARD_TUNING[string] + fret
      if (mod12(midi) !== pc) continue
      const inWindow =
        fret >= preferLo &&
        fret <= preferHi &&
        (fret !== 0 || !window || window.showNut)
      const near = fingering.notes.length
        ? Math.min(
            ...fingering.notes.map(
              (note) =>
                Math.abs(note.midi - midi) + Math.abs(note.string - string)
            )
          )
        : fret
      const score = near + (inWindow ? 0 : 8)
      if (!best || score < best.score) best = { string, fret, score }
    }
  }

  return best ? { string: best.string, fret: best.fret } : null
}

export function cellPc(note: { string: number; fret: number }): number {
  return mod12(STANDARD_TUNING[note.string] + note.fret)
}
