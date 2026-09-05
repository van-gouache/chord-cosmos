import { useMemo, useState } from 'react'

import { playArpeggio, playNotes } from '../audio/player'
import { ChordDiagram } from './ChordDiagram'
import { beginVoicingDrag } from './voicingDrag'
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
import type { Voicing } from '../theory/voicings'

const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e']
const INLAYS = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24])
const FRETS_PER_PAGE = 12

interface Props {
  onAdd: (voicing: Voicing) => void
}

export function FretboardBuilder({ onAdd }: Props) {
  const [strings, setStrings] = useState<(number | null)[]>(emptyCustomStrings)
  const [rootName, setRootName] = useState('C')
  const [rootTouched, setRootTouched] = useState(false)
  const [page, setPage] = useState(0)

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
    const current = strings[string]
    const next = current === fret ? null : fret
    setString(string, next)
    if (next !== null) {
      const openMidi = [40, 45, 50, 55, 59, 64][string]
      playNotes([openMidi + next])
    }
  }

  const clear = () => {
    setStrings(emptyCustomStrings())
    setRootTouched(false)
  }

  const noteCount = strings.filter((fret) => fret !== null).length

  return (
    <div className="space-y-3">
      <div>
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
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
          Fretboard
        </p>
        <div className="flex items-center gap-1">
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
        <div
          className="grid gap-px"
          style={{
            gridTemplateColumns: `28px 28px repeat(${fretNumbers.length}, minmax(26px, 1fr))`,
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
            const chosen = strings[string]
            return (
              <FretRow
                key={string}
                string={string}
                label={STRING_LABELS[string]}
                chosen={chosen}
                fretNumbers={fretNumbers}
                onToggle={toggleFret}
              />
            )
          })}
        </div>
      </div>

      <p className="text-[11px] text-cosmos-400">
        Click a fret to place a note, click it again to mute the string. Open
        strings are the 0 column.
      </p>

      {voicing && fingering ? (
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
    </div>
  )
}

function FretRow({
  string,
  label,
  chosen,
  fretNumbers,
  onToggle,
}: {
  string: number
  label: string
  chosen: number | null
  fretNumbers: number[]
  onToggle: (string: number, fret: number) => void
}) {
  return (
    <>
      <p className="self-center pr-1 text-right text-[11px] font-semibold text-cosmos-400">
        {label}
      </p>
      <FretCell
        active={chosen === 0}
        inlay={false}
        open
        label="open"
        onClick={() => onToggle(string, 0)}
      />
      {fretNumbers.map((fret) => (
        <FretCell
          key={`${string}-${fret}`}
          active={chosen === fret}
          inlay={INLAYS.has(fret)}
          open={false}
          label={`fret ${fret}`}
          onClick={() => onToggle(string, fret)}
        />
      ))}
    </>
  )
}

function FretCell({
  active,
  inlay,
  open,
  label,
  onClick,
}: {
  active: boolean
  inlay: boolean
  open: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`relative flex h-8 items-center justify-center rounded-sm transition ${
        active
          ? 'bg-nebula-600 text-white'
          : open
            ? 'bg-cosmos-900 text-cosmos-500 hover:bg-cosmos-800 hover:text-white'
            : inlay
              ? 'bg-cosmos-800/80 text-cosmos-600 hover:bg-cosmos-700 hover:text-white'
              : 'bg-cosmos-850 text-cosmos-700 hover:bg-cosmos-800 hover:text-white'
      }`}
    >
      {active ? (
        <span className="block h-3.5 w-3.5 rounded-full bg-current" />
      ) : open ? (
        <span className="text-[10px] font-semibold">o</span>
      ) : inlay ? (
        <span className="block h-1.5 w-1.5 rounded-full bg-cosmos-600" />
      ) : null}
    </button>
  )
}
