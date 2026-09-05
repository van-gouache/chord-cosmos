/**
 * Pitch primitives. Pitches are MIDI numbers (C4 = 60, A4 = 69 = 440 Hz).
 * Pitch classes are 0-11 with C = 0.
 */

export type PitchClass = number
export type Midi = number

export const SHARP_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

export const FLAT_NAMES = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const

/** Natural letter -> pitch class. */
const LETTER_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

export function mod12(n: number): PitchClass {
  return ((n % 12) + 12) % 12
}

/**
 * Parses a note name such as `C`, `F#`, `Bb`, `Ebb`, `G##`.
 * Returns null when the name is not a valid note.
 */
export function parseNoteName(
  name: string
): { pc: PitchClass; letter: string; accidental: number } | null {
  const match = /^([A-Ga-g])([#b♯♭x]*)$/.exec(name.trim())
  if (!match) return null

  const letter = match[1].toUpperCase()
  let accidental = 0
  for (const ch of match[2]) {
    if (ch === '#' || ch === '♯') accidental += 1
    else if (ch === 'b' || ch === '♭') accidental -= 1
    else if (ch === 'x') accidental += 2
  }

  return { pc: mod12(LETTER_PC[letter] + accidental), letter, accidental }
}

/**
 * Spells a pitch class using the accidental that best fits the key of `rootName`.
 * Flat-side roots get flat spellings so that, say, Eb7 reads Eb G Bb Db.
 */
export function spellPitchClass(pc: PitchClass, rootName?: string): string {
  const preferFlats = rootName
    ? rootName.includes('b') || ['F'].includes(rootName)
    : false
  return preferFlats ? FLAT_NAMES[mod12(pc)] : SHARP_NAMES[mod12(pc)]
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const LETTER_PCS = [0, 2, 4, 5, 7, 9, 11]

/** The diatonic step a degree label refers to: `♭3` -> 3, `♯11` -> 11. */
function degreeStep(degree: string): number {
  const match = /(\d+)/.exec(degree)
  return match ? Number(match[1]) : 1
}

/**
 * Spells a chord tone by its degree rather than by nearest enharmonic, so the
 * ♭5 of Eø7 comes out as B♭ (not A♯) and the ♭♭7 of C°7 as B♭♭.
 *
 * Each degree owns a letter — a 3rd is always two letters up from the root —
 * and the accidental is whatever makes that letter land on the right pitch.
 */
export function spellDegree(
  rootLetter: string,
  degree: string,
  pc: PitchClass
): string {
  const rootIndex = LETTERS.indexOf(rootLetter.toUpperCase() as 'C')
  if (rootIndex < 0) return SHARP_NAMES[mod12(pc)]

  const letterIndex = (rootIndex + degreeStep(degree) - 1) % 7
  const letter = LETTERS[letterIndex]

  // Distance from the natural letter to the tone, as -6..+5 semitones.
  let offset = mod12(pc - LETTER_PCS[letterIndex])
  if (offset > 6) offset -= 12

  const accidental = offset > 0 ? '♯'.repeat(offset) : '♭'.repeat(-offset)
  return `${letter}${accidental}`
}

export function midiToPitchClass(midi: Midi): PitchClass {
  return mod12(midi)
}

export function midiToOctave(midi: Midi): number {
  return Math.floor(midi / 12) - 1
}

export function midiToName(midi: Midi, rootName?: string): string {
  return `${spellPitchClass(mod12(midi), rootName)}${midiToOctave(midi)}`
}

export function midiToFrequency(midi: Midi): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}
