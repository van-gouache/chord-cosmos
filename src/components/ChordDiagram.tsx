/**
 * SVG chord box diagram: six vertical strings, a window of frets, and a dot
 * for each note labelled with its scale degree.
 */

import { useMemo } from 'react'

import { fretWindow } from './fretWindow'
import { STRING_COUNT, type Fingering } from '../theory/fretboard'
import type { VoicingShape } from '../theory/vsystem'

export type DiagramSize = 'sm' | 'md' | 'lg' | 'seq' | 'present'

interface Props {
  fingering: Fingering
  shape: VoicingShape
  size?: DiagramSize
  /** Draw the scale degree inside each dot. */
  showDegrees?: boolean
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
  className,
}: Props) {
  const s = SIZES[size]

  const { startFret, fretRows, showNut } = useMemo(
    () => fretWindow(fingering),
    [fingering]
  )

  const gridWidth = s.stringGap * (STRING_COUNT - 1)
  const gridHeight = s.fretGap * fretRows
  const width = gridWidth + s.padLabel + s.padSide

  const height = gridHeight + s.padTop + s.padBottom

  const x = (stringIndex: number) => s.padLabel + stringIndex * s.stringGap
  /** Vertical centre of the given fret's cell. */
  const y = (fret: number) =>
    s.padTop + (fret - startFret + 0.5) * s.fretGap

  const toneOf = (voice: number) => shape.voiceTones[voice]
  const degreeOf = (voice: number) => toneOf(voice)?.degree ?? ''
  const styleOf = (voice: number) => intervalStyle(toneOf(voice)?.semitones)

  const playedStrings = new Set(fingering.notes.map((n) => n.string))
  const noteByString = new Map(fingering.notes.map((n) => [n.string, n]))

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
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
      {Array.from({ length: STRING_COUNT }, (_, i) => {
        const fret = fingering.strings[i]
        const markerY = s.padTop - s.markerFont * 0.7
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
          const voice = noteByString.get(i)?.voice ?? 0
          const style = styleOf(voice)
          const r = showDegrees ? s.dot * 0.9 : s.markerFont * 0.42
          return (
            <g key={`open-${i}`}>
              {showDegrees ? (
                <>
                  <circle cx={x(i)} cy={markerY} r={r} className={style.fill} />
                  <text
                    x={x(i)}
                    y={markerY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={s.font * 0.92}
                    fontWeight={700}
                    className={style.text}
                  >
                    {degreeOf(voice)}
                  </text>
                </>
              ) : (
                <circle
                  cx={x(i)}
                  cy={markerY}
                  r={r}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.9}
                  className={style.stroke}
                />
              )}
            </g>
          )
        }
        return null
      })}

      {/* Barre bar behind the dots */}
      {fingering.barreFret !== null &&
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
      {fingering.notes
        .filter((n) => n.fret > 0)
        .map((note) => (
          <g key={`note-${note.string}`}>
            <circle
              cx={x(note.string)}
              cy={y(note.fret)}
              r={s.dot}
              className={styleOf(note.voice).fill}
            />
            {showDegrees && (
              <text
                x={x(note.string)}
                y={y(note.fret)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={s.font}
                fontWeight={700}
                className={styleOf(note.voice).text}
              >
                {degreeOf(note.voice)}
              </text>
            )}
          </g>
        ))}
    </svg>
  )
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
