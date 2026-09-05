/**
 * Fretboard search: turning an abstract voicing into actual guitar fingerings.
 *
 * A V-System voicing is four ascending pitches, so on the guitar each note sits
 * on its own string and the strings ascend too. That makes the search small
 * enough to be exhaustive: try every four-string combination at every position.
 */

import { midiToName, mod12 } from './pitch'
import type { VoicingShape } from './vsystem'

/** Open-string MIDI notes in standard tuning, low E first. */
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64]

export const STRING_COUNT = 6

/** Highest fret the search will use. */
export const DEFAULT_MAX_FRET = 15

/** Highest fret a user-shifted (octave) shape may sit on. */
export const MAX_PLAYABLE_FRET = 24

/** Frets in one octave on a guitar. */
export const OCTAVE_FRETS = 12

/** Widest fret span a fingering may need before it's discarded. */
export const MAX_FRET_SPAN = 5

export interface FretNote {
  /** 0 = low E, 5 = high E. */
  string: number
  /** 0 = open. */
  fret: number
  midi: number
  /** Which voice this note is: 0 = bass ... 3 = soprano. */
  voice: number
}

export interface Fingering {
  notes: FretNote[]
  /** Per string (low E first): fret number, or null if the string is muted. */
  strings: (number | null)[]
  /** Lowest fretted fret; 0 when the shape uses only open strings. */
  lowestFret: number
  highestFret: number
  /** Distance between the lowest and highest fretted note. */
  span: number
  /** Fret to barre with the index finger, if the shape needs one. */
  barreFret: number | null
  fingersNeeded: number
  /** Muted strings that fall between played strings and must be damped. */
  innerMutes: number[]
  /** Roughly which neck position the shape sits in. */
  position: number
  /** Lower is easier to play. */
  difficulty: number
  midiNotes: number[]
}

export interface SearchOptions {
  maxFret?: number
  maxSpan?: number
  /** Lowest MIDI note allowed in the bass; defaults to the guitar's low E. */
  minBass?: number
}

/**
 * Works out how the fretting hand would hold a set of notes, and how hard that
 * is. Returns null when the shape can't be played.
 */
function evaluateFingering(
  notes: FretNote[],
  maxSpan: number
): Fingering | null {
  const fretted = notes.filter((n) => n.fret > 0)

  const lowestFret = fretted.length ? Math.min(...fretted.map((n) => n.fret)) : 0
  const highestFret = fretted.length ? Math.max(...fretted.map((n) => n.fret)) : 0
  const span = fretted.length ? highestFret - lowestFret : 0
  if (span > maxSpan) return null

  // Group fretted notes by fret. Several notes on one fret need either a barre
  // (only possible at the lowest fret, with the index finger) or a finger each.
  const byFret = new Map<number, FretNote[]>()
  for (const note of fretted) {
    const list = byFret.get(note.fret) ?? []
    list.push(note)
    byFret.set(note.fret, list)
  }

  let fingersNeeded = 0
  let barreFret: number | null = null
  for (const [fret, group] of byFret) {
    if (group.length > 1 && fret === lowestFret) {
      barreFret = fret
      fingersNeeded += 1
    } else {
      fingersNeeded += group.length
    }
  }
  if (fingersNeeded > 4) return null

  const usedStrings = notes.map((n) => n.string)
  const minString = Math.min(...usedStrings)
  const maxString = Math.max(...usedStrings)
  const innerMutes: number[] = []
  for (let s = minString + 1; s < maxString; s++) {
    if (!usedStrings.includes(s)) innerMutes.push(s)
  }

  const strings: (number | null)[] = Array(STRING_COUNT).fill(null)
  for (const note of notes) strings[note.string] = note.fret

  // A rough playability cost. The weights are tuned so the shapes a guitarist
  // would actually reach for float to the top of the list.
  let difficulty = 0
  difficulty += span * 2.5
  difficulty += Math.max(0, fingersNeeded - 3) * 2
  difficulty += innerMutes.length * 3
  if (barreFret !== null) difficulty += 1.5
  if (span >= 4) difficulty += 3
  if (lowestFret > 12) difficulty += 2
  // Very low fretted stretches are harder than the same span up the neck.
  if (lowestFret > 0 && lowestFret <= 3 && span >= 3) difficulty += 2
  difficulty -= notes.filter((n) => n.fret === 0).length * 0.5

  return {
    notes,
    strings,
    lowestFret,
    highestFret,
    span,
    barreFret,
    fingersNeeded,
    innerMutes,
    position: lowestFret === 0 ? 0 : lowestFret,
    difficulty: Math.round(difficulty * 10) / 10,
    midiNotes: notes.map((n) => n.midi),
  }
}

/** Ascending k-string subsets of the six strings. */
function stringSetsOf(voices: number): number[][] {
  const sets: number[][] = []
  const pick = (start: number, acc: number[]) => {
    if (acc.length === voices) {
      sets.push([...acc])
      return
    }
    for (let i = start; i < STRING_COUNT; i++) pick(i + 1, [...acc, i])
  }
  pick(0, [])
  return sets
}

/**
 * Finds every playable fingering of an interval stack whose bass matches
 * `bassPc`. Works for three- or four-voice shapes.
 */
export function findIntervalFingerings(
  intervals: number[],
  bassPc: number,
  options: SearchOptions = {}
): Fingering[] {
  const voices = intervals.length
  if (voices < 2) return []

  const maxFret = options.maxFret ?? DEFAULT_MAX_FRET
  const maxSpan = options.maxSpan ?? MAX_FRET_SPAN
  const minBass = options.minBass ?? STANDARD_TUNING[0]
  const highestPossible = STANDARD_TUNING[STRING_COUNT - 1] + maxFret
  const sets = stringSetsOf(voices)
  const results: Fingering[] = []

  for (let bassMidi = minBass; bassMidi <= highestPossible; bassMidi++) {
    if (mod12(bassMidi) !== bassPc) continue

    const targetMidis = intervals.map((i) => bassMidi + i)
    if (targetMidis[voices - 1] > highestPossible) break

    for (const set of sets) {
      const notes: FretNote[] = []
      let ok = true

      for (let voice = 0; voice < voices; voice++) {
        const string = set[voice]
        const fret = targetMidis[voice] - STANDARD_TUNING[string]
        if (fret < 0 || fret > maxFret) {
          ok = false
          break
        }
        notes.push({ string, fret, midi: targetMidis[voice], voice })
      }
      if (!ok) continue

      const fingering = evaluateFingering(notes, maxSpan)
      if (fingering) results.push(fingering)
    }
  }

  results.sort(
    (a, b) => a.difficulty - b.difficulty || a.lowestFret - b.lowestFret
  )
  return results
}

/**
 * Finds every playable fingering of a voicing shape, for a chord rooted on
 * `rootPc`. Results are sorted easiest-first.
 */
export function findFingerings(
  shape: VoicingShape,
  rootPc: number,
  options: SearchOptions = {}
): Fingering[] {
  const bassPc = mod12(rootPc + shape.voiceTones[0].semitones)
  return findIntervalFingerings(shape.intervals, bassPc, options)
}

/** Human-readable string set, e.g. `6-5-4-3` (strings numbered guitar-style). */
export function stringSetLabel(fingering: Fingering): string {
  return fingering.notes.map((n) => STRING_COUNT - n.string).join('-')
}

/** Chord-diagram style text, e.g. `x-7-5-6-5-x`. */
export function tabLabel(fingering: Fingering): string {
  return fingering.strings.map((f) => (f === null ? 'x' : String(f))).join('-')
}

export function fingeringNoteNames(
  fingering: Fingering,
  rootName?: string
): string[] {
  return fingering.notes.map((n) => midiToName(n.midi, rootName))
}

/**
 * How well a fingering represents its voicing group in the preview grid.
 *
 * This is deliberately not the same as {@link Fingering.difficulty}. The
 * easiest Em7 drop-2 to play is four open strings, but that tells you nothing
 * about the shape of a drop-2 — so previews favour movable, mid-neck fingerings
 * that show the group's characteristic pattern. Lower is better.
 */
export function previewScore(fingering: Fingering): number {
  let score = fingering.difficulty

  // Open strings hide the fingering pattern, so undo the difficulty bonus and
  // then some.
  score += fingering.notes.filter((n) => n.fret === 0).length * 3

  // Shapes around the middle of the neck read most clearly in a chord box.
  score +=
    fingering.lowestFret === 0 ? 4 : Math.abs(fingering.lowestFret - 6) * 0.4

  return score
}

/** Descriptive difficulty bucket for the UI. */
export function difficultyLabel(difficulty: number): 'easy' | 'moderate' | 'hard' {
  if (difficulty <= 6) return 'easy'
  if (difficulty <= 13) return 'moderate'
  return 'hard'
}

export function ordinal(n: number): string {
  const teens = n % 100
  if (teens >= 11 && teens <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/**
 * Where the shape sits on the neck. Anything leaning on open strings counts as
 * open position, which is how a guitarist would describe it.
 */
export function positionLabel(fingering: Fingering): string {
  if (fingering.highestFret === 0) return 'open'
  const hasOpenString = fingering.notes.some((n) => n.fret === 0)
  if (hasOpenString && fingering.highestFret <= 4) return 'open pos.'
  return `${ordinal(fingering.lowestFret)} pos.`
}

/** True when the shape is unplayable as written but exists in theory. */
export function isReachable(fingerings: Fingering[]): boolean {
  return fingerings.length > 0
}

/**
 * Same fingering, moved `deltaFrets` (typically ±12). Open strings become
 * fretted at 12 on the way up; the reverse turns 12 back into open.
 */
export function shiftFingering(
  fingering: Fingering,
  deltaFrets: number,
  maxFret = MAX_PLAYABLE_FRET
): Fingering | null {
  if (deltaFrets === 0) return fingering

  const notes: FretNote[] = []
  for (const note of fingering.notes) {
    const fret = note.fret + deltaFrets
    if (fret < 0 || fret > maxFret) return null
    notes.push({
      ...note,
      fret,
      midi: STANDARD_TUNING[note.string] + fret,
    })
  }

  return evaluateFingering(notes, MAX_FRET_SPAN)
}

export function canShiftFingering(
  fingering: Fingering,
  deltaFrets: number,
  maxFret = MAX_PLAYABLE_FRET
): boolean {
  return shiftFingering(fingering, deltaFrets, maxFret) !== null
}

export interface OctaveChoice {
  /** Frets to add to reach this octave from the current fingering. */
  deltaFrets: number
  label: string
}

/** Octaves of this shape that still fit on the neck, current first as `0`. */
export function listOctaveShifts(fingering: Fingering): OctaveChoice[] {
  const choices: OctaveChoice[] = []
  for (const delta of [-24, -12, 0, 12, 24]) {
    const next = shiftFingering(fingering, delta)
    if (!next) continue
    choices.push({ deltaFrets: delta, label: octaveRegisterLabel(next) })
  }
  return choices
}

function octaveRegisterLabel(fingering: Fingering): string {
  if (fingering.lowestFret >= 24) return 'Top'
  if (fingering.lowestFret >= 12) return 'High'
  return 'Low'
}

/** Reads a tab string such as `x-7-9-7-8-x` into per-string frets. */
export function parseTab(tab: string): (number | null)[] | null {
  const parts = tab.trim().split('-')
  if (parts.length !== STRING_COUNT) return null
  const strings: (number | null)[] = []
  for (const part of parts) {
    if (part === 'x' || part === 'X') {
      strings.push(null)
      continue
    }
    const fret = Number(part)
    if (!Number.isInteger(fret) || fret < 0) return null
    strings.push(fret)
  }
  return strings
}

/**
 * Rebuilds a fingering from a stored tab without running the neck search.
 * Needed for octave-shifted shapes that sit above the search's max fret.
 */
export function fingeringFromTab(tab: string): Fingering | null {
  const strings = parseTab(tab)
  if (!strings) return null

  const notes: FretNote[] = []
  let voice = 0
  for (let string = 0; string < STRING_COUNT; string++) {
    const fret = strings[string]
    if (fret === null) continue
    notes.push({
      string,
      fret,
      midi: STANDARD_TUNING[string] + fret,
      voice: voice++,
    })
  }
  if (notes.length < 2) return null
  return evaluateFingering(notes, MAX_FRET_SPAN)
}
