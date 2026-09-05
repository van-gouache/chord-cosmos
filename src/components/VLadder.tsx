import type { ChordTone } from '../theory/chords'
import { buildLadderRungs } from '../theory/ladder'

interface Props {
  groupId: string
  gaps: readonly number[]
  tones: ChordTone[]
  inversion: number
}

export function VLadder({ groupId, gaps, tones, inversion }: Props) {
  const rungs = buildLadderRungs(tones, gaps, inversion)
  if (rungs.length === 0) return null

  const cycle = tones.length
  const voices = rungs.filter((rung) => rung.voice)

  return (
    <div className="rounded-xl border border-cosmos-700/60 bg-cosmos-950/50 px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-cosmos-400 uppercase">
          Chord-tone ladder
        </p>
        <p className="font-mono text-[11px] text-cosmos-400">
          {groupId}
          <span className="text-cosmos-600"> · </span>
          {gaps.join(' · ')}
        </p>
      </div>

      <div className="relative pl-1">
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

      <p className="sr-only">
        {groupId} ladder, {voices.length} sounding voices
        {voices
          .map((rung) => `${rung.voice} ${rung.tone.name} ${rung.tone.degree}`)
          .join(', ')}
      </p>
    </div>
  )
}
