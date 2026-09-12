import { type ReactNode, useEffect, useMemo, useState } from 'react'

import { playLineMelody } from '../audio/player'
import { DEFAULT_BPM } from '../state/songs'
import {
  beatsLabel,
  columnLabel,
  ledgerSteps,
  LINE_NOTE_VALUES,
  LINE_TUPLETS,
  lineNotationBeats,
  lineStaffColumns,
  moveLineNote,
  STEM_SPLIT,
  TREBLE_BOTTOM,
  TREBLE_TOP,
  tupletGroups,
  tupletLabel,
  tupletNormal,
  valueGlyph,
  valueLabel,
} from '../theory/lineNotation'
import {
  removeLineNoteAt,
  type LineNote,
  type LineNoteValue,
  type LineTuplet,
} from '../theory/lineOutline'

interface StaffProps {
  notes: LineNote[]
  rootName?: string
  bpm?: number
  compact?: boolean
  /** Keep the staff at a constant scale and scroll inside a fixed frame. */
  fixed?: boolean
  onChange?: (notes: LineNote[]) => void
  selected?: number
  onSelectedChange?: (index: number) => void
  /** Extra controls shown beside Hear line. */
  actions?: ReactNode
}

const LINE_GAP = 7
const NOTE_GAP = 24
const PAD_LEFT = 26
const PAD_RIGHT = 12
const PAD_TOP = 10
const PAD_BOTTOM = 16
const HEAD_RX = 4.4
const HEAD_RY = 3.2
/** An octave of staff steps, the usual stem length. */
const STEM = 24.5
const TUPLET_ROOM = 14
const TUPLET_TICK = 3.5
/** Clearance between a tuplet bracket and the tallest note under it. */
const TUPLET_LIFT = 7
const ACCIDENTAL_ROOM = 8
/** Sideways shift for the upper note of a second. */
const SECOND_SHIFT = 8
/** Room under the staff for the note-order numbers. */
const NUMBER_ROW = 9
/** Pixel scale when the staff is locked to a fixed frame. */
const STAFF_SCALE = 2.25

/** Written in full so Tailwind keeps these classes. */
const PALETTES = {
  ink: {
    head: 'fill-current',
    headOpen: 'fill-none stroke-current',
    stem: 'text-current',
  },
  gold: {
    head: 'fill-gold-400',
    headOpen: 'fill-none stroke-gold-400',
    stem: 'text-gold-400',
  },
  nebula: {
    head: 'fill-nebula-300',
    headOpen: 'fill-none stroke-nebula-300',
    stem: 'text-nebula-300',
  },
} as const

export function LineRhythmPicker({
  value,
  tuplet,
  stack = false,
  onChange,
  onTupletChange,
  onStackChange,
}: {
  value: LineNoteValue
  tuplet?: LineTuplet
  stack?: boolean
  onChange: (value: LineNoteValue) => void
  onTupletChange: (tuplet: LineTuplet | undefined) => void
  onStackChange: (stack: boolean) => void
}) {
  return (
    <div
      data-no-drag=""
      className="space-y-1"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <p className="text-[10px] font-semibold tracking-[0.12em] text-cosmos-500 uppercase">
        Rhythm
      </p>
      <p className="text-[10px] text-cosmos-500">
        {stack
          ? 'Next fret stacks onto the selected staff note.'
          : 'Then click a fret. Same fret can repeat.'}
      </p>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Next note value">
        {LINE_NOTE_VALUES.map((item) => (
          <button
            key={item}
            type="button"
            title={`${valueLabel(item)} — the next fret click uses this value`}
            aria-pressed={value === item}
            onClick={() => onChange(item)}
            className={chipClass(value === item)}
          >
            {valueGlyph(item)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Next note tuplet">
        <button
          type="button"
          title="Straight time — no tuplet"
          aria-pressed={tuplet === undefined}
          onClick={() => onTupletChange(undefined)}
          className={chipClass(tuplet === undefined)}
        >
          ♪♪
        </button>
        {LINE_TUPLETS.map((item) => (
          <button
            key={item}
            type="button"
            title={`${tupletLabel(item)} — ${item} in the time of ${tupletNormal(item)}`}
            aria-pressed={tuplet === item}
            onClick={() => onTupletChange(item)}
            className={chipClass(tuplet === item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Next fret placement">
        <button
          type="button"
          title="Add a new note after the last one"
          aria-pressed={!stack}
          onClick={() => onStackChange(false)}
          className={chipClass(!stack)}
        >
          Add
        </button>
        <button
          type="button"
          title="Stack onto the selected staff note"
          aria-pressed={stack}
          onClick={() => onStackChange(true)}
          className={chipClass(stack)}
        >
          Stack
        </button>
      </div>
    </div>
  )
}

interface LineStaffProps {
  notes: LineNote[]
  rootName?: string
  /** Draw everything in the inherited text colour, for paper backgrounds. */
  ink?: boolean
  /** Let the staff fill its container instead of capping its width. */
  wide?: boolean
  /** Draw at a constant pixel scale instead of stretching to the container. */
  fixed?: boolean
  numbered?: boolean
  selected?: number | null
  onSelect?: (index: number) => void
  className?: string
}

/** The written staff on its own: no controls, no playback. */
export function LineStaff({
  notes,
  rootName,
  ink = false,
  wide = false,
  fixed = false,
  numbered = true,
  selected = null,
  onSelect,
  className,
}: LineStaffProps) {
  const columns = useMemo(() => lineStaffColumns(notes, rootName), [notes, rootName])
  const groups = useMemo(() => tupletGroups(notes), [notes])

  if (columns.length === 0) return null

  const steps = columns.flatMap((column) => column.voices.map((voice) => voice.step))
  const maxStep = Math.max(TREBLE_TOP + 1, ...steps)
  const minStep = Math.min(TREBLE_BOTTOM - 1, ...steps)
  const staffTop = PAD_TOP + (groups.length > 0 ? TUPLET_ROOM : 0)
  const yOf = (step: number) => staffTop + (maxStep - step) * (LINE_GAP / 2)
  /** Heads sit a fixed gap apart, widened where an accidental needs room. */
  const centers: number[] = []
  let cursor = PAD_LEFT
  for (const column of columns) {
    if (column.voices.some((voice) => voice.accidental)) cursor += ACCIDENTAL_ROOM
    if (column.voices.length > 1) cursor += 2
    centers.push(cursor + NOTE_GAP / 2)
    cursor += NOTE_GAP
  }
  const xOf = (index: number) => centers[index]
  /** Top of a column's own ink, stem included. */
  const inkTop = (index: number) => {
    const column = columns[index]
    const mid =
      column.voices.reduce((sum, voice) => sum + voice.step, 0) /
      column.voices.length
    const topStep = column.voices[column.voices.length - 1]?.step ?? mid
    const bottomStep = column.voices[0]?.step ?? mid
    return mid <= STEM_SPLIT ? yOf(topStep) - STEM : yOf(bottomStep) - HEAD_RY
  }
  const width = cursor + PAD_RIGHT
  const height =
    yOf(minStep) + (numbered ? PAD_BOTTOM : PAD_BOTTOM - NUMBER_ROW)
  const paletteFor = (index: number) =>
    PALETTES[ink ? 'ink' : index === selected ? 'nebula' : 'gold']

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={fixed ? width * STAFF_SCALE : width}
      height={fixed ? height * STAFF_SCALE : height}
      className={
        className ??
        (fixed
          ? 'shrink-0 text-cosmos-300'
          : `h-auto w-full text-cosmos-300 ${wide ? 'max-w-none' : 'max-w-[22rem]'}`)
      }
      role="img"
      aria-label={`Written line: ${columns.map(columnLabel).join(', ')}`}
    >
      {Array.from({ length: 5 }, (_, i) => {
        const step = TREBLE_TOP - i * 2
        return (
          <line
            key={`staff-${step}`}
            x1={PAD_LEFT - 14}
            y1={yOf(step)}
            x2={width - 4}
            y2={yOf(step)}
            stroke="currentColor"
            strokeWidth={0.8}
            opacity={ink ? 0.45 : 1}
            className={ink ? undefined : 'text-cosmos-600'}
          />
        )
      })}
      <text
        x={4}
        y={yOf(TREBLE_BOTTOM + 2) + 1}
        fontSize={22}
        className={ink ? 'fill-current' : 'fill-cosmos-400'}
      >
        𝄞
      </text>
      {groups.map((group) => {
        const x1 = xOf(group.start) - HEAD_RX - 2
        const x2 = xOf(group.end) + HEAD_RX + 2
        const mid = (x1 + x2) / 2
        let top = yOf(TREBLE_TOP) - TUPLET_LIFT
        for (let i = group.start; i <= group.end; i += 1) {
          top = Math.min(top, inkTop(i) - TUPLET_LIFT)
        }
        top = Math.max(top, 3)
        return (
          <g
            key={`tuplet-${group.start}`}
            className={ink ? undefined : 'text-cosmos-400'}
          >
            <path
              d={`M ${x1} ${top + TUPLET_TICK} L ${x1} ${top} L ${mid - 4} ${top}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.8}
            />
            <path
              d={`M ${mid + 4} ${top} L ${x2} ${top} L ${x2} ${top + TUPLET_TICK}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.8}
            />
            <text
              x={mid}
              y={top + 3}
              textAnchor="middle"
              fontSize={8}
              fontStyle="italic"
              className={ink ? 'fill-current' : 'fill-cosmos-300'}
            >
              {group.tuplet}
            </text>
          </g>
        )
      })}
      {columns.map((column, index) => {
        const x = xOf(index)
        const mid =
          column.voices.reduce((sum, voice) => sum + voice.step, 0) /
          column.voices.length
        const up = mid <= STEM_SPLIT
        const open = column.value === 1 || column.value === 2
        const topVoice = column.voices[column.voices.length - 1]
        const bottomVoice = column.voices[0]
        const stemX = up ? x + HEAD_RX - 0.6 : x - HEAD_RX + 0.6
        const stemFrom = yOf(up ? bottomVoice.step : topVoice.step)
        const stemEnd = up ? yOf(topVoice.step) - STEM : yOf(bottomVoice.step) + STEM
        const palette = paletteFor(index)
        const shifts = secondShifts(column.voices.map((voice) => voice.step), up)
        return (
          <g key={`col-${index}-${columnLabel(column)}`}>
            {[...new Set(column.voices.flatMap((voice) => ledgerSteps(voice.step)))].map(
              (step) => (
                <line
                  key={`led-${index}-${step}`}
                  x1={x - 7}
                  y1={yOf(step)}
                  x2={x + 7}
                  y2={yOf(step)}
                  stroke="currentColor"
                  strokeWidth={0.8}
                  opacity={ink ? 0.6 : 1}
                  className={ink ? undefined : 'text-cosmos-500'}
                />
              )
            )}
            {column.voices.map((voice, voiceIndex) => {
              const headX = x + shifts[voiceIndex]
              const y = yOf(voice.step)
              return (
                <g key={`${voice.note.string}-${voice.note.fret}-${voiceIndex}`}>
                  {voice.accidental ? (
                    <text
                      x={headX - HEAD_RX - 4}
                      y={y + 3}
                      textAnchor="middle"
                      fontSize={9}
                      className={ink ? 'fill-current' : 'fill-cosmos-200'}
                    >
                      {voice.accidental}
                    </text>
                  ) : null}
                  <ellipse
                    cx={headX}
                    cy={y}
                    rx={HEAD_RX}
                    ry={HEAD_RY}
                    transform={`rotate(-18 ${headX} ${y})`}
                    className={open ? palette.headOpen : palette.head}
                    strokeWidth={open ? 1.4 : 0}
                  />
                </g>
              )
            })}
            {column.value !== 1 && (
              <line
                x1={stemX}
                y1={stemFrom}
                x2={stemX}
                y2={stemEnd}
                stroke="currentColor"
                strokeWidth={1.1}
                className={palette.stem}
              />
            )}
            {(column.value === 8 || column.value === 16) && (
              <path
                d={flagPath(stemX, stemEnd, up)}
                className={palette.head}
              />
            )}
            {column.value === 16 && (
              <path
                d={flagPath(stemX, stemEnd + (up ? 5 : -5), up)}
                className={palette.head}
              />
            )}
            {numbered ? (
              <text
                x={x}
                y={height - 3}
                textAnchor="middle"
                fontSize={7}
                className={
                  index === selected ? 'fill-nebula-300' : 'fill-cosmos-500'
                }
              >
                {index + 1}
              </text>
            ) : null}
            {onSelect ? (
              <rect
                x={x - NOTE_GAP / 2}
                y={0}
                width={NOTE_GAP}
                height={height}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => onSelect(index)}
              >
                <title>{`${index + 1}. ${columnLabel(column)}`}</title>
              </rect>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

export function LineNotation({
  notes,
  rootName,
  bpm = DEFAULT_BPM,
  compact = false,
  fixed = false,
  onChange,
  selected: selectedProp,
  onSelectedChange,
  actions,
}: StaffProps) {
  const [selectedState, setSelectedState] = useState(0)
  const editable = Boolean(onChange)
  const columns = useMemo(() => lineStaffColumns(notes, rootName), [notes, rootName])
  const selected = selectedProp ?? selectedState
  const setSelected = onSelectedChange ?? setSelectedState

  useEffect(() => {
    if (columns.length === 0) {
      setSelected(0)
      return
    }
    if (selected > columns.length - 1) setSelected(columns.length - 1)
  }, [columns.length, selected, setSelected])

  if (columns.length === 0) {
    if (!editable && !actions) return null
    return (
      <div
        data-no-drag=""
        className="space-y-1.5"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {editable ? (
          <p className="text-[11px] text-cosmos-500">
            Pick a rhythm, then click a fret. The same fret can repeat.
          </p>
        ) : null}
        {actions ? (
          <div className="flex flex-wrap gap-1">{actions}</div>
        ) : null}
      </div>
    )
  }

  const active = columns[Math.min(selected, columns.length - 1)]
  const beats = lineNotationBeats(notes)
  const beatLabel = `${beatsLabel(beats)} beat${beats === 1 ? '' : 's'}`
  const change = (next: LineNote[] | undefined) => onChange?.(next ?? [])

  return (
    <div
      data-no-drag=""
      className="space-y-1.5"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-cosmos-500 uppercase">
          Notation
        </p>
        <p className="text-[10px] text-cosmos-500">{beatLabel} written</p>
      </div>
      {fixed ? (
        <div className="h-48 overflow-auto rounded-lg border border-cosmos-700/50 bg-cosmos-950/50 p-2">
          <LineStaff
            notes={notes}
            rootName={rootName}
            fixed
            selected={editable ? selected : null}
            onSelect={editable ? setSelected : undefined}
          />
        </div>
      ) : (
        <LineStaff
          notes={notes}
          rootName={rootName}
          wide={compact}
          selected={editable ? selected : null}
          onSelect={editable ? setSelected : undefined}
        />
      )}

      {editable && active ? (
        <div className="flex items-center gap-1">
          <p className="min-w-0 flex-1 truncate text-[11px] text-cosmos-300">
            {selected + 1}. {columnLabel(active)}
            {active.voices.length > 1 ? ' stack' : ''}
            {active.tuplet ? ` · ${tupletLabel(active.tuplet).toLowerCase()}` : ''}
          </p>
          <button
            type="button"
            disabled={selected === 0}
            aria-label="Move note earlier"
            onClick={() => {
              change(moveLineNote(notes, selected, selected - 1))
              setSelected(selected - 1)
            }}
            className={chipClass(false)}
          >
            ←
          </button>
          <button
            type="button"
            disabled={selected === notes.length - 1}
            aria-label="Move note later"
            onClick={() => {
              change(moveLineNote(notes, selected, selected + 1))
              setSelected(selected + 1)
            }}
            className={chipClass(false)}
          >
            →
          </button>
          <button
            type="button"
            aria-label="Remove this note"
            onClick={() => change(removeLineNoteAt(notes, selected))}
            className={`${chipClass(false)} hover:border-rose-400 hover:text-rose-200`}
          >
            ✕
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => playLineMelody(notes, bpm)}
          className="h-7 rounded-md border border-cosmos-700 px-2 text-[11px] font-medium text-cosmos-200 transition hover:border-star-400 hover:text-star-300"
        >
          ▶ Hear line
        </button>
        {actions}
      </div>
    </div>
  )
}

/** Offset the upper note of each second so the heads don't collide. */
function secondShifts(steps: readonly number[], up: boolean): number[] {
  const shifts = steps.map(() => 0)
  for (let i = 1; i < steps.length; i += 1) {
    if (steps[i] - steps[i - 1] !== 1) continue
    shifts[i] = shifts[i - 1] === 0 ? (up ? SECOND_SHIFT : -SECOND_SHIFT) : 0
  }
  return shifts
}

function flagPath(x: number, y: number, up: boolean): string {
  const dir = up ? 1 : -1
  return `M ${x} ${y} c 6 ${3 * dir}, 6.5 ${8 * dir}, 2.5 ${11 * dir} c 0.8 ${-4 * dir}, 0 ${-7 * dir}, -2.5 ${-11 * dir} z`
}

function chipClass(active: boolean): string {
  return `h-7 min-w-7 rounded-md border px-1.5 text-xs font-medium transition disabled:opacity-30 ${
    active
      ? 'border-nebula-500 bg-nebula-600 text-white'
      : 'border-cosmos-700 bg-cosmos-900 text-cosmos-200 hover:border-nebula-500 hover:text-white'
  }`
}
