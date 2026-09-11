/**
 * Typical key centers for a chord when a group has no key yet.
 * Ranked by common jazz function (ii–V–I, tonic, dorian i, etc.).
 */

import { tryParseChord, type ParsedChord } from './chords'
import {
  KEY_CENTERS,
  MODE_OPTIONS,
  type KeyCenter,
  type ModeId,
} from './diatonic'
import { mod12, parseNoteName } from './pitch'

export interface KeySuggestion {
  keyRoot: KeyCenter
  mode: ModeId
  roman: string
  score: number
}

const MAX_SUGGESTIONS = 5

type ChordClass =
  | 'maj7'
  | 'maj6'
  | 'minor7'
  | 'minor6'
  | 'mmaj7'
  | 'dominant'
  | 'halfdim'
  | 'dim7'

export function suggestKeyCenters(chordSymbols: string[]): KeySuggestion[] {
  const votes = new Map<string, KeySuggestion & { part: number }>()
  for (const symbol of uniqueSymbols(chordSymbols)) {
    for (const candidate of candidatesForSymbol(symbol)) {
      const id = `${candidate.keyRoot}:${candidate.mode}`
      const existing = votes.get(id)
      if (!existing) {
        votes.set(id, { ...candidate, part: candidate.score })
        continue
      }
      const keepRoman = candidate.score > existing.part
      votes.set(id, {
        ...(keepRoman ? candidate : existing),
        score: existing.score + candidate.score,
        part: Math.max(existing.part, candidate.score),
      })
    }
  }
  return [...votes.values()]
    .map((row) => ({
      keyRoot: row.keyRoot,
      mode: row.mode,
      roman: row.roman,
      score: row.score,
    }))
    .sort((a, b) => b.score - a.score || a.keyRoot.localeCompare(b.keyRoot))
    .slice(0, MAX_SUGGESTIONS)
}

export function suggestionChipLabel(suggestion: KeySuggestion): string {
  const scale =
    suggestion.mode === 'ionian' ? '' : ` ${modeShortLabel(suggestion.mode)}`
  return `${suggestion.keyRoot}${scale} · ${suggestion.roman}`
}

export function suggestionHint(suggestion: KeySuggestion): string {
  const scale =
    MODE_OPTIONS.find((option) => option.id === suggestion.mode)?.label ??
    suggestion.mode
  return `Set key to ${suggestion.keyRoot} ${scale} (${suggestion.roman})`
}

function uniqueSymbols(symbols: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const symbol of symbols) {
    const trimmed = symbol.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

function candidatesForSymbol(symbol: string): KeySuggestion[] {
  const { chord } = tryParseChord(symbol)
  if (!chord) return []
  const cls = classifyChord(chord)
  if (!cls) return []
  const root = chord.rootPc
  const rows: Array<{
    pc: number
    mode: ModeId
    roman: string
    score: number
  }> = []

  switch (cls) {
    case 'minor7':
      rows.push(
        { pc: root - 2, mode: 'ionian', roman: 'II-7', score: 100 },
        { pc: root, mode: 'dorian', roman: 'I-7', score: 88 },
        { pc: root + 3, mode: 'ionian', roman: 'VI-7', score: 80 },
        { pc: root - 4, mode: 'ionian', roman: 'III-7', score: 70 },
        { pc: root, mode: 'aeolian', roman: 'I-7', score: 62 },
      )
      break
    case 'dominant':
      rows.push(
        { pc: root + 5, mode: 'ionian', roman: 'V7', score: 100 },
        { pc: root, mode: 'mixolydian', roman: 'I7', score: 82 },
        { pc: root - 2, mode: 'ionian', roman: 'V7/V', score: 58 },
      )
      break
    case 'maj7':
      rows.push(
        { pc: root, mode: 'ionian', roman: 'IΔ7', score: 100 },
        { pc: root - 7, mode: 'ionian', roman: 'IVΔ7', score: 86 },
        { pc: root, mode: 'lydian', roman: 'IΔ7', score: 68 },
        { pc: root - 3, mode: 'aeolian', roman: 'IIIΔ7', score: 60 },
      )
      break
    case 'maj6':
      rows.push(
        { pc: root, mode: 'ionian', roman: 'I6', score: 100 },
        { pc: root - 7, mode: 'ionian', roman: 'IV6', score: 82 },
      )
      break
    case 'minor6':
      rows.push(
        { pc: root, mode: 'dorian', roman: 'I-6', score: 100 },
      )
      break
    case 'mmaj7':
      rows.push(
        { pc: root, mode: 'harmonic-minor', roman: 'I-Δ7', score: 100 },
        { pc: root, mode: 'melodic-minor', roman: 'I-Δ7', score: 90 },
      )
      break
    case 'halfdim':
      rows.push(
        { pc: root - 2, mode: 'aeolian', roman: 'IIø7', score: 100 },
        { pc: root - 2, mode: 'harmonic-minor', roman: 'IIø7', score: 92 },
        { pc: root + 1, mode: 'ionian', roman: 'VIIø7', score: 76 },
      )
      break
    case 'dim7':
      rows.push(
        { pc: root + 1, mode: 'harmonic-minor', roman: 'VII°7', score: 100 },
        { pc: root + 4, mode: 'harmonic-minor', roman: 'VII°7', score: 72 },
        { pc: root + 7, mode: 'harmonic-minor', roman: 'VII°7', score: 64 },
      )
      break
  }

  const out: KeySuggestion[] = []
  for (const row of rows) {
    const keyRoot = keyCenterFromPc(row.pc)
    if (!keyRoot) continue
    out.push({
      keyRoot,
      mode: row.mode,
      roman: row.roman,
      score: row.score,
    })
  }
  return out
}

function classifyChord(chord: ParsedChord): ChordClass | null {
  const steps = new Set(
    (chord.allTones.length > 0 ? chord.allTones : chord.tones).map(
      (tone) => tone.semitones,
    ),
  )
  const has = (interval: number) => steps.has(interval)
  const b3 = has(3)
  const n3 = has(4)
  const b5 = has(6)
  const b7 = has(10)
  const n7 = has(11)
  const n6 = has(9)

  if (b3 && b5 && b7) return 'halfdim'
  if (b3 && b5 && n6 && !b7 && !n7) return 'dim7'
  if (b3 && n7) return 'mmaj7'
  if (b3 && n6 && !b7 && !n7) return 'minor6'
  if (b3 && b7) return 'minor7'
  if (n3 && b7) return 'dominant'
  if (n3 && n7) return 'maj7'
  if (n3 && n6 && !n7 && !b7) return 'maj6'
  if (n3) return 'maj6'
  if (b3) return 'minor7'
  if (b7) return 'dominant'
  return null
}

function keyCenterFromPc(pc: number): KeyCenter | undefined {
  const want = mod12(pc)
  return KEY_CENTERS.find((name) => parseNoteName(name)?.pc === want)
}

function modeShortLabel(mode: ModeId): string {
  switch (mode) {
    case 'harmonic-minor':
      return 'harm. min'
    case 'melodic-minor':
      return 'mel. min'
    case 'harmonic-major':
      return 'harm. maj'
    case 'mixolydian':
      return 'mixo'
    default:
      return mode
  }
}
