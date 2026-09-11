import {
  suggestionChipLabel,
  suggestionHint,
  suggestKeyCenters,
} from '../theory/keySuggestions'
import type { KeyCenter, ModeId } from '../theory/diatonic'

interface Props {
  chordSymbols: string[]
  onPick: (harmony: { keyRoot: KeyCenter; mode: ModeId }) => void
}

export function KeyCenterSuggestions({ chordSymbols, onPick }: Props) {
  const suggestions = suggestKeyCenters(chordSymbols)
  if (suggestions.length === 0) return null

  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold tracking-[0.12em] text-cosmos-500 uppercase">
        Typical keys
      </p>
      <div className="flex flex-wrap gap-0.5">
        {suggestions.map((suggestion) => (
          <button
            key={`${suggestion.keyRoot}:${suggestion.mode}`}
            type="button"
            title={suggestionHint(suggestion)}
            onClick={() =>
              onPick({ keyRoot: suggestion.keyRoot, mode: suggestion.mode })
            }
            className="rounded-md border border-cosmos-700 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-cosmos-200 transition hover:border-nebula-500 hover:text-white"
          >
            {suggestionChipLabel(suggestion)}
          </button>
        ))}
      </div>
    </div>
  )
}
