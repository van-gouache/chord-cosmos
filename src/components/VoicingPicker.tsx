import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { ChordDiagram } from './ChordDiagram'
import { VLadder } from './VLadder'
import { TargetNoteChips } from './TargetNoteChips'
import { LickOutlineChart } from './LickOutlineChart'
import { lickOutlineNotes } from '../theory/lickOutline'
import { OctaveShiftButtons } from './OctaveShiftButtons'
import { beginVoicingDrag } from './voicingDrag'
import { playArpeggio, playNotes } from '../audio/player'
import {
  difficultyLabel,
  positionLabel,
  stringSetLabel,
  tabLabel,
} from '../theory/fretboard'
import { midiToOctave } from '../theory/pitch'
import { displayChordSymbol, type ParsedChord } from '../theory/chords'
import { suggestForwardTargets } from '../theory/betweenTargets'
import {
  inversionOrdinal,
  shiftVoicing,
  type GroupResult,
  type Voicing,
} from '../theory/voicings'

interface Props {
  result: GroupResult
  chord: ParsedChord
  nextChord: ParsedChord | null
  showForwardTargets?: boolean
  showLickOutline?: boolean
  selectedVoicingId: string | null
  onSelectVoicing: (voicing: Voicing | null) => void
  onAdd: (voicing: Voicing) => void
}

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: 'text-emerald-400',
  moderate: 'text-gold-400',
  hard: 'text-orange-400',
}

export function VoicingPicker({
  result,
  chord,
  nextChord,
  showForwardTargets = true,
  showLickOutline = false,
  selectedVoicingId,
  onSelectVoicing,
  onAdd,
}: Props) {
  const { group, inversions } = result

  const [requestedInversion, setRequestedInversion] = useState(0)
  const [hideHard, setHideHard] = useState(true)
  const [octaveFrets, setOctaveFrets] = useState(0)

  // Keep the chosen inversion when it's still playable, so switching chords
  // doesn't yank the user back to root position; otherwise fall back.
  const inversion =
    inversions[requestedInversion]?.voicings.length > 0
      ? requestedInversion
      : (inversions.find((i) => i.voicings.length > 0)?.inversion ?? 0)

  const active = inversions[inversion]

  const visibleVoicings = useMemo(
    () => (active ? filterVisible(active.voicings, hideHard) : []),
    [active, hideHard]
  )
  const visibleCrossed = useMemo(
    () =>
      active
        ? filterVisible(active.crossed ?? [], hideHard).slice(0, VARIANT_CAP)
        : [],
    [active, hideHard]
  )

  const hardCount = active
    ? active.voicings.length -
      active.voicings.filter((v) => difficultyLabel(v.fingering.difficulty) !== 'hard')
        .length
    : 0

  const selected =
    inversions
      .flatMap((option) => [...option.voicings, ...(option.crossed ?? [])])
      .find((v) => v.id === selectedVoicingId) ?? null

  useEffect(() => {
    setOctaveFrets(0)
  }, [selectedVoicingId, group.id, inversion])

  // Follow a shape loaded from the sequence (dice roll, etc.) so the
  // inversion chips and neck grid show the same grip as the card.
  useEffect(() => {
    const match = inversions
      .flatMap((option) => [...option.voicings, ...(option.crossed ?? [])])
      .find((voicing) => voicing.id === selectedVoicingId)
    if (!match) return
    setRequestedInversion(match.inversion)
    if (difficultyLabel(match.fingering.difficulty) === 'hard') {
      setHideHard(false)
    }
  }, [inversions, selectedVoicingId])

  const displaySelected = useMemo(() => {
    if (!selected) return null
    if (octaveFrets === 0) return selected
    return shiftVoicing(selected, octaveFrets) ?? selected
  }, [selected, octaveFrets])

  const lickNotes = useMemo(
    () =>
      showLickOutline && displaySelected
        ? lickOutlineNotes(displaySelected.fingering, chord)
        : [],
    [showLickOutline, displaySelected, chord]
  )

  const handleSelect = (voicing: Voicing) => {
    onSelectVoicing(voicing)
    playNotes(voicing.fingering.midiNotes)
  }

  const handleOctave = (deltaFrets: number) => {
    if (!selected) return
    const next = shiftVoicing(
      octaveFrets === 0 ? selected : (shiftVoicing(selected, octaveFrets) ?? selected),
      deltaFrets
    )
    if (!next) return
    setOctaveFrets(octaveFrets + deltaFrets)
    playNotes(next.fingering.midiNotes)
  }

  return (
    <section className="rounded-2xl border border-cosmos-700/70 bg-cosmos-900/60 p-4">
      {/* Group header */}
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-bold text-white">{group.id}</h2>
            {group.dropName && (
              <span className="text-sm text-nebula-400">{group.dropName}</span>
            )}
          </div>
          <p className="mt-1 max-w-xl text-sm text-cosmos-300">
            {group.description}
          </p>
        </div>
        <div className="rounded-lg bg-cosmos-850 px-3 py-2">
          <p className="mb-1 text-[10px] tracking-[0.12em] text-cosmos-400 uppercase">
            Chord tone gaps
          </p>
          <div className="flex gap-3">
            {gapLabels(group.gaps).map(([label, gap]) => (
              <div key={label} className="text-center">
                <p className="text-lg leading-none font-bold text-white tabular-nums">
                  {gap}
                </p>
                <p className="mt-0.5 text-[9px] text-cosmos-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Step 3: inversion */}
      <div className="mb-3">
        <p className="mb-1.5 text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
          Inversion
        </p>
        <div className="flex flex-wrap gap-1.5">
          {inversions.map((option) => {
            const disabled = option.voicings.length === 0
            const isActive = option.inversion === inversion
            return (
              <button
                key={option.inversion}
                type="button"
                disabled={disabled}
                draggable={!disabled}
                onDragStart={(event) => {
                  const shape = option.voicings[0]
                  if (!shape) {
                    event.preventDefault()
                    return
                  }
                  beginVoicingDrag(event, shape)
                }}
                onClick={() => setRequestedInversion(option.inversion)}
                aria-label={`${inversionOrdinal(option.inversion)}, ${
                  option.bassTone.name
                } in the bass, ${
                  disabled ? 'unreachable' : `${option.voicings.length} shapes`
                }`}
                title={
                  disabled
                    ? `${inversionOrdinal(option.inversion)} — ${option.bassTone.name} in the bass, unreachable`
                    : `${inversionOrdinal(option.inversion)} — ${option.bassTone.name} in the bass, ${option.voicings.length} shapes. Drag onto the sequence, or click to see positions`
                }
                className={`flex items-baseline gap-1.5 rounded-lg border px-2 py-1.5 transition ${
                  isActive
                    ? 'cursor-grab border-nebula-500 bg-nebula-500/15 active:cursor-grabbing'
                    : disabled
                      ? 'cursor-not-allowed border-cosmos-800 bg-cosmos-900/40 opacity-40'
                      : 'cursor-grab border-cosmos-700 bg-cosmos-850 hover:border-nebula-500/60 active:cursor-grabbing'
                }`}
              >
                <span
                  className={`text-sm leading-none font-semibold ${
                    isActive ? 'text-white' : 'text-cosmos-300'
                  }`}
                >
                  {option.bassTone.degree === 'R'
                    ? 'Root'
                    : option.bassTone.degree}
                </span>
                <span className="font-mono text-[11px] leading-none text-cosmos-300">
                  {option.bassTone.name}
                </span>
                <span className="text-[10px] leading-none tabular-nums text-cosmos-400">
                  {disabled ? '—' : option.voicings.length}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {active && (
        <div className="mb-3">
          <VLadder
            groupId={group.id}
            gaps={group.gaps}
            tones={active.shape.voiceTones}
            inversion={inversion}
          />
          <p className="mt-2 text-xs text-cosmos-400">
            Voices bass to soprano:{' '}
            {active.shape.voiceTones.map((tone, i) => (
              <span key={i}>
                {i > 0 && <span className="text-cosmos-600"> · </span>}
                <span className="text-cosmos-300">{tone.name}</span>
                <span className="text-nebula-400"> {tone.degree}</span>
              </span>
            ))}
            <span className="text-cosmos-400">
              {' '}
              · spans {active.shape.span} semitones
            </span>
          </p>
          {showForwardTargets && nextChord && (
            <TargetNoteChips
              heading={`New in ${nextChord.symbol}`}
              targets={suggestForwardTargets(chord, nextChord)}
            />
          )}
        </div>
      )}

      {/* Step 4: pick the position on the neck */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
          Position on the neck
        </p>
        {hardCount > 0 && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-cosmos-400 hover:text-cosmos-300">
            <input
              type="checkbox"
              checked={!hideHard}
              onChange={(e) => setHideHard(!e.target.checked)}
              className="accent-nebula-500"
            />
            {`Show ${hardCount} big stretch${hardCount === 1 ? '' : 'es'}`}
          </label>
        )}
      </div>

      {visibleVoicings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-cosmos-700 p-6 text-center text-sm text-cosmos-400">
          This inversion of {group.id} can't be played in standard tuning.
        </p>
      ) : (
        <VoicingGrid
          voicings={visibleVoicings}
          selectedVoicingId={selectedVoicingId}
          displaySelected={displaySelected}
          onSelect={handleSelect}
          onAdd={(voicing, shown) => {
            onSelectVoicing(voicing)
            onAdd(shown)
          }}
        />
      )}

      {visibleCrossed.length > 0 && (
        <VariantSection
          title="Cross-string"
          hint={`Same ${voiceCountWord(active?.shape.voiceTones.length ?? 4)} pitches, with a higher string sounding below a lower one.`}
          total={active?.crossed?.length ?? 0}
          shown={visibleCrossed.length}
        >
          <VoicingGrid
            voicings={visibleCrossed}
            selectedVoicingId={selectedVoicingId}
            displaySelected={displaySelected}
            onSelect={handleSelect}
            onAdd={(voicing, shown) => {
              onSelectVoicing(voicing)
              onAdd(shown)
            }}
          />
        </VariantSection>
      )}

      {/* Detail of the selected shape */}
      {displaySelected && displaySelected.groupId === group.id && (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-nebula-500/40 bg-nebula-500/8 p-3">
          <ChordDiagram
            fingering={displaySelected.fingering}
            shape={displaySelected.shape}
            size="lg"
          />
          {lickNotes.length > 0 && (
            <LickOutlineChart
              fingering={displaySelected.fingering}
              notes={lickNotes}
              className="min-w-[7rem]"
            />
          )}
          <div className="min-w-[180px] flex-1">
            <p className="text-lg font-bold text-white">
              {displayChordSymbol(displaySelected.chordSymbol)}{' '}
              <span className="text-sm font-normal text-nebula-400">
                {displaySelected.groupId} · {inversionOrdinal(displaySelected.inversion)}
              </span>
            </p>
            <p className="mt-1 font-mono text-sm text-cosmos-300">
              {tabLabel(displaySelected.fingering)}
            </p>
            <p className="mt-1 text-xs text-cosmos-400">
              {displaySelected.fingering.notes
                .map((n) => {
                  const tone = displaySelected.shape.voiceTones[n.voice]
                  return `${tone.name}${midiToOctave(n.midi)} (${tone.degree})`
                })
                .join('  ·  ')}
            </p>
            <p className="mt-1 text-xs text-cosmos-400">
              {positionLabel(displaySelected.fingering)} · span{' '}
              {displaySelected.fingering.span} fret
              {displaySelected.fingering.span === 1 ? '' : 's'} ·{' '}
              {displaySelected.fingering.fingersNeeded} finger
              {displaySelected.fingering.fingersNeeded === 1 ? '' : 's'}
              {displaySelected.fingering.innerMutes.length > 0 &&
                ` · mute ${displaySelected.fingering.innerMutes.length} inner string${
                  displaySelected.fingering.innerMutes.length === 1 ? '' : 's'
                }`}
            </p>
            <div className="mt-2">
              <OctaveShiftButtons
                fingering={displaySelected.fingering}
                onShift={handleOctave}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => playArpeggio(displaySelected.fingering.midiNotes)}
              className="rounded-lg border border-cosmos-600 px-4 py-2.5 text-sm text-cosmos-300 transition hover:border-star-400 hover:text-star-300"
            >
              ▶ Hear
            </button>
            <button
              type="button"
              onClick={() => onAdd(displaySelected)}
              className="rounded-lg bg-nebula-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-nebula-500"
            >
              Add to sequence
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

const VARIANT_CAP = 16

function filterVisible(voicings: Voicing[], hideHard: boolean): Voicing[] {
  if (!hideHard) return voicings
  const filtered = voicings.filter(
    (v) => difficultyLabel(v.fingering.difficulty) !== 'hard'
  )
  return filtered.length > 0 ? filtered : voicings
}

function VariantSection({
  title,
  hint,
  total,
  shown,
  children,
}: {
  title: string
  hint: string
  total: number
  shown: number
  children: ReactNode
}) {
  return (
    <div className="mt-5">
      <p className="text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
        {title}
      </p>
      <p className="mt-1 mb-2 text-[11px] text-cosmos-500">
        {hint}
        {total > shown ? ` Showing the ${shown} easiest of ${total}.` : ''}
      </p>
      {children}
    </div>
  )
}

function VoicingGrid({
  voicings,
  selectedVoicingId,
  displaySelected,
  onSelect,
  onAdd,
}: {
  voicings: Voicing[]
  selectedVoicingId: string | null
  displaySelected: Voicing | null
  onSelect: (voicing: Voicing) => void
  onAdd: (voicing: Voicing, shown: Voicing) => void
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
      {voicings.map((voicing) => {
        const isSelected = voicing.id === selectedVoicingId
        const shown = isSelected && displaySelected ? displaySelected : voicing
        const level = difficultyLabel(shown.fingering.difficulty)
        return (
          <div
            key={voicing.id}
            role="button"
            tabIndex={0}
            draggable
            onDragStart={(event) => beginVoicingDrag(event, shown)}
            onClick={() => onSelect(voicing)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(voicing)
              }
            }}
            title="Drag onto the sequence"
            className={`group flex cursor-grab flex-col items-center gap-1 rounded-xl border p-2.5 transition active:cursor-grabbing ${
              isSelected
                ? 'border-nebula-500 bg-nebula-500/12 shadow-[0_8px_28px_-14px_rgba(79,108,255,0.7)]'
                : 'border-cosmos-700/70 bg-cosmos-900/50 hover:border-nebula-500/60 hover:bg-cosmos-850'
            }`}
          >
            <div className="flex w-full items-baseline justify-between text-[11px]">
              <span className="font-semibold text-white">
                {positionLabel(shown.fingering)}
              </span>
              <span className={DIFFICULTY_STYLES[level]} title={`${level} to play`}>
                ●
              </span>
            </div>

            <ChordDiagram
              fingering={shown.fingering}
              shape={shown.shape}
              size="md"
            />

            <p className="w-full truncate text-center font-mono text-[11px] text-cosmos-300">
              {tabLabel(shown.fingering)}
            </p>
            <p className="text-[10px] text-cosmos-400">
              strings {stringSetLabel(shown.fingering)}
              {shown.fingering.barreFret !== null && ' · barre'}
            </p>

            <div className="mt-0.5 flex w-full gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  playArpeggio(shown.fingering.midiNotes)
                }}
                className="flex-1 rounded-md bg-cosmos-800 py-1 text-[11px] text-cosmos-300 transition hover:bg-cosmos-700 hover:text-white"
              >
                ▶ Hear
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onAdd(voicing, shown)
                }}
                className="flex-1 rounded-md bg-nebula-600 py-1 text-[11px] font-semibold text-white transition hover:bg-nebula-500"
              >
                + Add
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function voiceCountWord(count: number): string {
  if (count === 3) return 'three'
  if (count === 4) return 'four'
  return String(count)
}

function gapLabels(gaps: readonly number[]): [string, number][] {
  if (gaps.length === 2) {
    return [
      ['bass–middle', gaps[0]],
      ['middle–top', gaps[1]],
    ]
  }
  return [
    ['bass–tenor', gaps[0] ?? 0],
    ['tenor–alto', gaps[1] ?? 0],
    ['alto–soprano', gaps[2] ?? 0],
  ]
}
