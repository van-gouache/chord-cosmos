import { useState } from 'react'

import {
  formatCustomSymbol,
  INTERVAL_OPTIONS,
  type IntervalOption,
  type ParsedChord,
} from '../theory/chords'
import { jazzDescribeSet, jazzSuffixFromSemitones } from '../theory/qualities'
import { triadTones } from '../theory/triads'

export type IntervalPickerMode = 'vsystem' | 'triads'

interface Props {
  rootName: string
  /** The symbol currently in the input, used to resync after a named quality. */
  sourceSymbol: string
  chord: ParsedChord | null
  onApply: (symbol: string) => void
  mode?: IntervalPickerMode
}

/** The 1–3–5 / sus set — no sevenths or extensions. */
const TRIAD_INTERVAL_OPTIONS: IntervalOption[] = [
  { semitones: 0, token: 'R', label: 'R', title: 'root', role: 'root', degree: 'R' },
  { semitones: 2, token: '2', label: '2', title: '2 / sus2', role: 'third', degree: '2' },
  { semitones: 3, token: 'b3', label: '♭3', title: 'minor 3rd', role: 'third', degree: '♭3' },
  { semitones: 4, token: '3', label: '3', title: 'major 3rd', role: 'third', degree: '3' },
  { semitones: 5, token: '4', label: '4', title: '4 / sus4', role: 'third', degree: '4' },
  { semitones: 6, token: 'b5', label: '♭5', title: 'diminished 5th', role: 'fifth', degree: '♭5' },
  { semitones: 7, token: '5', label: '5', title: 'perfect 5th', role: 'fifth', degree: '5' },
  { semitones: 8, token: '#5', label: '♯5', title: 'augmented 5th', role: 'fifth', degree: '♯5' },
]

function selectedSemitones(
  chord: ParsedChord | null,
  mode: IntervalPickerMode
): Set<number> {
  if (!chord) return new Set()
  if (mode === 'triads') {
    const triad = triadTones(chord)
    if (triad) return new Set(triad.map((tone) => tone.semitones))
  }
  return new Set(chord.tones.map((tone) => tone.semitones))
}

/**
 * Pitch-class buttons for the current workshop. V-System wants four tones
 * from the full chromatic set; triads want three from the 1–3–5 / sus set.
 */
export function IntervalPicker({
  rootName,
  sourceSymbol,
  chord,
  onApply,
  mode = 'vsystem',
}: Props) {
  const voiceCount = mode === 'triads' ? 3 : 4
  const options = mode === 'triads' ? TRIAD_INTERVAL_OPTIONS : INTERVAL_OPTIONS
  const fromChord = () => selectedSemitones(chord, mode)

  const [syncedTo, setSyncedTo] = useState(`${mode}:${sourceSymbol}`)
  const [draft, setDraft] = useState<Set<number>>(fromChord)

  const syncKey = `${mode}:${sourceSymbol}`
  if (syncKey !== syncedTo) {
    setSyncedTo(syncKey)
    setDraft(fromChord())
  }

  const toggle = (semitones: number) => {
    const next = new Set(draft)
    if (next.has(semitones)) next.delete(semitones)
    else if (next.size < voiceCount) next.add(semitones)
    else return

    setDraft(next)
    if (mode === 'triads') {
      if (next.size !== voiceCount) return
      const suffix = triadSuffixFromSemitones(next)
      if (suffix !== null) onApply(`${rootName}${suffix}`)
      return
    }
    if (next.size === voiceCount) {
      const named = jazzDescribeSet(next)
      if (named !== null) {
        onApply(`${rootName}${named.suffix}`)
        return
      }
      const tokens = INTERVAL_OPTIONS.filter((o) => next.has(o.semitones)).map(
        (o) => o.token
      )
      onApply(formatCustomSymbol(rootName, tokens))
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
          Intervals
        </p>
        <p className="text-[11px] text-cosmos-400">
          {draft.size === voiceCount
            ? 'Deselect one to swap'
            : `Pick ${voiceCount - draft.size} more`}
        </p>
      </div>
      <div
        className={`grid gap-1 ${mode === 'triads' ? 'grid-cols-4' : 'grid-cols-6'}`}
      >
        {options.map((option) => {
          const on = draft.has(option.semitones)
          const blocked = draft.size >= voiceCount && !on
          return (
            <button
              key={option.token}
              type="button"
              title={blocked ? `${option.title} — deselect one first` : option.title}
              onClick={() => toggle(option.semitones)}
              className={`rounded-md px-1 py-1.5 text-sm font-semibold transition ${
                on
                  ? 'bg-nebula-600 text-white'
                  : blocked
                    ? 'bg-cosmos-800 text-cosmos-600 hover:text-cosmos-500'
                    : 'bg-cosmos-800 text-cosmos-300 hover:bg-cosmos-700 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
