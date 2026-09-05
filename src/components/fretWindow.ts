import type { Fingering } from '../theory/fretboard'

export interface FretWindow {
  /** First fret drawn in the box. */
  startFret: number
  /** How many fret cells the box has. */
  fretRows: number
  /** Whether to draw the thick nut line at the top. */
  showNut: boolean
}

/**
 * Chooses the range of frets a chord box should show.
 *
 * Shapes that use open strings are drawn from the nut so the `o` markers line
 * up with the frets below them; everything else starts at its own lowest fret
 * to keep the box tight. The window is always tall enough to contain the
 * highest note, so a dot can never fall outside the grid.
 */
export function fretWindow(fingering: Fingering): FretWindow {
  const highest = fingering.highestFret
  if (highest === 0) return { startFret: 1, fretRows: 4, showNut: true }

  const hasOpenString = fingering.notes.some((n) => n.fret === 0)
  const startFret =
    hasOpenString && highest <= 5 ? 1 : Math.max(1, fingering.lowestFret)

  return {
    startFret,
    fretRows: Math.max(4, highest - startFret + 1),
    showNut: startFret === 1,
  }
}
