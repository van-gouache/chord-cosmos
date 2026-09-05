/**
 * 3-notes-per-string arpeggio layouts for a parsed chord.
 *
 * Walks the neck string by string, placing the next three chord tones on each
 * string in ascending pitch so the pattern can be played as one long arp.
 */

import {
  MAX_PLAYABLE_FRET,
  STANDARD_TUNING,
  STRING_COUNT,
} from './fretboard'
import { mod12 } from './pitch'
import type { ChordTone, ParsedChord } from './chords'

export interface ArpeggioNote {
  string: number
  fret: number
  midi: number
  tone: ChordTone
  /** Order in the 3NPS path, starting at 0. */
  order: number
}

export interface ThreeNpsOptions {
  /** 0 = low E. */
  startString?: number
  /** Which chord tone begins the path. */
  startToneIndex?: number
  /** Lowest fret allowed for the first note. */
  minFret?: number
  maxFret?: number
}

export interface ThreeNpsStart {
  string: number
  fret: number
  midi: number
  toneIndex: number
}

/** Inclusive fret count for an in-position “vertical” arpeggio. */
export const VERTICAL_FRET_SPAN = 6

export function verticalWindow(
  startFret: number,
  maxFret = MAX_PLAYABLE_FRET
): { from: number; to: number } {
  const from = Math.max(0, startFret)
  return { from, to: Math.min(maxFret, from + VERTICAL_FRET_SPAN - 1) }
}

/** Chord tones for an arpeggio: every tone the symbol implies, root first. */
export function arpeggioTones(chord: ParsedChord): ChordTone[] {
  const source = chord.allTones.length >= 3 ? chord.allTones : chord.tones
  return [...source].sort((a, b) => a.semitones - b.semitones)
}

/** Every neck cell that sounds a chord tone. */
export function chordTonePositions(
  chord: ParsedChord,
  maxFret = MAX_PLAYABLE_FRET
): ArpeggioNote[] {
  const tones = arpeggioTones(chord)
  const byPc = new Map(tones.map((tone) => [tone.pc, tone]))
  const notes: ArpeggioNote[] = []
  let order = 0
  for (let string = 0; string < STRING_COUNT; string++) {
    for (let fret = 0; fret <= maxFret; fret++) {
      const midi = STANDARD_TUNING[string] + fret
      const tone = byPc.get(mod12(midi))
      if (!tone) continue
      notes.push({ string, fret, midi, tone, order })
      order++
    }
  }
  return notes
}

/**
 * Places three chord tones on each string from `startString` upward,
 * cycling the tone list and always moving to a higher pitch.
 */
export function threeNpsPattern(
  chord: ParsedChord,
  options: ThreeNpsOptions = {}
): ArpeggioNote[] {
  const tones = arpeggioTones(chord)
  if (tones.length < 3) return []

  const startString = clampInt(options.startString ?? 0, 0, STRING_COUNT - 1)
  const startToneIndex = ((options.startToneIndex ?? 0) % tones.length + tones.length) % tones.length
  const minFret = Math.max(0, options.minFret ?? 0)
  const maxFret = options.maxFret ?? MAX_PLAYABLE_FRET

  const first = findToneFret(
    startString,
    tones[startToneIndex].pc,
    minFret,
    maxFret,
    STANDARD_TUNING[startString] + minFret - 1
  )
  if (!first) return []

  const notes: ArpeggioNote[] = [
    {
      string: startString,
      fret: first.fret,
      midi: first.midi,
      tone: tones[startToneIndex],
      order: 0,
    },
  ]

  let toneIndex = startToneIndex + 1
  let lastMidi = first.midi

  for (let string = startString; string < STRING_COUNT; string++) {
    const alreadyOnString = notes.filter((note) => note.string === string).length
    for (let slot = alreadyOnString; slot < 3; slot++) {
      const tone = tones[toneIndex % tones.length]
      const next = findToneFret(string, tone.pc, 0, maxFret, lastMidi)
      if (!next) return notes
      notes.push({
        string,
        fret: next.fret,
        midi: next.midi,
        tone,
        order: notes.length,
      })
      lastMidi = next.midi
      toneIndex++
    }
  }

  return notes
}

/** Every chord tone inside a 6-fret box, low to high. */
export function verticalPattern(
  chord: ParsedChord,
  options: { startFret?: number; maxFret?: number } = {}
): ArpeggioNote[] {
  const maxFret = options.maxFret ?? MAX_PLAYABLE_FRET
  const { from, to } = verticalWindow(options.startFret ?? 0, maxFret)
  return chordTonePositions(chord, maxFret)
    .filter((note) => note.fret >= from && note.fret <= to)
    .sort((a, b) => a.midi - b.midi || a.string - b.string)
    .map((note, order) => ({ ...note, order }))
}

/** 6-fret boxes whose low-E note is the chosen chord tone. */
export function verticalStarts(
  chord: ParsedChord,
  startToneIndex = 0,
  startString = 0,
  maxFret = MAX_PLAYABLE_FRET
): ThreeNpsStart[] {
  const tones = arpeggioTones(chord)
  if (tones.length < 3) return []
  const tone =
    tones[((startToneIndex % tones.length) + tones.length) % tones.length]
  const starts: ThreeNpsStart[] = []
  for (let fret = 0; fret <= maxFret; fret++) {
    const midi = STANDARD_TUNING[startString] + fret
    if (mod12(midi) !== tone.pc) continue
    if (verticalPattern(chord, { startFret: fret, maxFret }).length < 4) continue
    starts.push({ string: startString, fret, midi, toneIndex: startToneIndex })
  }
  return starts
}

/** Places on the bass string where a 3NPS path can start for this tone. */
export function threeNpsStarts(
  chord: ParsedChord,
  startToneIndex = 0,
  startString = 0,
  maxFret = MAX_PLAYABLE_FRET
): ThreeNpsStart[] {
  const tones = arpeggioTones(chord)
  if (tones.length < 3) return []
  const tone = tones[((startToneIndex % tones.length) + tones.length) % tones.length]
  const starts: ThreeNpsStart[] = []
  for (let fret = 0; fret <= maxFret; fret++) {
    const midi = STANDARD_TUNING[startString] + fret
    if (mod12(midi) !== tone.pc) continue
    const pattern = threeNpsPattern(chord, {
      startString,
      startToneIndex,
      minFret: fret,
      maxFret,
    })
    if (pattern.length >= 6) {
      starts.push({ string: startString, fret, midi, toneIndex: startToneIndex })
    }
  }
  return starts
}

function findToneFret(
  string: number,
  pc: number,
  minFret: number,
  maxFret: number,
  afterMidi: number
): { fret: number; midi: number } | null {
  for (let fret = minFret; fret <= maxFret; fret++) {
    const midi = STANDARD_TUNING[string] + fret
    if (midi > afterMidi && mod12(midi) === pc) return { fret, midi }
  }
  return null
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
