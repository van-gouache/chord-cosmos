/**
 * A single-note line stored as ordered fret outlines, not a chord grip.
 * Several notes may sit on the same string.
 */

import { MAX_PLAYABLE_FRET, STANDARD_TUNING, STRING_COUNT, type Fingering } from './fretboard'
import type { VoicingShape } from './vsystem'

export interface LineNote {
  /** 0 = low E, 5 = high E. */
  string: number
  /** 0 = open. */
  fret: number
}

export const LINE_GROUP_ID = 'Line'
export const EMPTY_LINE_TAB = 'x-x-x-x-x-x'

export function isLineGroupId(id: string): boolean {
  return id === LINE_GROUP_ID
}

export function emptyLineFingering(): Fingering {
  return {
    notes: [],
    strings: Array.from({ length: STRING_COUNT }, () => null),
    lowestFret: 0,
    highestFret: 0,
    span: 0,
    barreFret: null,
    fingersNeeded: 0,
    innerMutes: [],
    position: 0,
    difficulty: 0,
    midiNotes: [],
  }
}

export function lineShape(): VoicingShape {
  return {
    group: {
      id: LINE_GROUP_ID,
      number: 0,
      gaps: [0, 0, 0],
      description: 'Single-note line outline',
    },
    inversion: 0,
    intervals: [],
    voiceTones: [],
    span: 0,
  }
}

export function lineMidiNotes(notes: readonly LineNote[] | undefined): number[] {
  return (notes ?? []).map((note) => STANDARD_TUNING[note.string] + note.fret)
}

function sameNote(a: LineNote, b: LineNote): boolean {
  return a.string === b.string && a.fret === b.fret
}

function compareNotes(a: LineNote, b: LineNote): number {
  return a.string - b.string || a.fret - b.fret
}

/** Add or remove a fret. Order is by string then fret, not click sequence. */
export function toggleLineNote(
  notes: LineNote[] | undefined,
  note: LineNote
): LineNote[] | undefined {
  const current = notes ?? []
  const exists = current.some((item) => sameNote(item, note))
  const next = exists
    ? current.filter((item) => !sameNote(item, note))
    : [...current, { string: note.string, fret: note.fret }].sort(compareNotes)
  return next.length > 0 ? next : undefined
}

/** Deduped notes, sorted by string then fret. */
export function readLineNotes(value: unknown): LineNote[] | undefined {
  if (!Array.isArray(value)) return undefined
  const notes: LineNote[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const note = item as Partial<LineNote>
    if (
      !Number.isInteger(note.string) ||
      !Number.isInteger(note.fret) ||
      note.string === undefined ||
      note.fret === undefined ||
      note.string < 0 ||
      note.string > 5 ||
      note.fret < 0 ||
      note.fret > MAX_PLAYABLE_FRET
    ) {
      continue
    }
    if (notes.some((other) => sameNote(other, note as LineNote))) continue
    notes.push({ string: note.string, fret: note.fret })
  }
  notes.sort(compareNotes)
  return notes.length > 0 ? notes : undefined
}

export function lineSlotLabel(): string {
  return 'Line'
}
