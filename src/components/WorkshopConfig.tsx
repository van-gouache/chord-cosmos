import { playArpeggio } from '../audio/player'
import { NOTEBOOK_STYLES, type NotebookStyle } from '../state/notebook'

/** An open G chord, for hearing the level you just set. */
const TEST_CHORD = [43, 47, 50, 55, 59, 67]

interface Props {
  showForwardTargets: boolean
  onShowForwardTargetsChange: (value: boolean) => void
  showLickOutline: boolean
  onShowLickOutlineChange: (value: boolean) => void
  showCircleOfFifths: boolean
  onShowCircleOfFifthsChange: (value: boolean) => void
  notebookStyle: NotebookStyle
  onNotebookStyleChange: (style: NotebookStyle) => void
  volume: number
  onVolumeChange: (value: number) => void
}

export function WorkshopConfig({
  showForwardTargets,
  onShowForwardTargetsChange,
  showLickOutline,
  onShowLickOutlineChange,
  showCircleOfFifths,
  onShowCircleOfFifthsChange,
  notebookStyle,
  onNotebookStyleChange,
  volume,
  onVolumeChange,
}: Props) {
  const percent = Math.round(volume * 100)
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
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-cosmos-700/70 bg-cosmos-900/60 px-3 py-2.5">
        <input
          type="checkbox"
          checked={showCircleOfFifths}
          onChange={(event) => onShowCircleOfFifthsChange(event.target.checked)}
          className="mt-0.5 accent-nebula-500"
        />
        <span>
          <span className="block text-sm font-medium text-cosmos-100">
            Circle of fifths
          </span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-cosmos-400">
            Place the current chord on the usual circle, with C at the top.
            The group key and chord are marked in place; clockwise is
            sharper.
          </span>
        </span>
      </label>
      <div className="rounded-lg border border-cosmos-700/70 bg-cosmos-900/60 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <label
            htmlFor="playback-volume"
            className="text-sm font-medium text-cosmos-100"
          >
            Playback volume
          </label>
          <span className="text-[11px] font-semibold text-cosmos-300">
            {percent}%
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-cosmos-400">
          Level for every chord, line, and sequence played in the app.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <input
            id="playback-volume"
            type="range"
            min={0}
            max={100}
            step={1}
            value={percent}
            onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
            className="h-7 min-w-0 flex-1 accent-nebula-500"
          />
          <button
            type="button"
            onClick={() => playArpeggio(TEST_CHORD)}
            className="h-7 shrink-0 rounded-md border border-cosmos-700 px-2 text-[11px] font-medium text-cosmos-300 transition hover:border-star-400 hover:text-star-300"
          >
            ▶ Test
          </button>
        </div>
      </div>
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
    </div>
  )
}
