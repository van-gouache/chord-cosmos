import { useEffect, useMemo, useState } from 'react'

import { playArpeggio } from '../audio/player'
import {
  arpeggioTones,
  chordTonePositions,
  threeNpsPattern,
  threeNpsStarts,
  verticalPattern,
  verticalStarts,
  verticalWindow,
  type ArpeggioNote,
} from '../theory/arpeggio'
import type { ChordTone, ParsedChord } from '../theory/chords'
import { MAX_PLAYABLE_FRET, STRING_COUNT } from '../theory/fretboard'

const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e']
const INLAYS = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24])
const ALL_FRETS = Array.from({ length: MAX_PLAYABLE_FRET + 1 }, (_, fret) => fret)

type PatternMode = '3nps' | 'vertical'

interface Props {
  chord: ParsedChord
}

export function ArpeggioChart({ chord }: Props) {
  const tones = useMemo(() => arpeggioTones(chord), [chord])
  const [mode, setMode] = useState<PatternMode>('3nps')
  const [startToneIndex, setStartToneIndex] = useState(0)
  const [startFret, setStartFret] = useState(0)

  const starts = useMemo(
    () =>
      mode === 'vertical'
        ? verticalStarts(chord, startToneIndex, 0)
        : threeNpsStarts(chord, startToneIndex, 0),
    [chord, startToneIndex, mode]
  )

  useEffect(() => {
    const first = starts[0]?.fret ?? 0
    setStartFret((current) =>
      starts.some((start) => start.fret === current) ? current : first
    )
  }, [starts])

  const pattern = useMemo(
    () =>
      mode === 'vertical'
        ? verticalPattern(chord, { startFret })
        : threeNpsPattern(chord, { startToneIndex, minFret: startFret }),
    [chord, mode, startToneIndex, startFret]
  )

  const visibleFrets = useMemo(() => {
    if (mode === '3nps') return ALL_FRETS
    const { from, to } = verticalWindow(startFret)
    return ALL_FRETS.filter((fret) => fret >= from && fret <= to)
  }, [mode, startFret])

  const patternByCell = useMemo(() => {
    const map = new Map<string, ArpeggioNote>()
    for (const note of pattern) map.set(cellKey(note.string, note.fret), note)
    return map
  }, [pattern])

  const toneByCell = useMemo(() => {
    const map = new Map<string, ChordTone>()
    if (mode === 'vertical') return map
    for (const note of chordTonePositions(chord)) {
      map.set(cellKey(note.string, note.fret), note.tone)
    }
    return map
  }, [chord, mode])

  const pickStart = (toneIndex: number, fret: number) => {
    setStartToneIndex(toneIndex)
    setStartFret(fret)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
            {mode === 'vertical' ? 'Vertical · 6 frets' : '3 notes per string'}
          </p>
          <p className="mt-0.5 text-[11px] text-cosmos-400">
            {chord.symbol} · {tones.map((tone) => tone.degree).join('  ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-cosmos-950/80 p-0.5">
            <button
              type="button"
              aria-pressed={mode === '3nps'}
              onClick={() => setMode('3nps')}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase transition ${
                mode === '3nps'
                  ? 'bg-nebula-600 text-white'
                  : 'text-cosmos-400 hover:text-white'
              }`}
            >
              3NPS
            </button>
            <button
              type="button"
              aria-pressed={mode === 'vertical'}
              onClick={() => setMode('vertical')}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase transition ${
                mode === 'vertical'
                  ? 'bg-nebula-600 text-white'
                  : 'text-cosmos-400 hover:text-white'
              }`}
            >
              Vertical
            </button>
          </div>
          <button
            type="button"
            disabled={pattern.length < 2}
            onClick={() => playArpeggio(pattern.map((note) => note.midi), 0.13)}
            className="rounded-lg border border-cosmos-600 px-3 py-1.5 text-sm text-cosmos-300 transition hover:border-star-400 hover:text-star-300 disabled:opacity-40"
          >
            ▶ Hear
          </button>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold tracking-[0.12em] text-cosmos-500 uppercase">
          Start from
        </p>
        <div className="flex flex-wrap gap-1">
          {tones.map((tone, index) => (
            <button
              key={`${tone.degree}-${index}`}
              type="button"
              onClick={() => {
                const next =
                  mode === 'vertical'
                    ? verticalStarts(chord, index, 0)
                    : threeNpsStarts(chord, index, 0)
                pickStart(index, next[0]?.fret ?? 0)
              }}
              className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                startToneIndex === index
                  ? 'bg-nebula-600 text-white'
                  : 'bg-cosmos-800 text-cosmos-300 hover:bg-cosmos-700 hover:text-white'
              }`}
            >
              {tone.degree}
            </button>
          ))}
        </div>
      </div>

      {starts.length > 1 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold tracking-[0.12em] text-cosmos-500 uppercase">
            Position
          </p>
          <div className="flex flex-wrap gap-1">
            {starts.map((start) => (
              <button
                key={start.fret}
                type="button"
                onClick={() => setStartFret(start.fret)}
                className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                  startFret === start.fret
                    ? 'bg-nebula-600 text-white'
                    : 'bg-cosmos-800 text-cosmos-300 hover:bg-cosmos-700 hover:text-white'
                }`}
              >
                {start.fret === 0 ? 'Open' : `${start.fret}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <NeckBoard
        frets={visibleFrets}
        patternByCell={patternByCell}
        toneByCell={toneByCell}
        tones={tones}
        onPick={pickStart}
      />

      <p className="text-[11px] text-cosmos-400">
        {mode === 'vertical'
          ? 'Every chord tone inside this 6-fret box. Click a low-E note to slide the box.'
          : 'Filled dots are the 3NPS path. Dim dots are other chord tones — click one on the low E to start from there.'}
      </p>
    </div>
  )
}

function NeckBoard({
  frets,
  patternByCell,
  toneByCell,
  tones,
  onPick,
}: BoardProps & { frets: number[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-cosmos-700/60 bg-cosmos-950/50 p-2">
      <div
        className="grid gap-px"
        style={{
          gridTemplateColumns: `22px repeat(${frets.length}, minmax(28px, 1fr))`,
        }}
      >
        <div />
        {frets.map((fret) => (
          <FretNumber key={`num-${fret}`} fret={fret} />
        ))}
        {Array.from({ length: STRING_COUNT }, (_, row) => {
          const string = STRING_COUNT - 1 - row
          return (
            <StringCells
              key={string}
              string={string}
              frets={frets}
              patternByCell={patternByCell}
              toneByCell={toneByCell}
              tones={tones}
              onPick={onPick}
            />
          )
        })}
      </div>
    </div>
  )
}

function StringCells({
  string,
  frets,
  patternByCell,
  toneByCell,
  tones,
  onPick,
}: BoardProps & { string: number; frets: number[] }) {
  return (
    <>
      <p className="self-center pr-1 text-right text-[11px] font-semibold text-cosmos-400">
        {STRING_LABELS[string]}
      </p>
      {frets.map((fret) => (
        <FretCell
          key={cellKey(string, fret)}
          string={string}
          fret={fret}
          patternByCell={patternByCell}
          toneByCell={toneByCell}
          tones={tones}
          onPick={onPick}
        />
      ))}
    </>
  )
}

function FretNumber({ fret }: { fret: number }) {
  return (
    <p
      className={`pb-1 text-center text-[9px] font-semibold ${
        INLAYS.has(fret) ? 'text-cosmos-300' : 'text-cosmos-500'
      }`}
    >
      {fret}
    </p>
  )
}

function FretCell({
  string,
  fret,
  patternByCell,
  toneByCell,
  tones,
  onPick,
}: BoardProps & { string: number; fret: number }) {
  const key = cellKey(string, fret)
  const active = patternByCell.get(key)
  const tone = active?.tone ?? toneByCell.get(key)
  const style = intervalStyle(tone?.semitones)
  const canStart = string === 0 && Boolean(tone)
  const toneIndex = tone
    ? tones.findIndex((item) => item.semitones === tone.semitones)
    : -1
  return (
    <button
      type="button"
      disabled={!canStart}
      aria-label={
        tone
          ? `${active ? '' : 'Other '}${tone.degree} on string ${string + 1}, fret ${fret}`
          : `Empty fret ${fret}`
      }
      onClick={() => {
        if (toneIndex >= 0) onPick(toneIndex, fret)
      }}
      className={`relative flex h-8 items-center justify-center rounded-sm ${
        INLAYS.has(fret) ? 'bg-cosmos-800/70' : 'bg-cosmos-850'
      } ${canStart ? 'cursor-pointer hover:bg-cosmos-700' : 'cursor-default'}`}
    >
      {active ? (
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold ${style.dot} ${style.text}`}
        >
          {active.tone.degree}
        </span>
      ) : tone ? (
        <span className={`block h-2 w-2 rounded-full ${style.dot} opacity-35`} />
      ) : INLAYS.has(fret) ? (
        <span className="block h-1 w-1 rounded-full bg-cosmos-600" />
      ) : null}
    </button>
  )
}

type BoardProps = {
  patternByCell: Map<string, ArpeggioNote>
  toneByCell: Map<string, ChordTone>
  tones: ChordTone[]
  onPick: (toneIndex: number, fret: number) => void
}

function cellKey(string: number, fret: number): string {
  return `${string}:${fret}`
}

const INTERVAL_DOT: Record<number, { dot: string; text: string }> = {
  0: { dot: 'bg-gold-400', text: 'text-cosmos-950' },
  1: { dot: 'bg-rose-400', text: 'text-cosmos-950' },
  2: { dot: 'bg-orange-400', text: 'text-cosmos-950' },
  3: { dot: 'bg-amber-300', text: 'text-cosmos-950' },
  4: { dot: 'bg-yellow-200', text: 'text-cosmos-950' },
  5: { dot: 'bg-lime-400', text: 'text-cosmos-950' },
  6: { dot: 'bg-emerald-400', text: 'text-cosmos-950' },
  7: { dot: 'bg-teal-400', text: 'text-cosmos-950' },
  8: { dot: 'bg-cyan-400', text: 'text-cosmos-950' },
  9: { dot: 'bg-sky-400', text: 'text-cosmos-950' },
  10: { dot: 'bg-nebula-400', text: 'text-white' },
  11: { dot: 'bg-fuchsia-400', text: 'text-white' },
}

function intervalStyle(semitones: number | undefined) {
  const pc = ((semitones ?? 0) % 12 + 12) % 12
  return INTERVAL_DOT[pc] ?? INTERVAL_DOT[0]
}
