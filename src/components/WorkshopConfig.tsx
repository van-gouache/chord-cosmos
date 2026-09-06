import { NOTEBOOK_STYLES, type NotebookStyle } from '../state/notebook'
import { AudioInputSelect } from './AudioInputSelect'

interface Props {
  showForwardTargets: boolean
  onShowForwardTargetsChange: (value: boolean) => void
  showLickOutline: boolean
  onShowLickOutlineChange: (value: boolean) => void
  notebookStyle: NotebookStyle
  onNotebookStyleChange: (style: NotebookStyle) => void
  audioInputId: string
  onAudioInputIdChange: (deviceId: string) => void
}

export function WorkshopConfig({
  showForwardTargets,
  onShowForwardTargetsChange,
  showLickOutline,
  onShowLickOutlineChange,
  notebookStyle,
  onNotebookStyleChange,
  audioInputId,
  onAudioInputIdChange,
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
      <div className="rounded-lg border border-cosmos-700/70 bg-cosmos-900/60 px-3 py-2.5">
        <p className="text-sm font-medium text-cosmos-100">Notebook page</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-cosmos-400">
          Paper style for Notebook view. Switch the view from the sequence
          toolbar.
        </p>
        <div
          className="mt-2 flex flex-wrap gap-1.5"
          role="group"
          aria-label="Notebook page style"
        >
          {NOTEBOOK_STYLES.map((option) => (
            <button
              key={option.id}
              type="button"
              title={option.hint}
              aria-pressed={notebookStyle === option.id}
              onClick={() => onNotebookStyleChange(option.id)}
              className={`h-7 rounded-md border px-2 text-[11px] font-medium transition ${
                notebookStyle === option.id
                  ? 'border-nebula-500 bg-nebula-600 text-white'
                  : 'border-cosmos-700 text-cosmos-300 hover:border-nebula-500 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-cosmos-700/70 bg-cosmos-900/60 px-3 py-2.5">
        <AudioInputSelect
          value={audioInputId}
          onChange={onAudioInputIdChange}
        />
      </div>
    </div>
  )
}
