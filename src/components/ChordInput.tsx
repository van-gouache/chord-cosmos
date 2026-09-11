import { useRef, useState } from 'react'

import type { ParsedChord } from '../theory/chords'
import {
  QUALITY_GROUPS,
  TRIAD_QUALITY_GROUPS,
  triadQualityLabel,
  triadSuffixFromSemitones,
  type QualityChip,
} from '../theory/qualities'
import { triadTones } from '../theory/triads'
import { IntervalPicker, type IntervalPickerMode } from './IntervalPicker'

interface Props {
  value: string
  onChange: (value: string) => void
  chord: ParsedChord | null
  error: string | null
  mode?: IntervalPickerMode
  /** Bumped when the workshop tab changes so leftover quality chips unselect. */
  qualityNonce?: number
  onIntervalCountChange?: (count: number) => void
}

const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export function ChordInput({
  value,
  onChange,
  chord,
  error,
  mode = 'vsystem',
  qualityNonce = 0,
  onIntervalCountChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Only used while the typed symbol is unreadable; otherwise the root comes
  // straight from what the user typed.
  const [lastRoot, setLastRoot] = useState('E')

  const root = chord?.rootName ?? lastRoot
  const currentSuffix = chord ? value.trim().slice(chord.rootName.length) : ''
  const triad = chord && mode === 'triads' ? triadTones(chord) : null
  const impliedSuffix =
    triad != null
      ? (triadSuffixFromSemitones(triad.map((tone) => tone.semitones)) ??
        currentSuffix)
      : currentSuffix
  const [qualityHighlight, setQualityHighlight] = useState(true)
  const [seenNonce, setSeenNonce] = useState(qualityNonce)
  if (qualityNonce !== seenNonce) {
    setSeenNonce(qualityNonce)
    setQualityHighlight(false)
  }

  const displaySuffix = chord ? chord.symbol.slice(chord.rootName.length) : ''
  const selectedSuffix = qualityHighlight
    ? mode === 'triads'
      ? impliedSuffix
      : displaySuffix
    : null
  const summaryTones = triad ?? chord?.tones ?? []
  const summaryLabel =
    triad != null
      ? triadQualityLabel(
          triadSuffixFromSemitones(triad.map((tone) => tone.semitones)) ?? ''
        )
      : chord?.qualityLabel
  const qualityGroups = mode === 'triads' ? TRIAD_QUALITY_GROUPS : QUALITY_GROUPS

  const apply = (nextRoot: string, suffix: string) => {
    setLastRoot(nextRoot)
    setQualityHighlight(true)
    onChange(`${nextRoot}${suffix}`)
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="chord-input"
          className="mb-2 block text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase"
        >
          Chord
        </label>
        <div className="relative">
          <input
            id="chord-input"
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setQualityHighlight(true)
              onChange(e.target.value)
            }}
            placeholder={mode === 'triads' ? 'E-' : 'E-7'}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={error !== null}
            aria-describedby={error ? 'chord-error' : 'chord-summary'}
            className={`w-full rounded-xl border bg-cosmos-900/80 px-4 py-3 text-2xl font-semibold text-white outline-none transition placeholder:text-cosmos-600 focus:ring-2 ${
              error
                ? 'border-red-500/60 focus:ring-red-500/30'
                : 'border-cosmos-700 focus:border-nebula-500 focus:ring-nebula-500/30'
            }`}
          />
        </div>

        {error ? (
          <p id="chord-error" className="mt-2 text-sm text-red-400">
            {error}
          </p>
        ) : chord ? (
          <div id="chord-summary" className="mt-2 space-y-1">
            <p className="text-sm text-cosmos-300">
              <span className="text-white">{chord.symbol}</span>
              <span className="text-cosmos-400"> · {summaryLabel}</span>
            </p>
            <p className="flex flex-wrap gap-1.5 text-sm">
              {summaryTones.map((tone) => (
                <span
                  key={tone.semitones}
                  className="inline-flex items-baseline gap-1 rounded-md bg-cosmos-800 px-2 py-0.5"
                >
                  <span className="font-semibold text-white">{tone.name}</span>
                  <span className="text-[11px] text-nebula-400">
                    {tone.degree}
                  </span>
                </span>
              ))}
            </p>
            {mode === 'vsystem' && chord.adjustments.length > 0 && (
              <p className="text-xs text-gold-400/90">
                Four voices needed — {chord.adjustments.join('; ')}.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
          Root
        </p>
        <div className="grid grid-cols-6 gap-1">
          {ROOTS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                if (!qualityHighlight) {
                  setLastRoot(r)
                  onChange(r)
                  inputRef.current?.focus()
                  return
                }
                apply(
                  r,
                  mode === 'triads' ? impliedSuffix : currentSuffix
                )
              }}
              className={`rounded-md px-1 py-1.5 text-sm font-semibold transition ${
                root === r
                  ? 'bg-nebula-600 text-white'
                  : 'bg-cosmos-800 text-cosmos-300 hover:bg-cosmos-700 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {qualityGroups.map((group) => (
        <QualityRow
          key={group.heading}
          heading={group.heading}
          qualities={group.chips}
          currentSuffix={selectedSuffix}
          onPick={(suffix) => apply(root, suffix)}
        />
      ))}
      <IntervalPicker
        rootName={root}
        sourceSymbol={value}
        chord={chord}
        onApply={(symbol) => {
          setQualityHighlight(true)
          onChange(symbol)
        }}
        onDraftChange={onIntervalCountChange}
        mode={mode}
      />
    </div>
  )
}

function QualityRow({
  heading,
  qualities,
  currentSuffix,
  onPick,
}: {
  heading: string
  qualities: QualityChip[]
  currentSuffix: string | null
  onPick: (suffix: string) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
        {heading}
      </p>
      <div className="flex flex-wrap gap-1">
        {qualities.map((q) => (
          <button
            key={q.suffix || q.label}
            type="button"
            title={q.title}
            onClick={() => onPick(q.suffix)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition ${
              currentSuffix === q.suffix
                ? 'bg-nebula-600 text-white'
                : 'bg-cosmos-800 text-cosmos-300 hover:bg-cosmos-700 hover:text-white'
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>
    </div>
  )
}
