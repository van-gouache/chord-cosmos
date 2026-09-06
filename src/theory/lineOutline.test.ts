import { describe, expect, it } from 'vitest'

import {
  LINE_GROUP_ID,
  lineMidiNotes,
  readLineNotes,
  toggleLineNote,
} from './lineOutline'

describe('line outlines', () => {
  it('adds and removes frets as an unordered set', () => {
    const first = toggleLineNote(undefined, { string: 5, fret: 7 })
    const second = toggleLineNote(first, { string: 4, fret: 8 })
    const third = toggleLineNote(second, { string: 5, fret: 10 })
    expect(third).toEqual([
      { string: 4, fret: 8 },
      { string: 5, fret: 7 },
      { string: 5, fret: 10 },
    ])
    expect(toggleLineNote(third, { string: 4, fret: 8 })).toEqual([
      { string: 5, fret: 7 },
      { string: 5, fret: 10 },
    ])
  })

  it('sorts stored notes by string then fret', () => {
    expect(
      readLineNotes([
        { string: 5, fret: 7 },
        { string: 2, fret: 5 },
        { string: 5, fret: 7 },
        { string: 1, fret: 3 },
      ])
    ).toEqual([
      { string: 1, fret: 3 },
      { string: 2, fret: 5 },
      { string: 5, fret: 7 },
    ])
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
