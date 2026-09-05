import { useMemo } from 'react'

import { diagramFretWindow } from './fretWindow'
import {
  STRING_COUNT,
  type Fingering,
} from '../theory/fretboard'
import type { LickOutlineNote } from '../theory/lickOutline'

interface Props {
  fingering: Fingering
  notes: LickOutlineNote[]
  className?: string
}

const STRING_GAP = 16
const FRET_GAP = 18
const DOT = 6.4
const FONT = 6.4
const PAD_TOP = 16
const PAD_LABEL = 18
const PAD_SIDE = 10
const PAD_BOTTOM = 4

export function LickOutlineChart({ fingering, notes, className }: Props) {
  const box = useMemo(
    () =>
      diagramFretWindow(fingering, {
        highlightedFrets: notes.map((note) => note.fret),
      }),
    [fingering, notes]
  )
  const { startFret, fretRows, showNut } = box
  const gridWidth = STRING_GAP * (STRING_COUNT - 1)
  const gridHeight = FRET_GAP * fretRows
  const width = gridWidth + PAD_LABEL + PAD_SIDE
  const height = gridHeight + PAD_TOP + PAD_BOTTOM
  const x = (stringIndex: number) => PAD_LABEL + stringIndex * STRING_GAP
  const y = (fret: number) => PAD_TOP + (fret - startFret + 0.5) * FRET_GAP
  const markerY = PAD_TOP - FONT * 0.7
  const occupied = new Set(
    fingering.notes.map((note) => `${note.string}:${note.fret}`)
  )

  return (
    <div className={className}>
      <p className="mb-1 text-[10px] font-semibold tracking-[0.12em] text-cosmos-500 uppercase">
        Chord tones
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="mx-auto h-auto w-full max-w-[8.5rem] text-cosmos-500"
        role="img"
        aria-label={`Chord tones near the grip: ${notes
          .map((note) => `${note.degree} ${note.name}`)
          .join(', ')}`}
      >
        {Array.from({ length: fretRows + 1 }, (_, i) => (
          <line
            key={`fret-${i}`}
            x1={PAD_LABEL}
            y1={PAD_TOP + i * FRET_GAP}
            x2={PAD_LABEL + gridWidth}
            y2={PAD_TOP + i * FRET_GAP}
            stroke="currentColor"
            strokeWidth={0.7}
            className="text-cosmos-700"
          />
        ))}
        {showNut && (
          <line
            x1={PAD_LABEL - 0.5}
            y1={PAD_TOP}
            x2={PAD_LABEL + gridWidth + 0.5}
            y2={PAD_TOP}
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            className="text-cosmos-500"
          />
        )}
        {Array.from({ length: STRING_COUNT }, (_, i) => (
          <line
            key={`string-${i}`}
            x1={x(i)}
            y1={PAD_TOP}
            x2={x(i)}
            y2={PAD_TOP + gridHeight}
            stroke="currentColor"
            strokeWidth={1.1 - i * 0.1}
            className="text-cosmos-700"
          />
        ))}
        {!showNut &&
          Array.from({ length: fretRows }, (_, i) => (
            <text
              key={`num-${startFret + i}`}
              x={PAD_LABEL - 3}
              y={PAD_TOP + (i + 0.5) * FRET_GAP}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={7}
              className="fill-cosmos-600"
            >
              {startFret + i}
            </text>
          ))}
        {fingering.notes.map((note) => {
          const cx = x(note.string)
          const cy = note.fret === 0 ? markerY : y(note.fret)
          if (note.fret > 0 && (note.fret < startFret || note.fret > startFret + fretRows - 1)) {
            return null
          }
          return (
            <circle
              key={`grip-${note.string}-${note.fret}`}
              cx={cx}
              cy={cy}
              r={DOT * 0.42}
              className="fill-cosmos-500"
            />
          )
        })}
        {notes.map((note) => {
          if (occupied.has(`${note.string}:${note.fret}`)) return null
          const cx = x(note.string)
          const cy = note.fret === 0 ? markerY : y(note.fret)
          if (note.fret > 0 && (note.fret < startFret || note.fret > startFret + fretRows - 1)) {
            return null
          }
          return (
            <g key={`lick-${note.string}-${note.fret}`}>
              <circle
                cx={cx}
                cy={cy}
                r={DOT}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.4}
                className="text-star-400"
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FONT}
                fontWeight={700}
                className="fill-star-300"
              >
                {note.degree}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
