/**
 * Circle-of-fifths placement of a chord root relative to a key center.
 * Clockwise is the sharp / dominant side; counterclockwise is flats.
 */

import { mod12, parseNoteName } from './pitch'

/** Note names around the circle, starting at C and moving by fifths. */
export const CIRCLE_NAMES = [
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'F#',
  'Db',
  'Ab',
  'Eb',
  'Bb',
  'F',
] as const

/** Scale-degree labels from the tonic, clockwise by fifths. */
export const FIFTHS_DEGREE = [
  'I',
  'V',
  'II',
  'VI',
  'III',
  'VII',
  '♯IV',
  '♭II',
  '♭VI',
  '♭III',
  '♭VII',
  'IV',
] as const

/** How many fifths clockwise from C to this pitch class. */
export function fifthsFromC(pc: number): number {
  return mod12(mod12(pc) * 7)
}

/** Fifths clockwise from the key center to the chord root (0–11). */
export function fifthsFromKey(keyPc: number, chordPc: number): number {
  return mod12(fifthsFromC(chordPc) - fifthsFromC(keyPc))
}

/**
 * Fifths-function label at a C-top wheel slot (`0` = C, clockwise).
 * The wheel itself does not rotate with the key.
 */
export function fifthsDegreeAtSlot(
  keyPc: number,
  slotFromC: number,
): (typeof FIFTHS_DEGREE)[number] {
  return FIFTHS_DEGREE[fifthsFromKey(keyPc, mod12(slotFromC * 7))]
}

export function circleNameForPc(pc: number): string {
  return CIRCLE_NAMES[fifthsFromC(pc)]
}

export function parseRootPc(name: string): number | null {
  return parseNoteName(name)?.pc ?? null
}

export function circleRelation(steps: number): {
  degree: (typeof FIFTHS_DEGREE)[number]
  side: 'tonic' | 'sharp' | 'flat'
  hops: number
} {
  const degree = FIFTHS_DEGREE[mod12(steps)]
  if (steps === 0) return { degree, side: 'tonic', hops: 0 }
  if (steps <= 6) return { degree, side: 'sharp', hops: steps }
  return { degree, side: 'flat', hops: 12 - steps }
}

export function circleCaption(
  keyName: string,
  chordRootName: string,
  steps: number
): string {
  const { degree, side, hops } = circleRelation(steps)
  if (side === 'tonic') {
    return `${chordRootName} is the key center (${degree}) in ${keyName}`
  }
  const dir = side === 'sharp' ? 'sharp' : 'flat'
  const fifths = hops === 1 ? '1 fifth' : `${hops} fifths`
  return `${chordRootName} is ${degree} of ${keyName} · ${fifths} ${dir}`
}
