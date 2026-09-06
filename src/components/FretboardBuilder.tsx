import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { playArpeggio, playNotes } from '../audio/player'
import { ChordDiagram } from './ChordDiagram'
import { beginLineDrag, beginVoicingDrag } from './voicingDrag'
import {
  MAX_PLAYABLE_FRET,
  STANDARD_TUNING,
  STRING_COUNT,
  tabLabel,
} from '../theory/fretboard'
import { midiToName, mod12 } from '../theory/pitch'
import {
  customChordSymbol,
  emptyCustomStrings,
  fingeringFromCustomStrings,
  rootNameForPc,
  voicingFromCustom,
} from '../theory/customVoicing'
import {
  emptyLineFingering,
  lineShape,
  toggleLineNote,
  type LineNote,
} from '../theory/lineOutline'
import { slotFromLineNotes, type SequenceSlot } from '../state/songs'
import type { Voicing } from '../theory/voicings'

const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e']
const INLAYS = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24])
const FRETS_PER_PAGE = 12
const ALL_FRETS = Array.from({ length: MAX_PLAYABLE_FRET }, (_, i) => i + 1)

interface Props {
  onAdd: (voicing: Voicing) => void
  onAddLine: (notes: LineNote[]) => void
}

export function FretboardBuilder({ onAdd, onAddLine }: Props) {
  const [mode, setMode] = useState<'shape' | 'line'>('shape')
  const [strings, setStrings] = useState<(number | null)[]>(emptyCustomStrings)
  const [lineNotes, setLineNotes] = useState<LineNote[]>([])
  const [rootName, setRootName] = useState('C')
  const [rootTouched, setRootTouched] = useState(false)
  const [page, setPage] = useState(0)
  const [lineOpen, setLineOpen] = useState(false)

  const startFret = page * FRETS_PER_PAGE + 1
  const endFret = Math.min(startFret + FRETS_PER_PAGE - 1, MAX_PLAYABLE_FRET)
  const fretNumbers = Array.from(
    { length: endFret - startFret + 1 },
    (_, i) => startFret + i
  )

  const fingering = useMemo(
    () => fingeringFromCustomStrings(strings),
    [strings]
  )
  const voicing = useMemo(
    () => voicingFromCustom(strings, rootName),
    [strings, rootName]
  )
  const symbol = fingering ? customChordSymbol(rootName, fingering) : '—'

  const lineSlot = useMemo(
    () => (lineNotes.length > 0 ? slotFromLineNotes(lineNotes) : null),
    [lineNotes]
  )

  const setString = (string: number, fret: number | null) => {
    setStrings((current) => {
      const next = [...current]
      const hadNotes = current.some((value) => value !== null)
      next[string] = fret
      if (!rootTouched && !hadNotes && fret !== null) {
        setRootName(rootNameForPc(mod12(STANDARD_TUNING[string] + fret)))
      }
      return next
    })
  }

  const toggleFret = (string: number, fret: number) => {
    if (mode === 'line') {
      const next = toggleLineNote(lineNotes, { string, fret }) ?? []
      setLineNotes(next)
      playNotes([STANDARD_TUNING[string] + fret])
      return
    }
    const current = strings[string]
    const next = current === fret ? null : fret
    setString(string, next)
    if (next !== null) {
      playNotes([STANDARD_TUNING[string] + next])
    }
  }

  const clear = () => {
    setStrings(emptyCustomStrings())
    setLineNotes([])
    setRootTouched(false)
  }

  const noteCount = strings.filter((fret) => fret !== null).length
  const lineCount = lineNotes.length

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
          Build
        </p>
        <div
          className="mb-3 flex gap-1 rounded-lg bg-cosmos-950/70 p-1"
          role="group"
          aria-label="Build mode"
        >
          <button
            type="button"
            onClick={() => setMode('shape')}
            className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold tracking-wide uppercase transition ${
              mode === 'shape'
                ? 'bg-nebula-600 text-white'
                : 'text-cosmos-400 hover:text-white'
            }`}
          >
            Shape
          </button>
          <button
            type="button"
            onClick={() => setMode('line')}
            className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold tracking-wide uppercase transition ${
              mode === 'line'
                ? 'bg-nebula-600 text-white'
                : 'text-cosmos-400 hover:text-white'
            }`}
          >
            Line
          </button>
        </div>
        {mode === 'shape' && (
          <>
            <p className="mb-1.5 text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
              Root
            </p>
            <div className="grid grid-cols-6 gap-1">
              {ROOTS.map((root) => (
                <button
                  key={root}
                  type="button"
                  onClick={() => {
                    setRootName(root)
                    setRootTouched(true)
                  }}
                  className={`rounded-md px-1 py-1.5 text-sm font-semibold transition ${
                    rootName === root
                      ? 'bg-nebula-600 text-white'
                      : 'bg-cosmos-800 text-cosmos-300 hover:bg-cosmos-700 hover:text-white'
                  }`}
                >
                  {root}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
          Fretboard
        </p>
        <div className="flex items-center gap-1">
          {mode === 'line' && (
            <button
              type="button"
              onClick={() => setLineOpen(true)}
              className="rounded-md bg-nebula-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-nebula-500"
            >
              Full neck
            </button>
          )}
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            className="rounded-md bg-cosmos-800 px-2 py-1 text-[11px] font-semibold text-cosmos-300 transition hover:bg-cosmos-700 hover:text-white disabled:opacity-40"
          >
            ← Lower
          </button>
          <button
            type="button"
            disabled={endFret >= MAX_PLAYABLE_FRET}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-md bg-cosmos-800 px-2 py-1 text-[11px] font-semibold text-cosmos-300 transition hover:bg-cosmos-700 hover:text-white disabled:opacity-40"
          >
            Higher →
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-cosmos-700/60 bg-cosmos-950/50 p-2">
        <FretboardGrid
          mode={mode}
          strings={strings}
          lineNotes={lineNotes}
          fretNumbers={fretNumbers}
          onToggle={toggleFret}
        />
      </div>

      <p className="text-[11px] text-cosmos-400">
        {mode === 'line'
          ? 'Click frets to outline a single-note line. Click a marked fret to remove it. Several notes can share a string.'
          : 'Click a fret to place a note, click it again to mute the string. Open strings are the 0 column.'}
      </p>

      {mode === 'line' ? (
        lineSlot ? (
          <div
            className="flex flex-wrap items-center gap-3 rounded-xl border border-nebula-500/40 bg-nebula-500/8 p-3"
            draggable
            onDragStart={(event) => beginLineDrag(event, lineSlot)}
          >
            <ChordDiagram
              fingering={emptyLineFingering()}
              shape={lineShape()}
              size="md"
              kind="line"
              highlightedNotes={lineNotes}
            />
            <div className="min-w-[140px] flex-1">
              <p className="text-lg font-bold text-white">
                {lineSlot.chordSymbol}
              </p>
              <p className="mt-0.5 text-xs text-cosmos-300">
                {lineCount} note{lineCount === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-xs text-cosmos-400">
                {lineNotes
                  .map(
                    (note) =>
                      midiToName(STANDARD_TUNING[note.string] + note.fret)
                  )
                  .join('  ·  ')}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onAddLine(lineNotes)}
                className="rounded-lg bg-nebula-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-nebula-500"
              >
                Add to sequence
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-cosmos-700 p-5 text-center text-sm text-cosmos-400">
            Place at least one fret to preview and add the line.
          </p>
        )
      ) : voicing && fingering ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-nebula-500/40 bg-nebula-500/8 p-3"
          draggable
          onDragStart={(event) => beginVoicingDrag(event, voicing)}
        >
          <ChordDiagram fingering={fingering} shape={voicing.shape} size="md" />
          <div className="min-w-[140px] flex-1">
            <p className="text-lg font-bold text-white">{symbol}</p>
            <p className="mt-0.5 font-mono text-xs text-cosmos-300">
              {tabLabel(fingering)}
            </p>
            <p className="mt-1 text-xs text-cosmos-400">
              {fingering.notes
                .map((note, index) => {
                  const tone = voicing.shape.voiceTones[index]
                  return `${tone?.name ?? midiToName(note.midi, rootName)} (${tone?.degree ?? ''})`
                })
                .join('  ·  ')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => playArpeggio(fingering.midiNotes)}
              className="rounded-lg border border-cosmos-600 px-3 py-2 text-sm text-cosmos-300 transition hover:border-star-400 hover:text-star-300"
            >
              ▶ Hear
            </button>
            <button
              type="button"
              disabled={noteCount < 2}
              onClick={() => onAdd(voicing)}
              className="rounded-lg bg-nebula-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-nebula-500 disabled:opacity-40"
            >
              Add to sequence
            </button>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-cosmos-700 p-5 text-center text-sm text-cosmos-400">
          Place at least two notes to preview and add the chord.
        </p>
      )}

      <button
        type="button"
        onClick={clear}
        className="rounded-lg border border-cosmos-700 px-3 py-1.5 text-xs text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
      >
        Clear frets
      </button>

      {mode === 'line' && (
        <LineFretboardDialog
          open={lineOpen}
          lineNotes={lineNotes}
          lineSlot={lineSlot}
          lineCount={lineCount}
          onClose={() => setLineOpen(false)}
          onToggle={toggleFret}
          onClear={clear}
          onSave={() => setLineOpen(false)}
        />
      )}
    </div>
  )
}

function FretboardGrid({
  mode,
  strings,
  lineNotes,
  fretNumbers,
  onToggle,
  compact = false,
}: {
  mode: 'shape' | 'line'
  strings: (number | null)[]
  lineNotes: LineNote[]
  fretNumbers: number[]
  onToggle: (string: number, fret: number) => void
  compact?: boolean
}) {
  const labelWidth = compact ? '22px' : '28px'
  const openWidth = compact ? '22px' : '28px'
  const minCell = compact ? '22px' : '26px'
  return (
    <div
      className="grid gap-px"
      style={{
        gridTemplateColumns: `${labelWidth} ${openWidth} repeat(${fretNumbers.length}, minmax(${minCell}, 1fr))`,
      }}
    >
      <div />
      <p className="pb-1 text-center text-[10px] font-semibold text-cosmos-500">
        0
      </p>
      {fretNumbers.map((fret) => (
        <p
          key={`num-${fret}`}
          className={`pb-1 text-center text-[10px] font-semibold ${
            INLAYS.has(fret) ? 'text-cosmos-300' : 'text-cosmos-500'
          }`}
        >
          {fret}
        </p>
      ))}

      {Array.from({ length: STRING_COUNT }, (_, row) => {
        const string = STRING_COUNT - 1 - row
        const activeFrets =
          mode === 'line'
            ? new Set(
                lineNotes
                  .filter((note) => note.string === string)
                  .map((note) => note.fret)
              )
            : strings[string] !== null
              ? new Set([strings[string]!])
              : new Set<number>()
        return (
          <FretRow
            key={string}
            string={string}
            label={STRING_LABELS[string]}
            activeFrets={activeFrets}
            fretNumbers={fretNumbers}
            compact={compact}
            line={mode === 'line'}
            onToggle={onToggle}
          />
        )
      })}
    </div>
  )
}

function LineFretboardDialog({
  open,
  lineNotes,
  lineSlot,
  lineCount,
  onClose,
  onToggle,
  onClear,
  onSave,
}: {
  open: boolean
  lineNotes: LineNote[]
  lineSlot: SequenceSlot | null
  lineCount: number
  onClose: () => void
  onToggle: (string: number, fret: number) => void
  onClear: () => void
  onSave: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose, open])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-cosmos-950/80 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="line-fretboard-title"
        className="flex max-h-[min(920px,96vh)] w-[calc(100vw-1.5rem)] max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-nebula-500/40 bg-cosmos-900 shadow-[0_24px_80px_-24px_rgba(79,108,255,0.4)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-cosmos-700/70 px-4 py-3 sm:px-5">
          <div>
            <h2
              id="line-fretboard-title"
              className="text-lg font-semibold tracking-tight text-white"
            >
              Line fretboard
            </h2>
            <p className="mt-0.5 text-sm text-cosmos-400">
              Whole neck · several notes can share a string
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-cosmos-700 px-3 py-1.5 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onSave}
              className="rounded-lg bg-nebula-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-nebula-500"
            >
              Save
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
          <div className="overflow-x-auto rounded-xl border border-cosmos-700/60 bg-cosmos-950/50 p-2">
            <FretboardGrid
              mode="line"
              strings={emptyCustomStrings()}
              lineNotes={lineNotes}
              fretNumbers={ALL_FRETS}
              onToggle={onToggle}
              compact
            />
          </div>

          {lineSlot ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-nebula-500/40 bg-nebula-500/8 p-3">
              <ChordDiagram
                fingering={emptyLineFingering()}
                shape={lineShape()}
                size="md"
                kind="line"
                highlightedNotes={lineNotes}
              />
              <div className="min-w-[140px] flex-1">
                <p className="text-lg font-bold text-white">
                  {lineSlot.chordSymbol}
                </p>
                <p className="mt-0.5 text-xs text-cosmos-300">
                  {lineCount} note{lineCount === 1 ? '' : 's'}
                </p>
                <p className="mt-1 text-xs text-cosmos-400">
                  {lineNotes
                    .map(
                      (note) =>
                        midiToName(STANDARD_TUNING[note.string] + note.fret)
                    )
                    .join('  ·  ')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onClear}
                  className="rounded-lg border border-cosmos-700 px-3 py-2 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-cosmos-700 p-4 text-center text-sm text-cosmos-400">
              Place at least one fret, then Save to return to Build.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function FretRow({
  string,
  label,
  activeFrets,
  fretNumbers,
  compact = false,
  line = false,
  onToggle,
}: {
  string: number
  label: string
  activeFrets: Set<number>
  fretNumbers: number[]
  compact?: boolean
  line?: boolean
  onToggle: (string: number, fret: number) => void
}) {
  return (
    <>
      <p className="self-center pr-1 text-right text-[11px] font-semibold text-cosmos-400">
        {label}
      </p>
      <FretCell
        active={activeFrets.has(0)}
        inlay={false}
        open
        compact={compact}
        line={line}
        label="open"
        onClick={() => onToggle(string, 0)}
      />
      {fretNumbers.map((fret) => (
        <FretCell
          key={`${string}-${fret}`}
          active={activeFrets.has(fret)}
          inlay={INLAYS.has(fret)}
          open={false}
          compact={compact}
          line={line}
          label={`fret ${fret}`}
          onClick={() => onToggle(string, fret)}
        />
      ))}
    </>
  )
}

function FretCell({
  active,
  mark,
  inlay,
  open,
  compact = false,
  line = false,
  label,
  onClick,
}: {
  active: boolean
  mark?: string
  inlay: boolean
  open: boolean
  compact?: boolean
  line?: boolean
  label: string
  onClick: () => void
}) {
  const fillCell = active && !line
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`relative flex items-center justify-center rounded-sm transition ${
        compact ? 'h-7' : 'h-8'
      } ${
        fillCell
          ? 'bg-nebula-600 text-white'
          : open
            ? 'bg-cosmos-900 text-cosmos-500 hover:bg-cosmos-800 hover:text-white'
            : inlay
              ? 'bg-cosmos-800/80 text-cosmos-600 hover:bg-cosmos-700 hover:text-white'
              : 'bg-cosmos-850 text-cosmos-700 hover:bg-cosmos-800 hover:text-white'
      }`}
    >
      {active ? (
        mark ? (
          <span className="text-[10px] font-bold">{mark}</span>
        ) : (
          <span
            className={`block rounded-full ${
              line
                ? compact
                  ? 'h-3 w-3 bg-gold-400'
                  : 'h-3.5 w-3.5 bg-gold-400'
                : 'h-3.5 w-3.5 bg-current'
            }`}
          />
        )
      ) : open ? (
        <span className="text-[10px] font-semibold">o</span>
      ) : inlay ? (
        <span className="block h-1.5 w-1.5 rounded-full bg-cosmos-600" />
      ) : null}
    </button>
  )
}
