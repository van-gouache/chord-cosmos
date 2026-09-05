import {
  canShiftFingering,
  listOctaveShifts,
  OCTAVE_FRETS,
  type Fingering,
} from '../theory/fretboard'

interface Props {
  fingering: Fingering
  onShift: (deltaFrets: number) => void
  size?: 'sm' | 'md'
}

/** Octave up/down for a movable shape. Hidden when neither direction fits. */
export function OctaveShiftButtons({
  fingering,
  onShift,
  size = 'md',
}: Props) {
  const canDown = canShiftFingering(fingering, -OCTAVE_FRETS)
  const canUp = canShiftFingering(fingering, OCTAVE_FRETS)
  if (!canDown && !canUp) return null

  const compact = size === 'sm'
  return (
    <div className={`flex items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {!compact && (
        <span className="mr-1 text-[10px] font-semibold tracking-[0.12em] text-cosmos-400 uppercase">
          Octave
        </span>
      )}
      <button
        type="button"
        disabled={!canDown}
        title="Move the shape down an octave"
        aria-label="Octave down"
        onClick={(event) => {
          event.stopPropagation()
          if (canDown) onShift(-OCTAVE_FRETS)
        }}
        className={buttonClass(compact, canDown)}
      >
        {compact ? '8vb' : '↓ Octave'}
      </button>
      <button
        type="button"
        disabled={!canUp}
        title="Move the shape up an octave"
        aria-label="Octave up"
        onClick={(event) => {
          event.stopPropagation()
          if (canUp) onShift(OCTAVE_FRETS)
        }}
        className={buttonClass(compact, canUp)}
      >
        {compact ? '8va' : '↑ Octave'}
      </button>
    </div>
  )
}

function buttonClass(compact: boolean, enabled: boolean): string {
  if (compact) {
    return `rounded px-1 py-0.5 text-[10px] font-semibold transition ${
      enabled
        ? 'text-cosmos-300 hover:bg-cosmos-700 hover:text-white'
        : 'cursor-not-allowed text-cosmos-600'
    }`
  }
  return `rounded-lg border px-3 py-2 text-sm transition ${
    enabled
      ? 'border-cosmos-600 text-cosmos-300 hover:border-nebula-500 hover:text-white'
      : 'cursor-not-allowed border-cosmos-800 text-cosmos-600'
  }`
}

/** Compact octave picker for a sequence slot — choose Low or High, not bump. */
export function OctaveSelect({
  fingering,
  chordSymbol,
  onShift,
  className,
}: {
  fingering: Fingering
  chordSymbol: string
  onShift: (deltaFrets: number) => void
  className?: string
}) {
  const choices = listOctaveShifts(fingering)
  if (choices.length < 2) return null

  return (
    <select
      value="0"
      aria-label={`Octave for ${chordSymbol}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onChange={(event) => {
        const delta = Number(event.target.value)
        if (delta !== 0) onShift(delta)
      }}
      className={className}
    >
      {choices.map((choice) => (
        <option key={choice.deltaFrets} value={choice.deltaFrets}>
          {choice.label}
        </option>
      ))}
    </select>
  )
}
