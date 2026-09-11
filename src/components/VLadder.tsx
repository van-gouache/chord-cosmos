import { useState } from 'react'

import type { ChordTone } from '../theory/chords'
import { buildLadderRungs } from '../theory/ladder'

interface Props {
  groupId: string
  gaps: readonly number[]
  tones: ChordTone[]
  inversion: number
}

export function VLadder({ groupId, gaps, tones, inversion }: Props) {
  const [open, setOpen] = useState(false)
  const rungs = buildLadderRungs(tones, gaps, inversion)
  if (rungs.length === 0) return null

  const cycle = tones.length
  const voices = rungs.filter((rung) => rung.voice)

  return (
    <div className="rounded-xl border border-cosmos-700/60 bg-cosmos-950/50 px-3 py-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        aria-label={
          open ? 'Collapse the chord-tone ladder' : 'Expand the chord-tone ladder'
        }
        title={open ? 'Hide the chord-tone ladder' : 'Show the chord-tone ladder'}
        className="group flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          {/* Same chip the sections and groups use, so it reads as the
              familiar expand control rather than a heading. */}
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-nebula-400/80 bg-nebula-600/30 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white shadow-[0_0_0_1px_rgba(79,108,255,0.25)] transition group-hover:border-nebula-300 group-hover:bg-nebula-500/50">
            <span aria-hidden className="text-xs leading-none">
              {open ? '▾' : '▸'}
            </span>
            {open ? 'Collapse' : 'Expand'}
          </span>
          <span className="text-[10px] font-semibold tracking-[0.12em] text-cosmos-400 uppercase transition group-hover:text-cosmos-200">
            Chord-tone ladder
          </span>
        </span>
        <span className="font-mono text-[11px] text-cosmos-400">
          {groupId}
          <span className="text-cosmos-600"> · </span>
          {gaps.join(' · ')}
        </span>
      </button>

      {open && (
      <div className="relative mt-2 pl-1">
        <div
          aria-hidden
          className="absolute top-2 bottom-2 left-[11px] w-px bg-cosmos-700"
        />
        <ol className="m-0 flex list-none flex-col-reverse gap-0.5 p-0">
          {rungs.map((rung) => {
            const sounding = rung.voice !== null
            const lifted = rung.index >= cycle
            return (
              <li
                key={rung.index}
                className="relative flex items-center gap-2 py-0.5"
              >
                <span
                  aria-hidden
                  className={`relative z-10 box-border h-2.5 w-2.5 shrink-0 rounded-full ${
                    sounding
                      ? 'border-2 border-nebula-400 bg-nebula-500'
                      : 'border border-cosmos-500 bg-cosmos-900'
                  }`}
                />
                <span
                  className={`min-w-[1.4rem] text-sm font-semibold ${
                    sounding ? 'text-white' : 'text-cosmos-500'
                  }`}
                >
                  {rung.tone.name}
                  {lifted && (
                    <span className="text-[10px] font-medium text-cosmos-500">
                      +
                    </span>
                  )}
                </span>
                <span
                  className={`w-6 text-[11px] ${
                    sounding ? 'text-nebula-400' : 'text-cosmos-600'
                  }`}
                >
                  {rung.tone.degree}
                </span>
                <span
                  className={`text-[10px] tracking-wide ${
                    sounding ? 'text-cosmos-300' : 'text-cosmos-600'
                  }`}
                >
                  {rung.voice ?? 'skip'}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
      )}

      {open && (
        <p className="sr-only">
          {groupId} ladder, {voices.length} sounding voices
          {voices
            .map((rung) => `${rung.voice} ${rung.tone.name} ${rung.tone.degree}`)
            .join(', ')}
        </p>
      )}
    </div>
  )
}
