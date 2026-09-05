import { describe, expect, it } from 'vitest'

import { fretWindow } from './fretWindow'
import { parseChord } from '../theory/chords'
import { findFingerings, shiftFingering } from '../theory/fretboard'
import { buildShape, V_GROUPS } from '../theory/vsystem'

describe('chord diagram fret window', () => {
  /**
   * The bug this guards against: a window that is too short pushes dots
   * outside the grid, leaving a diagram that looks blank.
   */
  it('always contains every fretted note, for every chord and group', () => {
    const symbols = ['E-7', 'C7', 'EΔ7', 'Eø7', 'F#dim7', 'Bb6/9', 'G7b9']
    let checked = 0

    for (const symbol of symbols) {
      const chord = parseChord(symbol)
      for (const group of V_GROUPS) {
        for (let inv = 0; inv < 4; inv++) {
          const shape = buildShape(chord.tones, group, inv)
          for (const fingering of findFingerings(shape, chord.rootPc)) {
            const { startFret, fretRows } = fretWindow(fingering)
            const lastFret = startFret + fretRows - 1

            for (const note of fingering.notes) {
              if (note.fret === 0) continue
              expect(
                note.fret,
                `${symbol} ${group.id}/${inv} fret ${note.fret} outside window ${startFret}-${lastFret}`
              ).toBeGreaterThanOrEqual(startFret)
              expect(note.fret).toBeLessThanOrEqual(lastFret)
            }
            checked++
          }
        }
      }
    }

    expect(checked).toBeGreaterThan(500)
  })

  it('draws open-string shapes from the nut', () => {
    const chord = parseChord('E-7')
    const shape = buildShape(chord.tones, V_GROUPS[1], 0)
    const openShape = findFingerings(shape, chord.rootPc).find((f) =>
      f.notes.some((n) => n.fret === 0)
    )
    expect(openShape).toBeDefined()
    const window = fretWindow(openShape!)
    expect(window.startFret).toBe(1)
    expect(window.showNut).toBe(true)
  })

  it('starts an octave-shifted open shape at the twelfth fret', () => {
    const chord = parseChord('E-7')
    const shape = buildShape(chord.tones, V_GROUPS[1], 0)
    const openShape = findFingerings(shape, chord.rootPc).find((f) =>
      f.notes.some((n) => n.fret === 0)
    )
    expect(openShape).toBeDefined()
    const up = shiftFingering(openShape!, 12)
    expect(up).not.toBeNull()
    const window = fretWindow(up!)
    expect(window.startFret).toBe(up!.lowestFret)
    expect(window.startFret).toBeGreaterThanOrEqual(12)
    expect(window.showNut).toBe(false)
  })

  it('keeps the box tight around shapes up the neck', () => {
    const chord = parseChord('E-7')
    const shape = buildShape(chord.tones, V_GROUPS[1], 0)
    const highShape = findFingerings(shape, chord.rootPc).find(
      (f) => f.lowestFret >= 7 && !f.notes.some((n) => n.fret === 0)
    )
    expect(highShape).toBeDefined()
    const window = fretWindow(highShape!)
    expect(window.startFret).toBe(highShape!.lowestFret)
    expect(window.showNut).toBe(false)
    expect(window.fretRows).toBeLessThanOrEqual(6)
  })
})
