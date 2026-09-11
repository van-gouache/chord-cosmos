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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-1.5">
      {groups.map((result) => {
        const { group, preview, unreachable, voicingCount } = result
        const selected = group.id === selectedGroupId
        const shapes = unreachable
          ? 'no shapes'
          : `${voicingCount} shape${voicingCount === 1 ? '' : 's'}`

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
            aria-label={`${group.id}, gaps ${group.gaps.join(' ')}, ${shapes}`}
            title={
              preview
                ? `${group.id}${group.dropName ? ` (${group.dropName})` : ''} · ${shapes} — drag onto the sequence, or click to open inversions. ${group.description}`
                : `${group.id} — gaps ${group.gaps.join('·')}. ${group.description}`
            }
            className={`flex items-baseline gap-1.5 rounded-lg border px-2 py-1.5 text-left transition ${
              selected
                ? 'cursor-grab border-nebula-500 bg-nebula-500/12 active:cursor-grabbing'
                : unreachable
                  ? 'cursor-not-allowed border-cosmos-800 bg-cosmos-900/40 opacity-45'
                  : 'cursor-grab border-cosmos-700/70 bg-cosmos-900/60 hover:border-nebula-500/60 hover:bg-cosmos-850 active:cursor-grabbing'
            }`}
          >
            <span
              className={`text-sm leading-none font-bold ${
                selected ? 'text-nebula-400' : 'text-white'
              }`}
            >
              {group.id}
            </span>
            <span className="font-mono text-[11px] leading-none tabular-nums text-cosmos-300">
              {group.gaps.join('·')}
            </span>
            <span className="ml-auto text-[10px] leading-none tabular-nums text-cosmos-400">
              {unreachable ? '—' : voicingCount}
            </span>
          </button>
        )
      })}
    </div>
  )
}
