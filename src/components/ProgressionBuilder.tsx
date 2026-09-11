import { KeyCenterSuggestions } from './KeyCenterSuggestions'
import {
  DEFAULT_MODE,
  KEY_CENTERS,
  MODE_OPTIONS,
  progressionFamilies,
  progressionStepHint,
  type KeyCenter,
  type ModeId,
  type ProgressionStep,
} from '../theory/diatonic'

const selectClass =
  'h-7 rounded-md border border-cosmos-700 bg-cosmos-900 px-1.5 text-xs text-cosmos-100 outline-none focus:border-nebula-500'

interface Props {
  keyRoot?: string
  mode?: ModeId
  selectedId?: string | null
  chordSymbols?: string[]
  onHarmonyChange: (harmony: { keyRoot: KeyCenter | null; mode: ModeId }) => void
  onPickStep: (step: ProgressionStep) => void
}

export function ProgressionBuilder({
  keyRoot,
  mode = DEFAULT_MODE,
  selectedId,
  chordSymbols = [],
  onHarmonyChange,
  onPickStep,
}: Props) {
  const key = KEY_CENTERS.includes(keyRoot as KeyCenter)
    ? (keyRoot as KeyCenter)
    : null
  const families = key ? progressionFamilies(key, mode) : []

  return (
    <div
      className="mb-2 space-y-1.5 rounded-lg border border-cosmos-800/80 bg-cosmos-950/50 p-1.5"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-cosmos-500 uppercase">
          Progression
        </p>
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-cosmos-500">Key</span>
          <select
            value={key ?? ''}
            aria-label="Key center"
            onChange={(event) => {
              const next = event.target.value
              if (!next) {
                onHarmonyChange({ keyRoot: null, mode })
                return
              }
              if (!KEY_CENTERS.includes(next as KeyCenter)) return
              onHarmonyChange({ keyRoot: next as KeyCenter, mode })
            }}
            className={selectClass}
          >
            <option value="">None</option>
            {KEY_CENTERS.map((root) => (
              <option key={root} value={root}>
                {root}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-cosmos-500">Scale</span>
          <select
            value={mode}
            disabled={!key}
            aria-label="Scale"
            onChange={(event) => {
              if (!key) return
              onHarmonyChange({
                keyRoot: key,
                mode: event.target.value as ModeId,
              })
            }}
            className={selectClass}
          >
            <optgroup label="Modes">
              {MODE_OPTIONS.filter((option) => option.family === 'mode').map(
                (option) => (
                  <option key={option.id} value={option.id} title={option.hint}>
                    {option.label}
                  </option>
                )
              )}
            </optgroup>
            <optgroup label="Other 7-note">
              {MODE_OPTIONS.filter((option) => option.family === 'scale').map(
                (option) => (
                  <option key={option.id} value={option.id} title={option.hint}>
                    {option.label}
                  </option>
                )
              )}
            </optgroup>
          </select>
        </label>
      </div>
      {key ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {families.map((family) => (
            <div key={family.id} className="min-w-0">
              <p
                className="mb-0.5 truncate text-[10px] text-cosmos-500"
                title={family.hint}
              >
                {family.heading}
              </p>
              <div className="flex flex-wrap gap-0.5">
                {family.steps.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    title={progressionStepHint(step)}
                    onClick={() => onPickStep(step)}
                    className={`rounded-md border px-1.5 py-0.5 text-xs font-semibold tracking-wide transition ${
                      selectedId === step.id
                        ? 'border-nebula-400 bg-nebula-600/40 text-white'
                        : 'border-cosmos-700 text-cosmos-200 hover:border-nebula-500 hover:text-white'
                    }`}
                  >
                    {step.roman}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          <KeyCenterSuggestions
            chordSymbols={chordSymbols}
            onPick={onHarmonyChange}
          />
          <p className="text-[11px] text-cosmos-500">
            Choose a key center to see diatonic and non-diatonic steps, or
            leave it as None.
          </p>
        </div>
      )}
    </div>
  )
}
