/**
 * Hand-built guitar shapes: notes placed on the fretboard, then turned into
 * a voicing the sequencer can store and play.
 */

import {
  formatCustomSymbol,
  INTERVAL_OPTIONS,
  tryParseChord,
} from './chords'
import {
  MAX_PLAYABLE_FRET,
  parseTab,
  STANDARD_TUNING,
  STRING_COUNT,
  tabLabel,
  type Fingering,
  type FretNote,
} from './fretboard'
import { mod12, parseNoteName, spellDegree } from './pitch'
import { jazzSuffixFromSemitones } from './qualities'
import type { VoicingShape } from './vsystem'
import type { Voicing } from './voicings'

export const CUSTOM_GROUP_ID = 'Custom'

const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export function isCustomGroupId(id: string): boolean {
  return id === CUSTOM_GROUP_ID
}

export function emptyCustomStrings(): (number | null)[] {
  return Array.from({ length: STRING_COUNT }, () => null)
}

function describeCustomFingering(notes: FretNote[]): Fingering {
  const fretted = notes.filter((note) => note.fret > 0)
  const lowestFret = fretted.length ? Math.min(...fretted.map((n) => n.fret)) : 0
  const highestFret = fretted.length ? Math.max(...fretted.map((n) => n.fret)) : 0
  const span = fretted.length ? highestFret - lowestFret : 0

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

  const usedStrings = notes.map((note) => note.string)
  const minString = Math.min(...usedStrings)
  const maxString = Math.max(...usedStrings)
  const innerMutes: number[] = []
  for (let string = minString + 1; string < maxString; string++) {
    if (!usedStrings.includes(string)) innerMutes.push(string)
  }

  const strings: (number | null)[] = Array(STRING_COUNT).fill(null)
  for (const note of notes) strings[note.string] = note.fret

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
    difficulty: span,
    midiNotes: notes.map((note) => note.midi),
  }
}

export function fingeringFromCustomStrings(
  strings: (number | null)[]
): Fingering | null {
  if (strings.length !== STRING_COUNT) return null
  const notes: FretNote[] = []
  let voice = 0
  for (let string = 0; string < STRING_COUNT; string++) {
    const fret = strings[string]
    if (fret === null) continue
    if (!Number.isInteger(fret) || fret < 0 || fret > MAX_PLAYABLE_FRET) {
      return null
    }
    notes.push({
      string,
      fret,
      midi: STANDARD_TUNING[string] + fret,
      voice: voice++,
    })
  }
  if (notes.length === 0) return null
  return describeCustomFingering(notes)
}

export function fingeringFromCustomTab(tab: string): Fingering | null {
  const strings = parseTab(tab)
  if (!strings) return null
  return fingeringFromCustomStrings(strings)
}

export function shiftCustomFingering(
  fingering: Fingering,
  deltaFrets: number
): Fingering | null {
  if (deltaFrets === 0) return fingering
  const strings: (number | null)[] = []
  for (const fret of fingering.strings) {
    if (fret === null) {
      strings.push(null)
      continue
    }
    const next = fret + deltaFrets
    if (next < 0 || next > MAX_PLAYABLE_FRET) return null
    strings.push(next)
  }
  return fingeringFromCustomStrings(strings)
}

function toneForMidi(midi: number, rootName: string) {
  const root = parseNoteName(rootName)
  const rootPc = root?.pc ?? 0
  const rootLetter = root?.letter ?? 'C'
  const semitones = mod12(midi - rootPc)
  const option = INTERVAL_OPTIONS.find((item) => item.semitones === semitones)
  const degree = option?.degree ?? 'R'
  const pc = mod12(midi)
  return {
    semitones,
    degree,
    role: option?.role ?? 'extension',
    pc,
    name: spellDegree(rootLetter, degree, pc),
  }
}

export function customShapeFromFingering(
  fingering: Fingering,
  rootName: string
): VoicingShape {
  const voiceTones = fingering.notes.map((note) =>
    toneForMidi(note.midi, rootName)
  )
  const bassMidi = fingering.notes[0]?.midi ?? 0
  const intervals = fingering.notes.map((note) => note.midi - bassMidi)
  return {
    group: {
      id: CUSTOM_GROUP_ID,
      number: 0,
      gaps: [0, 0, 0],
      description: 'Hand-built on the fretboard',
    },
    inversion: 0,
    intervals,
    voiceTones,
    span: intervals[intervals.length - 1] ?? 0,
  }
}

export function customChordSymbol(
  rootName: string,
  fingering: Fingering
): string {
  const root = parseNoteName(rootName)
  const rootPc = root?.pc ?? 0
  const semitones = [
    ...new Set(fingering.notes.map((note) => mod12(note.midi - rootPc))),
  ].sort((a, b) => a - b)
  const named = jazzSuffixFromSemitones(semitones)
  if (named !== null) return `${rootName}${named}`
  if (semitones.length === 4) {
    const tokens = INTERVAL_OPTIONS.filter((option) =>
      semitones.includes(option.semitones)
    ).map((option) => option.token)
    return formatCustomSymbol(rootName, tokens)
  }
  const names = fingering.notes.map(
    (note) => toneForMidi(note.midi, rootName).name
  )
  return [...new Set(names)].join(' ')
}

export function rootFromCustomSymbol(symbol: string): string {
  const parsed = tryParseChord(symbol)
  if (parsed.chord) return parsed.chord.rootName
  const match = /^([A-Ga-g][#b♯♭]*)/.exec(symbol.trim())
  if (!match) return 'C'
  const note = parseNoteName(match[1])
  if (!note) return 'C'
  return (
    note.letter +
    (note.accidental > 0
      ? '#'.repeat(note.accidental)
      : 'b'.repeat(-note.accidental))
  )
}

export function rootNameForPc(pc: number, preferFlats = false): string {
  const names = preferFlats
    ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    : ROOTS
  return names[mod12(pc)]
}

export function voicingFromCustom(
  strings: (number | null)[],
  rootName: string
): Voicing | null {
  const fingering = fingeringFromCustomStrings(strings)
  if (!fingering) return null
  const shape = customShapeFromFingering(fingering, rootName)
  const chordSymbol = customChordSymbol(rootName, fingering)
  return {
    id: `${CUSTOM_GROUP_ID}|${chordSymbol}|${tabLabel(fingering)}`,
    chordSymbol,
    rootName,
    groupId: CUSTOM_GROUP_ID,
    inversion: 0,
    shape,
    fingering,
  }
}
