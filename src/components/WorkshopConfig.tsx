interface Props {
  showForwardTargets: boolean
  onShowForwardTargetsChange: (value: boolean) => void
  showLickOutline: boolean
  onShowLickOutlineChange: (value: boolean) => void
}

export function WorkshopConfig({
  showForwardTargets,
  onShowForwardTargetsChange,
  showLickOutline,
  onShowLickOutlineChange,
}: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-cosmos-700/60 bg-cosmos-950/40 p-3">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
          Sequence helpers
        </p>
        <p className="mt-1 text-[11px] text-cosmos-500">
          These stay on this device and apply to the workshop and every sequence
          step.
        </p>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-cosmos-700/70 bg-cosmos-900/60 px-3 py-2.5">
        <input
          type="checkbox"
          checked={showForwardTargets}
          onChange={(event) => onShowForwardTargetsChange(event.target.checked)}
          className="mt-0.5 accent-nebula-500"
        />
        <span>
          <span className="block text-sm font-medium text-cosmos-100">
            New in next chord
          </span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-cosmos-400">
            Suggest notes the next chord has that the current chord does not.
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-cosmos-700/70 bg-cosmos-900/60 px-3 py-2.5">
        <input
          type="checkbox"
          checked={showLickOutline}
          onChange={(event) => onShowLickOutlineChange(event.target.checked)}
          className="mt-0.5 accent-nebula-500"
        />
        <span>
          <span className="block text-sm font-medium text-cosmos-100">
            Chord tones near the grip
          </span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-cosmos-400">
            A second chart of the chord’s tones near this grip. The main
            sequence diagrams stay unchanged.
          </span>
        </span>
      </label>
    </div>
  )
}
