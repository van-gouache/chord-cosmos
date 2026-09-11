/**
 * SVG chord box diagram: six vertical strings, a window of frets, and a dot
 * for each note labelled with its scale degree.
 */

import { useMemo, type MouseEvent, type PointerEvent } from 'react'

import { diagramFretWindow } from './fretWindow'
import { INTERVAL_OPTIONS } from '../theory/chords'
import { STANDARD_TUNING, STRING_COUNT, type Fingering } from '../theory/fretboard'
import { mod12 } from '../theory/pitch'
import type { VoicingShape } from '../theory/vsystem'

export type DiagramSize = 'sm' | 'nb' | 'md' | 'lg' | 'seq' | 'present'

interface Props {
  fingering: Fingering
  shape: VoicingShape
  size?: DiagramSize
  /** Draw the scale degree inside each dot. */
  showDegrees?: boolean
  /** Extra hollow markers on empty string/fret cells. */
  highlightedNotes?: readonly { string: number; fret: number }[]
  /** Line outlines hide mutes and number notes in click order. */
  kind?: 'chord' | 'line'
  /** Pitch class used to colour outlines; defaults to the grip's root. */
  rootPc?: number
  /** When set, clicking an empty cell toggles an outline there. */
  onToggleNote?: (note: { string: number; fret: number }) => void
  /** Extra fret rows toward the nut. */
  extendLow?: number
  /** Extra fret rows toward the body. */
  extendHigh?: number
  className?: string
}

const SIZES: Record<
  DiagramSize,
  {
    stringGap: number
    fretGap: number
    dot: number
    font: number
    markerFont: number
    padTop: number
    /** Left gutter — wide enough for two-digit fret numbers after an octave shift. */
    padLabel: number
    padSide: number
    padBottom: number
  }
> = {
  sm: {
    stringGap: 13,
    fretGap: 16,
    dot: 6,
    font: 6.2,
    markerFont: 7,
    padTop: 16,
    padLabel: 22,
    padSide: 14,
    padBottom: 4,
  },
  nb: {
    stringGap: 14,
    fretGap: 17,
    dot: 6.4,
    font: 6.6,
    markerFont: 7.2,
    padTop: 15,
    padLabel: 18,
    padSide: 10,
    padBottom: 4,
  },
  md: {
    stringGap: 19,
    fretGap: 23,
    dot: 7.6,
    font: 8,
    markerFont: 9.5,
    padTop: 19,
    padLabel: 26,
    padSide: 18,
    padBottom: 6,
  },
  seq: {
    stringGap: 23,
    fretGap: 28,
    dot: 9,
    font: 9.5,
    markerFont: 11,
    padTop: 22,
    padLabel: 32,
    padSide: 20,
    padBottom: 7,
  },
  lg: {
    stringGap: 25,
    fretGap: 30,
    dot: 10,
    font: 10.5,
    markerFont: 12,
    padTop: 24,
    padLabel: 34,
    padSide: 22,
    padBottom: 8,
  },
  present: {
    stringGap: 40,
    fretGap: 48,
    dot: 15,
    font: 14,
    markerFont: 16,
    padTop: 34,
    padLabel: 44,
    padSide: 30,
    padBottom: 12,
  },
}

export function ChordDiagram({
  fingering,
  shape,
  size = 'md',
  showDegrees = true,
  highlightedNotes,
  kind = 'chord',
  rootPc: rootPcOverride,
  onToggleNote,
  extendLow,
  extendHigh,
  className,
}: Props) {
  const s = SIZES[size]

  const isLine = kind === 'line'
  const box = useMemo(
    () =>
      diagramFretWindow(fingering, {
        highlightedFrets: highlightedNotes?.map((note) => note.fret) ?? [],
        extendLow,
        extendHigh,
        ...(isLine ? { tightHighlights: true, minRows: 1 } : {}),
      }),
    [fingering, highlightedNotes, extendLow, extendHigh, isLine]
  )

  const { startFret, fretRows, showNut } = box

  const gridWidth = s.stringGap * (STRING_COUNT - 1)
  const gridHeight = s.fretGap * fretRows
  const width = gridWidth + s.padLabel + s.padSide

  const height = gridHeight + s.padTop + s.padBottom

  const x = (stringIndex: number) => s.padLabel + stringIndex * s.stringGap
  /** Vertical centre of the given fret's cell. */
  const y = (fret: number) =>
    s.padTop + (fret - startFret + 0.5) * s.fretGap
  const markerY = s.padTop - s.markerFont * 0.7

  const toneOf = (voice: number) => shape.voiceTones[voice]
  const degreeOf = (voice: number) => toneOf(voice)?.degree ?? ''
  const styleOf = (voice: number) => intervalStyle(toneOf(voice)?.semitones)

  const playedStrings = new Set(
    isLine
      ? (highlightedNotes ?? []).map((note) => note.string)
      : fingering.notes.map((n) => n.string)
  )
  const noteByString = new Map(fingering.notes.map((n) => [n.string, n]))
  const occupied = new Set(
    fingering.notes.map((note) => cellKey(note.string, note.fret))
  )
  const outlined = new Set(
    (highlightedNotes ?? [])
      .filter((note) => !occupied.has(cellKey(note.string, note.fret)))
      .map((note) => cellKey(note.string, note.fret))
  )
  const extraMarks = outlined
  const visibleExtraMarks = [...extraMarks].filter((key) => {
    const fret = Number(key.split(':')[1])
    // Open strings sit in the marker row above the box, which is drawn even
    // when the window starts up the neck.
    if (fret === 0) return true
    return fret >= startFret && fret < startFret + fretRows
  })
  const interactive = Boolean(onToggleNote)
  const rootPc = rootPcOverride ?? rootPitchClass(fingering, shape)
  const noteHits: NoteHit[] = []

  if (interactive) {
    for (let stringIndex = 0; stringIndex < STRING_COUNT; stringIndex++) {
      const includeOpen =
        !isLine || showNut || outlined.has(cellKey(stringIndex, 0))
      if (includeOpen && !occupied.has(cellKey(stringIndex, 0))) {
        noteHits.push({
          stringIndex,
          fret: 0,
          cx: x(stringIndex),
          cy: markerY,
          r: s.dot * 0.9,
          cellW: s.stringGap,
          cellH: Math.max(s.dot * 2.4, s.markerFont * 1.8),
        })
      }
      for (let row = 0; row < fretRows; row++) {
        const fret = startFret + row
        if (occupied.has(cellKey(stringIndex, fret))) continue
        noteHits.push({
          stringIndex,
          fret,
          cx: x(stringIndex),
          cy: y(fret),
          r: s.dot,
          cellW: s.stringGap,
          cellH: s.fretGap,
        })
      }
    }
  }

  const renderDot = (
    stringIndex: number,
    fret: number,
    cx: number,
    cy: number,
    radius: number,
    fontSize: number
  ) => {
    const voice = noteByString.get(stringIndex)?.voice ?? 0
    const style = styleOf(voice)
    const label = degreeOf(voice)

    const mark = showDegrees ? (
      <>
        <circle cx={cx} cy={cy} r={radius} className={style.fill} />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight={700}
          className={style.text}
        >
          {label}
        </text>
      </>
    ) : (
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        className={style.stroke}
      />
    )

    return <g key={`dot-${stringIndex}-${fret}`}>{mark}</g>
  }

  const renderOutline = (stringIndex: number, fret: number) => {
    const cx = x(stringIndex)
    const cy = fret === 0 ? markerY : y(fret)
    const radius = fret === 0 ? s.dot * 0.9 : s.dot
    const tone = toneAt(rootPc, stringIndex, fret)
    if (isLine) {
      return (
        <g key={`outline-${stringIndex}-${fret}`}>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            className={intervalStyle(0).fill}
          />
        </g>
      )
    }
    return (
      <g key={`outline-${stringIndex}-${fret}`}>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={Math.max(1.6, radius * 0.22)}
          className={tone.style.stroke}
        />
        {showDegrees && (
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fret === 0 ? s.font * 0.92 : s.font}
            fontWeight={700}
            className={tone.style.fill}
          >
            {tone.degree}
          </text>
        )}
      </g>
    )
  }

  const svg = (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={
        interactive
          ? 'pointer-events-none h-auto w-full'
          : (className ?? undefined)
      }
      role="img"
      aria-label={`Chord diagram, ${fingering.strings
        .map((f) => (f === null ? 'muted' : `fret ${f}`))
        .join(', ')}`}
    >
      {/* Fret wires */}
      {Array.from({ length: fretRows + 1 }, (_, i) => (
        <line
          key={`fret-${i}`}
          x1={s.padLabel}
          y1={s.padTop + i * s.fretGap}
          x2={s.padLabel + gridWidth}
          y2={s.padTop + i * s.fretGap}
          stroke="currentColor"
          strokeWidth={0.8}
          className="text-cosmos-600"
        />
      ))}

      {/* The nut, drawn thick when the shape sits at the top of the neck */}
      {showNut && (
        <line
          x1={s.padLabel - 0.5}
          y1={s.padTop}
          x2={s.padLabel + gridWidth + 0.5}
          y2={s.padTop}
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          className="text-cosmos-300"
        />
      )}

      {/* Strings, thinning as they get higher */}
      {Array.from({ length: STRING_COUNT }, (_, i) => (
        <line
          key={`string-${i}`}
          x1={x(i)}
          y1={s.padTop}
          x2={x(i)}
          y2={s.padTop + gridHeight}
          stroke="currentColor"
          strokeWidth={1.3 - i * 0.12}
          className={playedStrings.has(i) ? 'text-cosmos-400' : 'text-cosmos-700'}
        />
      ))}

      {/* Fret numbers — every row, so an octave shift is obvious */}
      {!showNut &&
        Array.from({ length: fretRows }, (_, i) => (
          <text
            key={`fret-num-${startFret + i}`}
            x={s.padLabel - 4}
            y={s.padTop + (i + 0.5) * s.fretGap}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={s.markerFont}
            className="fill-cosmos-400"
            fontWeight={500}
          >
            {startFret + i}
          </text>
        ))}

      {/* Open / muted markers above the nut */}
      {!isLine &&
        Array.from({ length: STRING_COUNT }, (_, i) => {
        const fret = fingering.strings[i]
        if (fret === null && extraMarks.has(cellKey(i, 0))) return null
        if (fret === null) {
          const r = s.markerFont * 0.32
          return (
            <g key={`mute-${i}`} className="text-cosmos-600">
              <line
                x1={x(i) - r}
                y1={markerY - r}
                x2={x(i) + r}
                y2={markerY + r}
                stroke="currentColor"
                strokeWidth={1.3}
                strokeLinecap="round"
              />
              <line
                x1={x(i) + r}
                y1={markerY - r}
                x2={x(i) - r}
                y2={markerY + r}
                stroke="currentColor"
                strokeWidth={1.3}
                strokeLinecap="round"
              />
            </g>
          )
        }
        if (fret === 0) {
          const r = showDegrees ? s.dot * 0.9 : s.markerFont * 0.42
          return renderDot(i, 0, x(i), markerY, r, s.font * 0.92)
        }
        return null
      })}

      {/* Barre bar behind the dots */}
      {!isLine &&
        fingering.barreFret !== null &&
        (() => {
          const barred = fingering.notes.filter(
            (n) => n.fret === fingering.barreFret
          )
          const from = Math.min(...barred.map((n) => n.string))
          const to = Math.max(...barred.map((n) => n.string))
          return (
            <rect
              x={x(from) - s.dot}
              y={y(fingering.barreFret) - s.dot}
              width={x(to) - x(from) + s.dot * 2}
              height={s.dot * 2}
              rx={s.dot}
              className="fill-cosmos-400/35"
            />
          )
        })()}

      {/* Fretted notes */}
      {!isLine &&
        fingering.notes
          .filter((n) => n.fret > 0)
          .map((note) =>
            renderDot(
              note.string,
              note.fret,
              x(note.string),
              y(note.fret),
              s.dot,
              s.font
            )
          )}

      {visibleExtraMarks.map((key) => {
        const [stringIndex, fret] = key.split(':').map(Number)
        return renderOutline(stringIndex, fret)
      })}
    </svg>
  )

  if (!interactive || !onToggleNote) return svg

  return (
    <div className={`pointer-events-none relative inline-block ${className ?? ''}`}>
      {svg}
      {noteHits.map((hit) => {
        const highlighted = outlined.has(cellKey(hit.stringIndex, hit.fret))
        const tone = toneAt(rootPc, hit.stringIndex, hit.fret)
        return (
          <button
            key={`hit-${hit.stringIndex}-${hit.fret}`}
            type="button"
            data-highlight-note=""
            draggable={false}
            aria-pressed={highlighted}
            aria-label={`${highlighted ? 'Remove' : 'Add'} ${isLine ? 'line' : tone.degree} outline on string ${hit.stringIndex + 1}${hit.fret === 0 ? ', open' : `, fret ${hit.fret}`}`}
            className="pointer-events-auto absolute cursor-pointer touch-manipulation rounded-full border-0 bg-transparent p-0 hover:bg-white/10"
            style={{
              left: `${((hit.cx - hit.cellW / 2) / width) * 100}%`,
              top: `${((hit.cy - hit.cellH / 2) / height) * 100}%`,
              width: `${(hit.cellW / width) * 100}%`,
              height: `${(hit.cellH / height) * 100}%`,
            }}
            onPointerDown={holdSlotDrag}
            onMouseDown={holdSlotDrag}
            onPointerUp={releaseSlotDrag}
            onPointerCancel={releaseSlotDrag}
            onMouseUp={releaseSlotDrag}
            onClick={(event) => {
              event.stopPropagation()
              onToggleNote({ string: hit.stringIndex, fret: hit.fret })
            }}
          />
        )
      })}
    </div>
  )
}

type NoteHit = {
  stringIndex: number
  fret: number
  cx: number
  cy: number
  r: number
  cellW: number
  cellH: number
}

function cellKey(stringIndex: number, fret: number): string {
  return `${stringIndex}:${fret}`
}

function rootPitchClass(fingering: Fingering, shape: VoicingShape): number {
  const root = fingering.notes.find(
    (note) => shape.voiceTones[note.voice]?.degree === 'R'
  )
  const note = root ?? fingering.notes[0]
  if (!note) return 0
  const semitones = shape.voiceTones[note.voice]?.semitones ?? 0
  return mod12(note.midi - semitones)
}

function toneAt(rootPc: number, stringIndex: number, fret: number) {
  const midi = STANDARD_TUNING[stringIndex] + fret
  const semitones = mod12(midi - rootPc)
  const degree =
    INTERVAL_OPTIONS.find((option) => option.semitones === semitones)?.degree ??
    'R'
  return { degree, style: intervalStyle(semitones) }
}

function holdSlotDrag(event: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>) {
  event.stopPropagation()
  const slot = event.currentTarget.closest('[data-slot-cell]')
  if (!(slot instanceof HTMLElement)) return
  if (slot.dataset.dragLocked === '1') return
  slot.dataset.dragLocked = '1'
  slot.dataset.wasDraggable = slot.draggable ? '1' : '0'
  slot.draggable = false
}

function releaseSlotDrag(event: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>) {
  const slot = event.currentTarget.closest('[data-slot-cell]')
  if (!(slot instanceof HTMLElement) || slot.dataset.dragLocked !== '1') return
  slot.draggable = slot.dataset.wasDraggable === '1'
  delete slot.dataset.dragLocked
  delete slot.dataset.wasDraggable
}

const INTERVAL_STYLE: Record<
  number,
  { fill: string; stroke: string; text: string }
> = {
  0: { fill: 'fill-gold-400', stroke: 'text-gold-400', text: 'fill-cosmos-950' },
  1: { fill: 'fill-rose-400', stroke: 'text-rose-400', text: 'fill-cosmos-950' },
  2: { fill: 'fill-orange-400', stroke: 'text-orange-400', text: 'fill-cosmos-950' },
  3: { fill: 'fill-amber-300', stroke: 'text-amber-300', text: 'fill-cosmos-950' },
  4: { fill: 'fill-yellow-200', stroke: 'text-yellow-200', text: 'fill-cosmos-950' },
  5: { fill: 'fill-lime-400', stroke: 'text-lime-400', text: 'fill-cosmos-950' },
  6: { fill: 'fill-emerald-400', stroke: 'text-emerald-400', text: 'fill-cosmos-950' },
  7: { fill: 'fill-teal-400', stroke: 'text-teal-400', text: 'fill-cosmos-950' },
  8: { fill: 'fill-cyan-400', stroke: 'text-cyan-400', text: 'fill-cosmos-950' },
  9: { fill: 'fill-sky-400', stroke: 'text-sky-400', text: 'fill-cosmos-950' },
  10: { fill: 'fill-nebula-400', stroke: 'text-nebula-400', text: 'fill-white' },
  11: { fill: 'fill-fuchsia-400', stroke: 'text-fuchsia-400', text: 'fill-white' },
}

function intervalStyle(semitones: number | undefined) {
  const pc = ((semitones ?? 0) % 12 + 12) % 12
  return INTERVAL_STYLE[pc] ?? INTERVAL_STYLE[0]
}
