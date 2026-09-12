import { describe, expect, it } from 'vitest'

import {
  beatsLabel,
  columnLabel,
  ledgerSteps,
  lineNotationBeats,
  lineNotationLabel,
  lineStaffColumns,
  lineStaffNote,
  moveLineNote,
  setLineNoteTuplet,
  setLineNoteValue,
  STEM_SPLIT,
  TREBLE_BOTTOM,
  TREBLE_TOP,
  tupletGroups,
  tupletNormal,
} from './lineNotation'

describe('line notation', () => {
  it('spells guitar written pitch an octave above the sounding note', () => {
    const openE = lineStaffNote({ string: 0, fret: 0 })
    expect(openE.midi).toBe(40)
    expect(openE.writtenMidi).toBe(52)
    expect(openE.name).toBe('E3')
    expect(openE.step).toBe(3 * 7 + 2)

    const highB = lineStaffNote({ string: 5, fret: 7 })
    expect(highB.name).toBe('B5')
  })

  it('uses flat spellings when the group key is on the flat side', () => {
    const note = lineStaffNote({ string: 4, fret: 1 }, 'Bb')
    expect(note.name).toBe('C5')
    const eb = lineStaffNote({ string: 3, fret: 8 }, 'Eb')
    expect(eb.accidental).toBe('♭')
    expect(eb.letter).toBe('E')
  })

  it('counts written beats from note values', () => {
    expect(
      lineNotationBeats([
        { string: 5, fret: 0, value: 4 },
        { string: 5, fret: 3, value: 8 },
        { string: 5, fret: 5, value: 8 },
      ])
    ).toBe(2)
  })

  it('reorders and sets durations without dropping frets', () => {
    const notes = [
      { string: 5, fret: 0 },
      { string: 5, fret: 3 },
      { string: 5, fret: 5 },
    ]
    expect(moveLineNote(notes, 0, 2)).toEqual([
      { string: 5, fret: 3 },
      { string: 5, fret: 5 },
      { string: 5, fret: 0 },
    ])
    expect(setLineNoteValue(notes, 1, 8)).toEqual([
      { string: 5, fret: 0 },
      { string: 5, fret: 3, value: 8 },
      { string: 5, fret: 5 },
    ])
    expect(setLineNoteValue([{ string: 5, fret: 3, value: 8 }], 0, 4)).toEqual([
      { string: 5, fret: 3 },
    ])
  })

  it('writes stacked pitches in one column without extra beats', () => {
    const notes = [
      {
        string: 5,
        fret: 0,
        value: 4 as const,
        stack: [{ string: 4, fret: 0 }],
      },
    ]
    expect(lineNotationBeats(notes)).toBe(1)
    const [column] = lineStaffColumns(notes)
    expect(column.voices).toHaveLength(2)
    expect(columnLabel(column)).toMatch(/B4\/E5|E5\/B4/)
  })

  it('fits a tuplet into the time of the power of two below it', () => {
    expect(tupletNormal(3)).toBe(2)
    expect(tupletNormal(5)).toBe(4)
    expect(tupletNormal(6)).toBe(4)
    expect(tupletNormal(7)).toBe(4)

    const triplet = { string: 5, fret: 0, value: 8, tuplet: 3 } as const
    expect(lineNotationBeats([triplet, triplet, triplet])).toBe(1)
    const sextuplet = { string: 5, fret: 0, value: 16, tuplet: 6 } as const
    expect(lineNotationBeats(Array(6).fill(sextuplet))).toBe(1)
  })

  it('brackets consecutive tuplet notes in groups of their own size', () => {
    const trip = (fret: number) =>
      ({ string: 5, fret, value: 8, tuplet: 3 }) as const
    expect(
      tupletGroups([
        { string: 5, fret: 0 },
        trip(1),
        trip(2),
        trip(3),
        trip(4),
        trip(5),
        { string: 5, fret: 6 },
        trip(7),
      ])
    ).toEqual([
      { tuplet: 3, start: 1, end: 3 },
      { tuplet: 3, start: 4, end: 5 },
      { tuplet: 3, start: 7, end: 7 },
    ])
  })

  it('sets and clears a note tuplet', () => {
    const notes = [
      { string: 5, fret: 0 },
      { string: 5, fret: 3, value: 8 as const },
    ]
    expect(setLineNoteTuplet(notes, 1, 3)).toEqual([
      { string: 5, fret: 0 },
      { string: 5, fret: 3, value: 8, tuplet: 3 },
    ])
    expect(
      setLineNoteTuplet([{ string: 5, fret: 3, tuplet: 3 }], 0, undefined)
    ).toEqual([{ string: 5, fret: 3 }])
  })

  it('writes beat counts without float dust', () => {
    expect(beatsLabel(1)).toBe('1')
    expect(beatsLabel(1.5)).toBe('1.5')
    expect(beatsLabel(2 / 3)).toBe('0.67')
  })

  it('asks for ledger lines only outside the treble staff', () => {
    expect(TREBLE_BOTTOM).toBeLessThan(STEM_SPLIT)
    expect(TREBLE_TOP).toBeGreaterThan(STEM_SPLIT)
    expect(ledgerSteps(TREBLE_BOTTOM)).toEqual([])
    expect(ledgerSteps(TREBLE_BOTTOM - 1)).toEqual([])
    expect(ledgerSteps(TREBLE_BOTTOM - 2)).toEqual([TREBLE_BOTTOM - 2])
    expect(ledgerSteps(TREBLE_TOP + 2)).toEqual([TREBLE_TOP + 2])
  })

  it('writes a compact phrase label', () => {
    expect(
      lineNotationLabel([
        { string: 5, fret: 0 },
        { string: 5, fret: 3, value: 8 },
      ])
    ).toMatch(/E5 ♩/)
  })
})
