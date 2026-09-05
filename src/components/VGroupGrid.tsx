import { beginVoicingDrag } from './voicingDrag'
import type { GroupResult } from '../theory/voicings'

interface Props {
  groups: GroupResult[]
  selectedGroupId: string | null
  onSelect: (groupId: string) => void
}

/**
 * The 14 V-System voicing groups. Diagrams live in the inversion picker;
 * these cards only name the group and whether it is reachable.
 */
export function VGroupGrid({ groups, selectedGroupId, onSelect }: Props) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2">
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
                ? `${group.id}${group.dropName ? ` (${group.dropName})` : ''} — drag onto the sequence, or click to open inversions. ${group.description}`
                : `${group.id} — gaps ${group.gaps.join('·')}. ${group.description}`
            }
            className={`flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition ${
              selected
                ? 'cursor-grab border-nebula-500 bg-nebula-500/12 active:cursor-grabbing'
                : unreachable
                  ? 'cursor-not-allowed border-cosmos-800 bg-cosmos-900/40 opacity-45'
                  : 'cursor-grab border-cosmos-700/70 bg-cosmos-900/60 hover:border-nebula-500/60 hover:bg-cosmos-850 active:cursor-grabbing'
            }`}
          >
            <span
              className={`text-sm font-bold ${
                selected ? 'text-nebula-400' : 'text-white'
              }`}
            >
              {group.id}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-cosmos-300">
              {group.gaps.join(' · ')}
            </span>
            <span className="text-[10px] text-cosmos-400">
              {unreachable
                ? '—'
                : `${voicingCount} shape${voicingCount === 1 ? '' : 's'}`}
            </span>
          </button>
        )
      })}
    </div>
  )
}
