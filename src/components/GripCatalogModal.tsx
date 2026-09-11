import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'

import { playArpeggio, playNotes } from '../audio/player'
import { displayChordSymbol, type ParsedChord } from '../theory/chords'
import {
  difficultyLabel,
  positionLabel,
  stringSetLabel,
  tabLabel,
} from '../theory/fretboard'
import {
  flattenGroupGrips,
  inversionOrdinal,
  type GroupResult,
  type Voicing,
} from '../theory/voicings'
import { ChordDiagram } from './ChordDiagram'
import { beginVoicingDrag } from './voicingDrag'

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: 'text-emerald-400',
  moderate: 'text-gold-400',
  hard: 'text-orange-400',
}

const SHORT_INVERSION = ['root', '1st', '2nd', '3rd']

interface Props {
  open: boolean
  chord: ParsedChord
  groups: GroupResult[]
  selectedVoicingId: string | null
  onClose: () => void
  onSelect: (voicing: Voicing) => void
  onAdd: (voicing: Voicing) => void
}

export function GripCatalogModal({
  open,
  chord,
  groups,
  selectedVoicingId,
  onClose,
  onSelect,
  onAdd,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const grips = useMemo(() => flattenGroupGrips(groups), [groups])

  useEffect(() => {
    if (open) listRef.current?.scrollTo(0, 0)
  }, [chord.symbol, open])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLButtonElement>('button[data-close]')
        ?.focus()
    })
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [onClose, open])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-cosmos-950/80 p-2 backdrop-blur-sm sm:p-3"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="grip-catalog-title"
        className="flex h-full w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-nebula-500/40 bg-cosmos-900 shadow-[0_24px_80px_-24px_rgba(79,108,255,0.4)]"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-cosmos-700/70 px-4 py-2.5 sm:px-5">
          <div>
            <h2
              id="grip-catalog-title"
              className="text-base font-semibold tracking-tight text-white sm:text-lg"
            >
              {displayChordSymbol(chord.symbol)} grips
            </h2>
            <p className="text-xs text-cosmos-400">
              {grips.length} V-System grips, easiest to hold first
            </p>
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            className="rounded-lg border border-cosmos-700 px-2.5 py-1 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
          >
            Close
          </button>
        </header>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {grips.length === 0 ? (
            <p className="rounded-xl border border-dashed border-cosmos-700 px-4 py-16 text-center text-sm text-cosmos-400">
              No playable V-System grips for this chord.
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(188px,1fr))] gap-2.5">
              {grips.map((voicing) => {
                const selected = voicing.id === selectedVoicingId
                const level = difficultyLabel(voicing.fingering.difficulty)
                const inversion =
                  SHORT_INVERSION[voicing.inversion] ??
                  inversionOrdinal(voicing.inversion)
                return (
                  <div
                    key={voicing.id}
                    role="button"
                    tabIndex={0}
                    draggable
                    onDragStart={(event) => beginVoicingDrag(event, voicing)}
                    onClick={() => {
                      onSelect(voicing)
                      playNotes(voicing.fingering.midiNotes)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelect(voicing)
                        playNotes(voicing.fingering.midiNotes)
                      }
                    }}
                    title={`${voicing.groupId} · ${inversionOrdinal(voicing.inversion)} — drag onto the sequence`}
                    className={`group flex cursor-grab flex-col items-center gap-1 rounded-xl border p-2.5 transition active:cursor-grabbing ${
                      selected
                        ? 'border-nebula-500 bg-nebula-500/12 shadow-[0_8px_28px_-14px_rgba(79,108,255,0.7)]'
                        : 'border-cosmos-700/70 bg-cosmos-900/50 hover:border-nebula-500/60 hover:bg-cosmos-850'
                    }`}
                  >
                    <div className="flex w-full items-baseline justify-between gap-1 text-[11px] leading-none">
                      <span className="truncate font-semibold text-white">
                        {voicing.groupId}
                        <span className="font-normal text-cosmos-400">
                          {' '}
                          · {inversion} · {positionLabel(voicing.fingering)}
                        </span>
                      </span>
                      <span
                        className={DIFFICULTY_STYLES[level]}
                        title={`${level} to play`}
                      >
                        ●
                      </span>
                    </div>
                    <ChordDiagram
                      fingering={voicing.fingering}
                      shape={voicing.shape}
                      size="seq"
                    />
                    <p className="w-full truncate text-center font-mono text-[11px] leading-none text-cosmos-300">
                      {tabLabel(voicing.fingering)}
                      <span className="font-sans text-cosmos-500">
                        {' '}
                        · {stringSetLabel(voicing.fingering)}
                        {voicing.fingering.barreFret !== null ? ' · barre' : ''}
                      </span>
                    </p>
                    <div className="flex w-full gap-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          playArpeggio(voicing.fingering.midiNotes)
                        }}
                        className="flex-1 rounded-md bg-cosmos-800 py-1 text-[11px] text-cosmos-300 transition hover:bg-cosmos-700 hover:text-white"
                      >
                        ▶ Hear
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onAdd(voicing)
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
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
