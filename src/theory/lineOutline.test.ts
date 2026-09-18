import { describe, expect, it } from 'vitest'

import {
  LINE_GROUP_ID,
  appendLineNote,
  flattenLinePitches,
  insertLineRest,
  lineMidiNotes,
  placeLineNote,
  readLineNotes,
  removeLineNoteAt,
  setLineNoteRhythm,
  stackLineNote,
} from './lineOutline'

describe('line outlines', () => {
  it('appends frets in click order, including repeats', () => {
    const first = appendLineNote(undefined, { string: 5, fret: 7, value: 8 })
    const second = appendLineNote(first, { string: 4, fret: 8 })
    const third = appendLineNote(second, { string: 5, fret: 7, value: 16 })
    expect(third).toEqual([
      { string: 5, fret: 7, value: 8 },
      { string: 4, fret: 8 },
      { string: 5, fret: 7, value: 16 },
    ])
    expect(removeLineNoteAt(third, 0)).toEqual([
      { string: 4, fret: 8 },
      { string: 5, fret: 7, value: 16 },
    ])
  })

  it('keeps stored order, durations, and repeated frets', () => {
    expect(
      readLineNotes([
        { string: 5, fret: 7, value: 8 },
        { string: 2, fret: 5 },
        { string: 5, fret: 7 },
        { string: 1, fret: 3 },
      ])
    ).toEqual([
      { string: 5, fret: 7, value: 8 },
      { string: 2, fret: 5 },
      { string: 5, fret: 7 },
      { string: 1, fret: 3 },
    ])
  })

  it('keeps tuplets through append and read, ignoring odd values', () => {
    expect(
      appendLineNote(undefined, { string: 5, fret: 7, value: 8, tuplet: 3 })
    ).toEqual([{ string: 5, fret: 7, value: 8, tuplet: 3 }])
    expect(
      readLineNotes([
        { string: 5, fret: 7, value: 16, tuplet: 6 },
        { string: 5, fret: 5, tuplet: 4 },
        { string: 4, fret: 8, value: 32 },
      ])
    ).toEqual([
      { string: 5, fret: 7, value: 16, tuplet: 6 },
      { string: 5, fret: 5 },
      { string: 4, fret: 8, value: 32 },
    ])
  })

  it('stacks extra pitches on a written event without adding duration', () => {
    const first = appendLineNote(undefined, { string: 5, fret: 7, value: 8 })
    const stacked = stackLineNote(first, 0, { string: 4, fret: 8 })
    expect(stacked).toEqual([
      { string: 5, fret: 7, value: 8, stack: [{ string: 4, fret: 8 }] },
    ])
    expect(flattenLinePitches(stacked)).toEqual([
      { string: 5, fret: 7, at: 1 },
      { string: 4, fret: 8, at: 1 },
    ])
    expect(
      placeLineNote(stacked, { string: 3, fret: 9 }, { stack: true, at: 0 })
    ).toEqual([
      {
        string: 5,
        fret: 7,
        value: 8,
        stack: [
          { string: 4, fret: 8 },
          { string: 3, fret: 9 },
        ],
      },
    ])
    expect(stackLineNote(stacked, 0, { string: 4, fret: 8 })).toEqual([
      { string: 5, fret: 7, value: 8 },
    ])
    expect(stackLineNote(stacked, 0, { string: 4, fret: 9 })).toEqual([
      { string: 5, fret: 7, value: 8, stack: [{ string: 4, fret: 9 }] },
    ])
  })

  it('keeps stacked pitches through read', () => {
    expect(
      readLineNotes([
        {
          string: 5,
          fret: 7,
          value: 8,
          stack: [{ string: 4, fret: 8 }, { string: 4, fret: 9 }],
        },
      ])
    ).toEqual([
      { string: 5, fret: 7, value: 8, stack: [{ string: 4, fret: 8 }] },
    ])
  })

  it('rewrites one event duration without moving pitches', () => {
    const notes = [
      { string: 5, fret: 7, value: 8 as const },
      { string: 4, fret: 8, stack: [{ string: 3, fret: 9 }] },
    ]
    expect(setLineNoteRhythm(notes, 1, { value: 16, tuplet: 6 })).toEqual([
      { string: 5, fret: 7, value: 8 },
      {
        string: 4,
        fret: 8,
        value: 16,
        tuplet: 6,
        stack: [{ string: 3, fret: 9 }],
      },
    ])
    expect(setLineNoteRhythm(notes, 0, { value: 4 })).toEqual([
      { string: 5, fret: 7 },
      { string: 4, fret: 8, stack: [{ string: 3, fret: 9 }] },
    ])
    expect(
      setLineNoteRhythm([{ string: 5, fret: 7, value: 8, tuplet: 3 }], 0, {
        value: 16,
      })
    ).toEqual([{ string: 5, fret: 7, value: 16, tuplet: 3 }])
    expect(
      setLineNoteRhythm([{ string: 5, fret: 7, value: 8, tuplet: 3 }], 0, {
        tuplet: undefined,
      })
    ).toEqual([{ string: 5, fret: 7, value: 8 }])
    expect(setLineNoteRhythm(notes, 9, { value: 2 })).toEqual(notes)
  })

  it('inserts rests that take time but have no pitch', () => {
    const notes = [{ string: 5, fret: 7 }]
    expect(insertLineRest(notes, { value: 8 }, 0)).toEqual([
      { string: 5, fret: 7 },
      { rest: true, value: 8 },
    ])
    expect(insertLineRest(undefined, { value: 2 })).toEqual([{ rest: true, value: 2 }])
    expect(
      readLineNotes([{ rest: true, value: 8 }, { string: 5, fret: 7 }, { rest: true }])
    ).toEqual([{ rest: true, value: 8 }, { string: 5, fret: 7 }, { rest: true }])
    expect(
      flattenLinePitches([
        { string: 5, fret: 7 },
        { rest: true, value: 8 },
        { string: 4, fret: 8 },
      ])
    ).toEqual([
      { string: 5, fret: 7, at: 1 },
      { string: 4, fret: 8, at: 3 },
    ])
    expect(
      stackLineNote([{ rest: true, value: 8 }], 0, { string: 5, fret: 7 })
    ).toEqual([{ string: 5, fret: 7, value: 8 }])
  })

  it('maps line notes to MIDI in order', () => {
    expect(
      lineMidiNotes([
        { string: 0, fret: 0 },
        { string: 5, fret: 5 },
      ])
    ).toEqual([40, 69])
  })

  it('uses a dedicated group id', () => {
    expect(LINE_GROUP_ID).toBe('Line')
  })
})
