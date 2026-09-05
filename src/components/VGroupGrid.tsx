import { ChordDiagram } from './ChordDiagram'
import { beginVoicingDrag } from './voicingDrag'
import { playNotes } from '../audio/player'
import type { GroupResult } from '../theory/voicings'

interface Props {
  groups: GroupResult[]
  selectedGroupId: string | null
  onSelect: (groupId: string) => void
}

/**
 * The 14 V-System voicing groups, each previewed with its easiest fingering
 * for the current chord.
 */
export function VGroupGrid({ groups, selectedGroupId, onSelect }: Props) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
      {groups.map((result) => {
        const { group, preview, unreachable, voicingCount } = result
        const selected = group.id === selectedGroupId

        return (
          <button
            key={group.id}
            type="button"
            disabled={unreachable}
            draggable={Boolean(preview)}
            onDragStart={(event) => {
              if (!preview) {
                event.preventDefault()
                return
              }
              beginVoicingDrag(event, preview)
            }}
            onClick={() => onSelect(group.id)}
            title={
              preview
                ? `${group.id} — drag onto the sequence, or click to open. ${group.description}`
                : `${group.id} — gaps ${group.gaps.join('/')}. ${group.description}`
            }
            className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-left transition ${
              selected
                ? 'cursor-grab border-nebula-500 bg-nebula-500/12 shadow-[0_0_0_1px_rgba(139,92,246,0.35),0_8px_28px_-12px_rgba(139,92,246,0.8)] active:cursor-grabbing'
                : unreachable
                  ? 'cursor-not-allowed border-cosmos-800 bg-cosmos-900/40 opacity-45'
                  : 'cursor-grab border-cosmos-700/70 bg-cosmos-900/60 hover:border-nebula-500/60 hover:bg-cosmos-850 active:cursor-grabbing'
            }`}
          >
            <div className="flex w-full items-baseline justify-between">
              <span
                className={`text-sm font-bold ${
                  selected ? 'text-nebula-400' : 'text-white'
                }`}
              >
                {group.id}
              </span>
              <span className="text-[10px] text-cosmos-400 tabular-nums">
                {group.gaps.join('·')}
              </span>
            </div>

            <span className="flex w-full items-baseline justify-between gap-1 text-[10px]">
              <span className="truncate text-cosmos-400">
                {group.dropName ?? '\u00a0'}
              </span>
              {/* Previews are root position unless the chord can't be played
                  that way, in which case say which bass note you're seeing. */}
              {preview && preview.inversion !== 0 && (
                <span
                  className="shrink-0 text-gold-400"
                  title="Root position isn't playable for this group, so the preview shows another inversion"
                >
                  {preview.shape.voiceTones[0].degree} bass
                </span>
              )}
            </span>

            <div className="flex min-h-[104px] items-center justify-center py-0.5 text-cosmos-300">
              {preview ? (
                <ChordDiagram
                  fingering={preview.fingering}
                  shape={preview.shape}
                  size="sm"
                  showDegrees
                />
              ) : (
                <span className="px-2 text-center text-[11px] leading-tight text-cosmos-400">
                  Not reachable in standard tuning
                </span>
              )}
            </div>

            <div className="flex w-full items-center justify-between">
              <span className="text-[10px] text-cosmos-400">
                {unreachable
                  ? '—'
                  : `${voicingCount} shape${voicingCount === 1 ? '' : 's'}`}
              </span>
              {preview && (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Hear ${group.id}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    playNotes(preview.fingering.midiNotes)
                  }}
                  className="rounded px-1 text-[11px] text-cosmos-400 opacity-0 transition group-hover:opacity-100 hover:text-star-300"
                >
                  ▶
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
