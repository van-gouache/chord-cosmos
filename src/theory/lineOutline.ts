/**
 * A single-note line stored as ordered fret outlines, not a chord grip.
 * Several notes may sit on the same string.
 */

import { MAX_PLAYABLE_FRET, STANDARD_TUNING, STRING_COUNT, type Fingering } from './fretboard'
import type { VoicingShape } from './vsystem'

/** American duration: 1 = whole, 4 = quarter, 8 = eighth. */
export type LineNoteValue = 1 | 2 | 4 | 8 | 16

export const LINE_NOTE_VALUES: readonly LineNoteValue[] = [1, 2, 4, 8, 16]

/** Notes per tuplet group: 3 = triplet, 6 = sextuplet. */
export type LineTuplet = 3 | 5 | 6 | 7

export const LINE_TUPLETS: readonly LineTuplet[] = [3, 5, 6, 7]

export interface LinePitch {
  /** 0 = low E, 5 = high E. */
  string: number
  /** 0 = open. */
  fret: number
}

export interface LineNote extends LinePitch {
  /** Written length. Omitted means a quarter. */
  value?: LineNoteValue
  /** Tuplet this note belongs to. Omitted means straight time. */
  tuplet?: LineTuplet
  /** Extra pitches sounding with this note. */
  stack?: LinePitch[]
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

export function isLinePitch(value: unknown): value is LinePitch {
  if (!value || typeof value !== 'object') return false
  const pitch = value as Partial<LinePitch>
  return (
    Number.isInteger(pitch.string) &&
    Number.isInteger(pitch.fret) &&
    pitch.string !== undefined &&
    pitch.fret !== undefined &&
    pitch.string >= 0 &&
    pitch.string <= 5 &&
    pitch.fret >= 0 &&
    pitch.fret <= MAX_PLAYABLE_FRET
  )
}

export function lineNotePitches(note: LineNote): LinePitch[] {
  const seen = new Set<number>([note.string])
  const extra: LinePitch[] = []
  for (const pitch of note.stack ?? []) {
    if (!isLinePitch(pitch) || seen.has(pitch.string)) continue
    seen.add(pitch.string)
    extra.push({ string: pitch.string, fret: pitch.fret })
  }
  return [{ string: note.string, fret: note.fret }, ...extra]
}

/** Every pitch in click order, tagged with its written event number. */
export function flattenLinePitches(
  notes: readonly LineNote[] | undefined
): { string: number; fret: number; at: number }[] {
  return (notes ?? []).flatMap((note, index) =>
    lineNotePitches(note).map((pitch) => ({
      string: pitch.string,
      fret: pitch.fret,
      at: index + 1,
    }))
  )
}

export function lineMidiNotes(notes: readonly LineNote[] | undefined): number[] {
  return flattenLinePitches(notes).map(
    (pitch) => STANDARD_TUNING[pitch.string] + pitch.fret
  )
}

export function isLineNoteValue(value: unknown): value is LineNoteValue {
  return value === 1 || value === 2 || value === 4 || value === 8 || value === 16
}

export function isLineTuplet(value: unknown): value is LineTuplet {
  return value === 3 || value === 5 || value === 6 || value === 7
}

function writeStack(note: LineNote): LinePitch[] | undefined {
  const extra = lineNotePitches(note).slice(1)
  return extra.length > 0 ? extra : undefined
}

function writeLineNote(note: LineNote): LineNote {
  const next: LineNote = { string: note.string, fret: note.fret }
  if (isLineNoteValue(note.value) && note.value !== 4) next.value = note.value
  if (isLineTuplet(note.tuplet)) next.tuplet = note.tuplet
  const stack = writeStack(note)
  if (stack) next.stack = stack
  return next
}

function noteFromPitches(
  pitches: readonly LinePitch[],
  extras: Pick<LineNote, 'value' | 'tuplet'>
): LineNote | undefined {
  const [head, ...rest] = pitches.filter(isLinePitch)
  if (!head) return undefined
  return writeLineNote({
    string: head.string,
    fret: head.fret,
    value: extras.value,
    tuplet: extras.tuplet,
    stack: rest,
  })
}

export function addPitchToNote(note: LineNote, pitch: LinePitch): LineNote {
  if (!isLinePitch(pitch)) return writeLineNote(note)
  const voices = lineNotePitches(note)
  const sameString = voices.findIndex((item) => item.string === pitch.string)
  let next: LinePitch[]
  if (sameString >= 0) {
    if (voices[sameString].fret === pitch.fret) {
      if (voices.length === 1) return writeLineNote(note)
      next = voices.filter((_, i) => i !== sameString)
    } else {
      next = voices.map((item, i) => (i === sameString ? pitch : item))
    }
  } else {
    next = [...voices, pitch]
  }
  return noteFromPitches(next, note) ?? writeLineNote(note)
}

/** Add a pitch to an existing written event. */
export function stackLineNote(
  notes: readonly LineNote[],
  index: number,
  pitch: LinePitch
): LineNote[] {
  if (index < 0 || index >= notes.length) return [...notes]
  return notes.map((note, i) => (i === index ? addPitchToNote(note, pitch) : note))
}

/** Append a fret. The same string/fret may appear more than once. */
export function appendLineNote(
  notes: LineNote[] | undefined,
  note: LineNote
): LineNote[] {
  return [...(notes ?? []), writeLineNote(note)]
}

/** Append a new event, or stack onto an existing one. */
export function placeLineNote(
  notes: LineNote[] | undefined,
  note: LineNote,
  options?: { stack?: boolean; at?: number }
): LineNote[] {
  const current = notes ?? []
  if (options?.stack && current.length > 0) {
    const at = Math.min(
      current.length - 1,
      Math.max(0, options.at ?? current.length - 1)
    )
    return stackLineNote(current, at, note)
  }
  return appendLineNote(current, note)
}

export function removeLineNoteAt(
  notes: readonly LineNote[],
  index: number
): LineNote[] | undefined {
  if (index < 0 || index >= notes.length) {
    return notes.length > 0 ? [...notes] : undefined
  }
  const next = notes.filter((_, i) => i !== index)
  return next.length > 0 ? next : undefined
}

/** Notes in written order. Repeats of the same fret are kept. */
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
    notes.push(
      writeLineNote({
        string: note.string,
        fret: note.fret,
        value: isLineNoteValue(note.value) ? note.value : undefined,
        tuplet: isLineTuplet(note.tuplet) ? note.tuplet : undefined,
        stack: Array.isArray(note.stack) ? note.stack : undefined,
      })
    )
  }
  return notes.length > 0 ? notes : undefined
}

export function lineSlotLabel(): string {
  return 'Line'
}
