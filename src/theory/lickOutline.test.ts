import { describe, expect, it } from 'vitest'

import { parseChord } from './chords'
import { findFingerings } from './fretboard'
import { LICK_FRET_PAD, lickOutlineNotes } from './lickOutline'
import { buildShape, V_GROUPS_BY_ID } from './vsystem'

describe('lick outline notes', () => {
  it('offers nearby Em7 chord tones that are not already in the grip', () => {
    const chord = parseChord('E-7')
    const shape = buildShape(chord.tones, V_GROUPS_BY_ID['V-2'], 0)
    const fingering = findFingerings(shape, chord.rootPc)[0]
    expect(fingering).toBeTruthy()

    const notes = lickOutlineNotes(fingering, chord)
    const occupied = new Set(
      fingering.notes.map((note) => `${note.string}:${note.fret}`)
    )
    expect(notes.length).toBeGreaterThan(0)
    expect(notes.every((note) => !occupied.has(`${note.string}:${note.fret}`))).toBe(
      true
    )
    expect(notes.some((note) => note.degree === 'R' && note.name === 'E')).toBe(
      true
    )
    expect(
      notes.every((note) => ['R', '♭3', '5', '♭7'].includes(note.degree))
    ).toBe(true)
  })

  it('still puts chord tones on the high E when the grip uses the low strings', () => {
    const chord = parseChord('E-7')
    const shape = buildShape(chord.tones, V_GROUPS_BY_ID['V-2'], 0)
    const fingering = findFingerings(shape, chord.rootPc).find(
      (option) => option.strings[5] === null
    )
    expect(fingering).toBeTruthy()
    const highE = lickOutlineNotes(fingering!, chord).filter(
      (note) => note.string === 5
    )
    expect(highE.length).toBeGreaterThan(0)
  })

  it('uses only the chord’s four tones, not omitted extensions', () => {
    const chord = parseChord('E13')
    expect(chord.tones.map((tone) => tone.degree)).toEqual(['R', '3', '13', '♭7'])
    expect(chord.allTones.map((tone) => tone.degree)).toEqual(
      expect.arrayContaining(['5', '9'])
    )

    const shape = buildShape(chord.tones, V_GROUPS_BY_ID['V-2'], 0)
    const fingering = findFingerings(shape, chord.rootPc)[0]
    const notes = lickOutlineNotes(fingering, chord)
    const allowed = new Set(chord.tones.map((tone) => tone.degree))

    expect(notes.length).toBeGreaterThan(0)
    expect(notes.every((note) => allowed.has(note.degree))).toBe(true)
    expect(notes.some((note) => note.degree === '5' || note.degree === '9')).toBe(
      false
    )
  })

  it('stays inside a padded fret window around the grip', () => {
    const chord = parseChord('A7')
    const shape = buildShape(chord.tones, V_GROUPS_BY_ID['V-2'], 0)
    const fingering = findFingerings(shape, chord.rootPc)[0]
    const notes = lickOutlineNotes(fingering, chord)
    const lo = Math.min(...fingering.notes.map((note) => note.fret)) - LICK_FRET_PAD
    const hi = Math.max(...fingering.notes.map((note) => note.fret)) + LICK_FRET_PAD
    for (const note of notes) {
      expect(note.fret).toBeGreaterThanOrEqual(Math.max(0, lo))
      expect(note.fret).toBeLessThanOrEqual(hi)
    }
  })
})
