import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'

import { playNotes } from '../audio/player'
import { displayChordSymbol, type ParsedChord } from '../theory/chords'
import type { KeyCenter, ModeId } from '../theory/diatonic'
import {
  polychordFamilies,
  type PolychordStack,
} from '../theory/polychord'

interface Props {
  chord: ParsedChord
  keyRoot?: KeyCenter
  mode?: ModeId
  onClose: () => void
  onSelect: (stack: PolychordStack) => void
  onCustom: () => void
}

export function PolychordModal({
  chord,
  keyRoot,
  mode,
  onClose,
  onSelect,
  onCustom,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const families = useMemo(
    () => polychordFamilies(chord, { keyRoot, mode }),
    [chord, keyRoot, mode]
  )
  const symbol = displayChordSymbol(chord.symbol)

  useEffect(() => {
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
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-cosmos-950/80 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="polychord-title"
        className="flex max-h-[min(860px,92vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-nebula-500/40 bg-cosmos-900 shadow-[0_24px_80px_-24px_rgba(79,108,255,0.4)]"
      >
        <header className="shrink-0 border-b border-cosmos-700/70 px-4 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="polychord-title"
                className="text-base font-semibold tracking-tight text-white sm:text-lg"
              >
                Stack on {symbol}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-cosmos-400">
                Pick a suggestion, or open the workshop and choose any chord.
                Add to sequence puts that grip in this same step.
              </p>
            </div>
            <button
              type="button"
              data-close
              onClick={onClose}
              className="shrink-0 rounded-lg border border-cosmos-700 px-2.5 py-1 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
            >
              Close
            </button>
          </div>
        </header>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-cosmos-700/70 px-4 py-3 sm:px-5">
          <div>
            <h3 className="text-xs font-semibold tracking-[0.14em] text-gold-400 uppercase">
              Custom
            </h3>
            <p className="mt-1 text-[11px] leading-snug text-cosmos-500">
              Choose the chord and grip in the voicing workshop.
            </p>
          </div>
          <button
            type="button"
            onClick={onCustom}
            className="shrink-0 rounded-lg border border-nebula-500 bg-nebula-500/15 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-nebula-500/25"
          >
            Open workshop
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
          {families.length === 0 ? (
            <p className="rounded-xl border border-dashed border-cosmos-700 px-4 py-10 text-center text-sm text-cosmos-400">
              No suggested stacks for {symbol}. Open the workshop to choose one.
            </p>
          ) : (
            families.map((family) => (
              <section key={family.id}>
                <h3 className="text-xs font-semibold tracking-[0.14em] text-nebula-300 uppercase">
                  {family.heading}
                </h3>
                <p className="mt-1 text-[11px] leading-snug text-cosmos-500">
                  {family.hint}
                </p>
                <div className="mt-2 space-y-2">
                  {family.stacks.map((stack) => (
                    <StackRow
                      key={stack.id}
                      stack={stack}
                      lowerSymbol={symbol}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function StackRow({
  stack,
  lowerSymbol,
  onSelect,
}: {
  stack: PolychordStack
  lowerSymbol: string
  onSelect: (stack: PolychordStack) => void
}) {
  const name = displayChordSymbol(stack.symbol)
  return (
    <div className="flex items-stretch gap-2 rounded-xl border border-cosmos-700 bg-cosmos-950/50 p-2 transition hover:border-nebula-500/70">
      <button
        type="button"
        onClick={() => onSelect(stack)}
        className="min-w-0 flex-1 rounded-lg px-1.5 py-1 text-left"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-white">{name}</span>
          <span className="shrink-0 text-[11px] text-cosmos-400">
            {stack.qualityLabel}
          </span>
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-cosmos-300">
          {stack.reason}
        </span>
        <span className="mt-2 flex flex-wrap gap-1">
          {stack.sharedNames.map((note) => (
            <span
              key={`shared-${note}`}
              className="rounded bg-nebula-500/15 px-1.5 py-0.5 text-[10px] font-medium text-nebula-200"
            >
              {note}
            </span>
          ))}
          {stack.addedNames.map((note, index) => (
            <span
              key={`added-${note}-${index}`}
              className="rounded bg-gold-400/10 px-1.5 py-0.5 text-[10px] font-medium text-gold-400"
            >
              + {note}
              {stack.addedDegrees[index] ? ` ${stack.addedDegrees[index]}` : ''}
            </span>
          ))}
        </span>
      </button>
      <button
        type="button"
        onClick={() => playNotes(stack.midiNotes)}
        aria-label={`Hear ${name} stacked on ${lowerSymbol}`}
        title="Hear the stack"
        className="flex w-9 shrink-0 items-center justify-center self-start rounded-lg text-sm text-cosmos-400 transition hover:bg-cosmos-800 hover:text-white"
      >
        ▶
      </button>
    </div>
  )
}
