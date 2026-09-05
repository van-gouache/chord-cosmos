import type { BetweenTarget } from '../theory/betweenTargets'

interface Props {
  targets: BetweenTarget[]
  heading?: string
  compact?: boolean
  onPick?: (target: BetweenTarget) => void
  activePcs?: ReadonlySet<number>
  availablePcs?: ReadonlySet<number>
}

export function TargetNoteChips({
  targets,
  heading = 'New in the next chord',
  compact = false,
  onPick,
  activePcs,
  availablePcs,
}: Props) {
  if (targets.length === 0) return null

  return (
    <div className={compact ? 'mt-1.5 space-y-1' : 'mt-2 space-y-1.5'}>
      <p
        className={`font-semibold tracking-[0.12em] text-cosmos-400 uppercase ${
          compact ? 'text-[10px]' : 'text-[11px]'
        }`}
      >
        {heading}
      </p>
      <div className={`flex flex-wrap gap-1 ${compact ? 'justify-start' : ''}`}>
        {targets.map((target) => {
          const active = activePcs?.has(target.pc) ?? false
          const available =
            availablePcs === undefined || availablePcs.has(target.pc)
          const disabled = Boolean(onPick) && !available
          const className = `rounded-md font-medium ${
            compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
          } ${
            active
              ? 'bg-nebula-600 text-white'
              : disabled
                ? 'cursor-not-allowed bg-cosmos-900 text-cosmos-600'
                : onPick
                  ? 'bg-cosmos-800 text-cosmos-200 transition hover:bg-cosmos-700 hover:text-white'
                  : 'bg-cosmos-800 text-cosmos-200'
          }`
          const label = compact
            ? target.name
            : `${target.name} · ${target.degree}`
          const title = `${target.name} ${target.degree} · ${target.context}`
          if (!onPick) {
            return (
              <span
                key={`${target.pc}-${target.degree}`}
                title={title}
                className={className}
              >
                {label}
              </span>
            )
          }
          return (
            <button
              key={`${target.pc}-${target.degree}`}
              type="button"
              disabled={disabled}
              title={title}
              aria-label={`${active ? 'Remove' : 'Add'} ${target.name} outline, ${target.degree} ${target.context}`}
              onClick={(event) => {
                event.stopPropagation()
                if (!disabled) onPick(target)
              }}
              className={className}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
