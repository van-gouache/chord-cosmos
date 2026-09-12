import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { ChordDiagram } from './ChordDiagram'
import { LineNotation, LineRhythmPicker } from './LineNotation'
import {
  emptyLineFingering,
  flattenLinePitches,
  lineShape,
  type LineNote,
  type LineNoteValue,
  type LineTuplet,
} from '../theory/lineOutline'
import { MAX_PLAYABLE_FRET, STRING_COUNT } from '../theory/fretboard'
import { tupletLabel, valueGlyph } from '../theory/lineNotation'

const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e']
const INLAYS = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24])
const ALL_FRETS = Array.from({ length: MAX_PLAYABLE_FRET }, (_, i) => i + 1)

export function visitMarks(
  notes: readonly LineNote[],
  string: number
): Map<number, string> {
  const marks = new Map<number, number[]>()
  flattenLinePitches(notes).forEach((pitch) => {
    if (pitch.string !== string) return
    const list = marks.get(pitch.fret) ?? []
    if (!list.includes(pitch.at)) list.push(pitch.at)
    marks.set(pitch.fret, list)
  })
  return new Map(
    [...marks.entries()].map(([fret, orders]) => [fret, orders.join(',')])
  )
}

export function LineNeckGrid({
  notes,
  fretNumbers,
  nextValue,
  nextTuplet,
  stack = false,
  compact = false,
  onAdd,
}: {
  notes: LineNote[]
  fretNumbers: number[]
  nextValue: LineNoteValue
  nextTuplet?: LineTuplet
  stack?: boolean
  compact?: boolean
  onAdd: (string: number, fret: number) => void
}) {
  const labelWidth = compact ? '22px' : '28px'
  const openWidth = compact ? '22px' : '28px'
  const minCell = compact ? '22px' : '26px'
  const next = `${stack ? 'Stack' : 'Add'} ${valueGlyph(nextValue)}${
    nextTuplet ? ` ${tupletLabel(nextTuplet).toLowerCase()}` : ''
  }`
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
        const marks = visitMarks(notes, string)
        return (
          <LineFretRow
            key={string}
            string={string}
            label={STRING_LABELS[string]}
            marks={marks}
            fretNumbers={fretNumbers}
            compact={compact}
            next={next}
            onAdd={onAdd}
          />
        )
      })}
    </div>
  )
}

function LineFretRow({
  string,
  label,
  marks,
  fretNumbers,
  compact,
  next,
  onAdd,
}: {
  string: number
  label: string
  marks: Map<number, string>
  fretNumbers: number[]
  compact: boolean
  next: string
  onAdd: (string: number, fret: number) => void
}) {
  return (
    <>
      <p className="self-center pr-1 text-right text-[11px] font-semibold text-cosmos-400">
        {label}
      </p>
      <LineFretCell
        mark={marks.get(0)}
        inlay={false}
        open
        compact={compact}
        label={`Add ${label} open, ${next}`}
        onClick={() => onAdd(string, 0)}
      />
      {fretNumbers.map((fret) => (
        <LineFretCell
          key={`${string}-${fret}`}
          mark={marks.get(fret)}
          inlay={INLAYS.has(fret)}
          open={false}
          compact={compact}
          label={`Add ${label} fret ${fret}, ${next}`}
          onClick={() => onAdd(string, fret)}
        />
      ))}
    </>
  )
}

function LineFretCell({
  mark,
  inlay,
  open,
  compact,
  label,
  onClick,
}: {
  mark?: string
  inlay: boolean
  open: boolean
  compact: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`relative flex items-center justify-center rounded-sm transition ${
        compact ? 'h-7' : 'h-8'
      } ${
        open
          ? 'bg-cosmos-900 text-cosmos-500 hover:bg-cosmos-800 hover:text-white'
          : inlay
            ? 'bg-cosmos-800/80 text-cosmos-400 hover:bg-cosmos-700 hover:text-white'
            : 'bg-cosmos-850 text-cosmos-400 hover:bg-cosmos-800 hover:text-white'
      }`}
    >
      {mark ? (
        <span
          className={`font-bold text-gold-400 ${
            mark.length > 3 ? 'text-[8px]' : compact ? 'text-[9px]' : 'text-[10px]'
          }`}
        >
          {mark}
        </span>
      ) : open ? (
        <span className="text-[10px] font-semibold">o</span>
      ) : inlay ? (
        <span className="block h-1.5 w-1.5 rounded-full bg-cosmos-600" />
      ) : null}
    </button>
  )
}

interface ModalProps {
  open: boolean
  notes: LineNote[]
  value: LineNoteValue
  tuplet?: LineTuplet
  stack?: boolean
  selected?: number
  onValueChange: (value: LineNoteValue) => void
  onTupletChange: (tuplet: LineTuplet | undefined) => void
  onStackChange: (stack: boolean) => void
  onSelectedChange?: (index: number) => void
  onAdd: (string: number, fret: number) => void
  onChangeNotes: (notes: LineNote[]) => void
  onClear: () => void
  onClose: () => void
  rootName?: string
  bpm?: number
}

export function LineFretboardModal({
  open,
  notes,
  value,
  tuplet,
  stack,
  selected,
  onValueChange,
  onTupletChange,
  onStackChange,
  onSelectedChange,
  onAdd,
  onChangeNotes,
  onClear,
  onClose,
  rootName,
  bpm,
}: ModalProps) {
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
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-cosmos-700/70 px-4 py-3 sm:px-5">
          <div className="min-w-[12rem] flex-1">
            <h2
              id="line-fretboard-title"
              className="text-lg font-semibold tracking-tight text-white"
            >
              Line fretboard
            </h2>
            <p className="mt-0.5 text-sm text-cosmos-400">
              Pick a rhythm, then click frets. Stack adds a pitch to the
              selected staff note.
            </p>
            <div className="mt-2">
              <LineRhythmPicker
                value={value}
                tuplet={tuplet}
                stack={stack}
                onChange={onValueChange}
                onTupletChange={onTupletChange}
                onStackChange={onStackChange}
              />
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-cosmos-700 px-3 py-1.5 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
            >
              Close
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
          <div className="overflow-x-auto rounded-xl border border-cosmos-700/60 bg-cosmos-950/50 p-2">
            <LineNeckGrid
              notes={notes}
              fretNumbers={ALL_FRETS}
              nextValue={value}
              nextTuplet={tuplet}
              stack={stack}
              compact
              onAdd={onAdd}
            />
          </div>

          {notes.length > 0 ? (
            <div className="space-y-3 rounded-xl border border-nebula-500/40 bg-nebula-500/8 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <ChordDiagram
                  fingering={emptyLineFingering()}
                  shape={lineShape()}
                  size="md"
                  kind="line"
                  highlightedNotes={flattenLinePitches(notes)}
                />
                <div className="min-w-[140px] flex-1">
                  <p className="text-lg font-bold text-white">Line</p>
                  <p className="mt-0.5 text-xs text-cosmos-300">
                    {flattenLinePitches(notes).length} note
                    {flattenLinePitches(notes).length === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClear}
                  className="rounded-lg border border-cosmos-700 px-3 py-2 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
                >
                  Clear
                </button>
              </div>
              <LineNotation
                notes={notes}
                rootName={rootName}
                bpm={bpm}
                fixed
                selected={selected}
                onSelectedChange={onSelectedChange}
                onChange={onChangeNotes}
              />
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-cosmos-700 p-4 text-center text-sm text-cosmos-400">
              Choose a rhythm above, then click a fret. Click the same fret again
              to write it twice.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
