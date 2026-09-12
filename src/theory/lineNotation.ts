/**
 * Turn a line's selected frets into written pitches and note values.
 * Guitar is notated an octave above sounding pitch.
 */

import { STANDARD_TUNING } from './fretboard'
import {
  isLineNoteValue,
  isLineTuplet,
  lineNotePitches,
  LINE_NOTE_VALUES,
  LINE_TUPLETS,
  type LineNote,
  type LineNoteValue,
  type LineTuplet,
} from './lineOutline'
import {
  midiToOctave,
  midiToPitchClass,
  spellPitchClass,
} from './pitch'

export { LINE_NOTE_VALUES, LINE_TUPLETS }

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const DEFAULT_VALUE: LineNoteValue = 4
/** Guitar written pitch is one octave above the sounding note. */
export const GUITAR_WRITTEN_OCTAVE = 12

export interface LineStaffNote {
  note: LineNote
  midi: number
  writtenMidi: number
  name: string
  letter: string
  accidental: string
  octave: number
  /** Diatonic staff step: C0 = 0, D0 = 1, … */
  step: number
  value: LineNoteValue
  tuplet?: LineTuplet
  beats: number
}

/** A bracketed run of tuplet notes. Both ends are inclusive. */
export interface LineTupletGroup {
  tuplet: LineTuplet
  start: number
  end: number
}

/** One written event, possibly several pitches on the same beat. */
export interface LineStaffColumn {
  index: number
  voices: LineStaffNote[]
  value: LineNoteValue
  tuplet?: LineTuplet
  beats: number
}

export function lineNoteValue(note: LineNote): LineNoteValue {
  return isLineNoteValue(note.value) ? note.value : DEFAULT_VALUE
}

export function lineNoteTuplet(note: LineNote): LineTuplet | undefined {
  return isLineTuplet(note.tuplet) ? note.tuplet : undefined
}

/** A tuplet of n fills the time of the nearest power of two below it: 3 in 2, 6 in 4. */
export function tupletNormal(tuplet: LineTuplet): number {
  let normal = 1
  while (normal * 2 < tuplet) normal *= 2
  return normal
}

/** Beats in 4/4: a quarter is 1, a whole is 4. */
export function lineNoteBeats(note: LineNote): number {
  const beats = 4 / lineNoteValue(note)
  const tuplet = lineNoteTuplet(note)
  return tuplet ? beats * (tupletNormal(tuplet) / tuplet) : beats
}

export function lineNotationBeats(notes: readonly LineNote[]): number {
  const total = notes.reduce((sum, note) => sum + lineNoteBeats(note), 0)
  return Math.round(total * 1e6) / 1e6
}

/** Beat counts as a reader expects them: "1", "1.5", "0.67". */
export function beatsLabel(beats: number): string {
  return Number.isInteger(beats)
    ? String(beats)
    : String(Math.round(beats * 100) / 100)
}

/** Consecutive tuplet notes, cut into groups of the tuplet's own size. */
export function tupletGroups(notes: readonly LineNote[]): LineTupletGroup[] {
  const groups: LineTupletGroup[] = []
  notes.forEach((note, index) => {
    const tuplet = lineNoteTuplet(note)
    if (!tuplet) return
    const open = groups[groups.length - 1]
    if (
      open &&
      open.tuplet === tuplet &&
      open.end === index - 1 &&
      open.end - open.start + 1 < tuplet
    ) {
      open.end = index
      return
    }
    groups.push({ tuplet, start: index, end: index })
  })
  return groups
}

export function moveLineNote(
  notes: readonly LineNote[],
  from: number,
  to: number
): LineNote[] {
  if (
    from < 0 ||
    to < 0 ||
    from >= notes.length ||
    to >= notes.length ||
    from === to
  ) {
    return [...notes]
  }
  const next = [...notes]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function setLineNoteValue(
  notes: readonly LineNote[],
  index: number,
  value: LineNoteValue
): LineNote[] {
  return notes.map((note, i) => {
    if (i !== index) return note
    if (value === DEFAULT_VALUE) {
      if (note.value === undefined) return note
      const { value: _dropped, ...rest } = note
      return rest
    }
    return { ...note, value }
  })
}

export function setLineNoteTuplet(
  notes: readonly LineNote[],
  index: number,
  tuplet: LineTuplet | undefined
): LineNote[] {
  return notes.map((note, i) => {
    if (i !== index) return note
    if (tuplet === undefined) {
      if (note.tuplet === undefined) return note
      const { tuplet: _dropped, ...rest } = note
      return rest
    }
    return { ...note, tuplet }
  })
}

export function lineStaffNote(
  note: LineNote,
  rootName?: string
): LineStaffNote {
  const midi = STANDARD_TUNING[note.string] + note.fret
  const writtenMidi = midi + GUITAR_WRITTEN_OCTAVE
  const spelled = spellPitchClass(midiToPitchClass(writtenMidi), rootName)
  const letter = spelled[0] ?? 'C'
  const accidental = spelled.slice(1).replace('#', '♯').replace('b', '♭')
  const octave = midiToOctave(writtenMidi)
  const letterIndex = LETTERS.indexOf(letter as (typeof LETTERS)[number])
  const step = octave * 7 + (letterIndex >= 0 ? letterIndex : 0)
  const value = lineNoteValue(note)
  return {
    note,
    midi,
    writtenMidi,
    name: `${letter}${accidental}${octave}`,
    letter,
    accidental,
    octave,
    step,
    value,
    tuplet: lineNoteTuplet(note),
    beats: lineNoteBeats(note),
  }
}

export function lineStaffNotes(
  notes: readonly LineNote[],
  rootName?: string
): LineStaffNote[] {
  return notes.map((note) => lineStaffNote(note, rootName))
}

export function lineStaffColumns(
  notes: readonly LineNote[],
  rootName?: string
): LineStaffColumn[] {
  return notes.map((note, index) => {
    const voices = lineNotePitches(note)
      .map((pitch) =>
        lineStaffNote(
          {
            ...note,
            string: pitch.string,
            fret: pitch.fret,
            stack: undefined,
          },
          rootName
        )
      )
      .sort((a, b) => a.step - b.step)
    return {
      index,
      voices,
      value: lineNoteValue(note),
      tuplet: lineNoteTuplet(note),
      beats: lineNoteBeats(note),
    }
  })
}

export function columnLabel(column: LineStaffColumn): string {
  return column.voices.map((voice) => voice.name).join('/')
}

export function lineNotationLabel(notes: readonly LineNote[], rootName?: string): string {
  return lineStaffColumns(notes, rootName)
    .map(
      (column) =>
        `${columnLabel(column)} ${valueGlyph(column.value)}${
          column.tuplet ? `·${column.tuplet}` : ''
        }`
    )
    .join('  ')
}

export function valueGlyph(value: LineNoteValue): string {
  switch (value) {
    case 1:
      return '𝅝'
    case 2:
      return '𝅗'
    case 4:
      return '♩'
    case 8:
      return '♪'
    case 16:
      return '♬'
  }
}

export function valueLabel(value: LineNoteValue): string {
  switch (value) {
    case 1:
      return 'Whole'
    case 2:
      return 'Half'
    case 4:
      return 'Quarter'
    case 8:
      return 'Eighth'
    case 16:
      return 'Sixteenth'
  }
}

export function tupletLabel(tuplet: LineTuplet): string {
  switch (tuplet) {
    case 3:
      return 'Triplet'
    case 5:
      return 'Quintuplet'
    case 6:
      return 'Sextuplet'
    case 7:
      return 'Septuplet'
  }
}

/** Staff-line steps that need ledger lines for this pitch. */
export function ledgerSteps(step: number): number[] {
  const lines: number[] = []
  if (step < TREBLE_BOTTOM) {
    for (let s = TREBLE_BOTTOM - 2; s >= step; s -= 2) lines.push(s)
  }
  if (step > TREBLE_TOP) {
    for (let s = TREBLE_TOP + 2; s <= step; s += 2) lines.push(s)
  }
  return lines
}

/** Bottom line of treble staff (E4 written). */
export const TREBLE_BOTTOM = 4 * 7 + 2
/** Top line of treble staff (F5 written). */
export const TREBLE_TOP = 5 * 7 + 3
/** B4 written — notes here and below get up-stems. */
export const STEM_SPLIT = 4 * 7 + 6
