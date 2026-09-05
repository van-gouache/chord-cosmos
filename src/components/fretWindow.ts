import { MAX_PLAYABLE_FRET, type Fingering } from '../theory/fretboard'

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

export interface DiagramFretWindow extends FretWindow {
  canExtendLow: boolean
  canExtendHigh: boolean
}

/** Tight voicing box, then extra rows for outlines and user expand buttons. */
export function diagramFretWindow(
  fingering: Fingering,
  options: {
    highlightedFrets?: readonly number[]
    extendLow?: number
    extendHigh?: number
    maxFret?: number
  } = {}
): DiagramFretWindow {
  const maxFret = options.maxFret ?? MAX_PLAYABLE_FRET
  const base = fretWindow(fingering)
  const extras = (options.highlightedFrets ?? []).filter((fret) => fret > 0)
  let lo = extras.length > 0 ? Math.min(base.startFret, ...extras) : base.startFret
  let hi =
    extras.length > 0
      ? Math.max(base.startFret + base.fretRows - 1, ...extras)
      : base.startFret + base.fretRows - 1
  lo = Math.max(1, lo - Math.max(0, options.extendLow ?? 0))
  hi = Math.min(maxFret, hi + Math.max(0, options.extendHigh ?? 0))
  if (hi < lo) hi = lo
  return {
    startFret: lo,
    fretRows: Math.max(4, hi - lo + 1),
    showNut: lo === 1,
    canExtendLow: lo > 1,
    canExtendHigh: hi < maxFret,
  }
}
