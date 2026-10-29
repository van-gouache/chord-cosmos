import { useId, useState, type PointerEvent } from 'react'

import { KeyCenterSuggestions } from './KeyCenterSuggestions'
import {
  DEFAULT_MODE,
  KEY_CENTERS,
  MODE_OPTIONS,
  progressionFamilies,
  progressionStepHint,
  type KeyCenter,
  type ModeId,
  type ProgressionFamily,
  type ProgressionStep,
} from '../theory/diatonic'
import {
  MAX_GENERATED_CHORDS,
  MIN_GENERATED_CHORDS,
  SPICINESS_HINTS,
  SPICINESS_LABELS,
  clampGeneratedCount,
  type GenerateProgressionChoice,
} from '../theory/generateProgression'
import {
  EXOTICISM_MAX,
  clampExoticism,
  exoticismLabel,
} from '../theory/progressionGrips'

const selectClass =
  'h-7 rounded-md border border-cosmos-700 bg-cosmos-900 px-1.5 text-xs text-cosmos-100 outline-none focus:border-nebula-500'

interface Props {
  keyRoot?: string
  mode?: ModeId
  selectedId?: string | null
  chordSymbols?: string[]
  matrixCollapsed?: boolean
  onToggleMatrix?: () => void
  chordCount?: number
  filledCount?: number
  onHarmonyChange: (harmony: { keyRoot: KeyCenter | null; mode: ModeId }) => void
  onPickStep: (step: ProgressionStep) => void
  onGenerate?: (choice: GenerateProgressionChoice) => void
}

export function ProgressionBuilder({
  keyRoot,
  mode = DEFAULT_MODE,
  selectedId,
  chordSymbols = [],
  matrixCollapsed = false,
  onToggleMatrix,
  chordCount = 4,
  filledCount = 0,
  onHarmonyChange,
  onPickStep,
  onGenerate,
}: Props) {
  const key = KEY_CENTERS.includes(keyRoot as KeyCenter)
    ? (keyRoot as KeyCenter)
    : null
  const families = key ? progressionFamilies(key, mode) : []
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [generateCount, setGenerateCount] = useState(4)
  const [generateKey, setGenerateKey] = useState<KeyCenter>(key ?? 'C')
  const [generateSpice, setGenerateSpice] = useState(2)
  const [generateExoticism, setGenerateExoticism] = useState(1)
  const toggleGenerator = () => {
    setGenerateCount(filledCount > 0 ? clampGeneratedCount(chordCount) : 4)
    setGenerateKey(key ?? 'C')
    setGeneratorOpen((open) => !open)
  }
  const selectedStep = selectedId
    ? families.flatMap((family) => family.steps).find((step) => step.id === selectedId)
    : undefined

  return (
    <div
      className="mb-2 space-y-1.5 rounded-lg border border-cosmos-800/80 bg-cosmos-950/50 p-1.5"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={!matrixCollapsed}
          aria-label={
            matrixCollapsed ? 'Expand chord matrix' : 'Collapse chord matrix'
          }
          title={matrixCollapsed ? 'Show chord matrix' : 'Hide chord matrix'}
          onClick={onToggleMatrix}
          className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.12em] text-cosmos-500 uppercase transition hover:text-white"
        >
          <span aria-hidden className="text-[11px] leading-none">
            {matrixCollapsed ? '▸' : '▾'}
          </span>
          Progression
        </button>
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
        {matrixCollapsed && selectedStep ? (
          <span className="text-[11px] font-semibold tracking-wide text-cosmos-200">
            {selectedStep.roman}
            <span className="ml-1 font-medium text-nebula-300">
              {selectedStep.symbol}
            </span>
          </span>
        ) : null}
        {onGenerate ? (
          <button
            type="button"
            aria-expanded={generatorOpen}
            title="Generate a progression for this group"
            onClick={toggleGenerator}
            className={`ml-auto rounded-md border px-2 py-0.5 text-[11px] font-semibold transition ${
              generatorOpen
                ? 'border-nebula-300 bg-nebula-500/50 text-white'
                : 'border-nebula-400/80 bg-nebula-600/30 text-white hover:bg-nebula-500/50'
            }`}
          >
            Generate
          </button>
        ) : null}
      </div>
      {onGenerate && generatorOpen ? (
        <GenerateProgressionForm
          count={generateCount}
          spice={generateSpice}
          exoticism={generateExoticism}
          keyRoot={generateKey}
          scaleLabel={
            MODE_OPTIONS.find((option) => option.id === mode)?.label ?? 'Ionian'
          }
          filledCount={filledCount}
          onCountChange={setGenerateCount}
          onKeyChange={setGenerateKey}
          onSpiceChange={setGenerateSpice}
          onExoticismChange={setGenerateExoticism}
          onGenerate={() =>
            onGenerate({
              count: generateCount,
              keyRoot: generateKey,
              mode,
              spiciness: generateSpice,
              exoticism: generateExoticism,
            })
          }
        />
      ) : null}
      {!matrixCollapsed && key ? (
        <ChordMatrix
          families={families}
          selectedId={selectedId}
          onPickStep={onPickStep}
        />
      ) : null}
      {!matrixCollapsed && !key && (
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

const DEGREES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const

/** Short row names. The column header is the scale degree they apply to. */
const ROW_LABEL: Record<string, string> = {
  diatonic: 'Diatonic',
  sixths: 'Sixths',
  'secondary-dominant': 'V7 of',
  'secondary-ii': 'II-7 of',
  'secondary-half-dim': 'IIø7 of',
  tritone: 'subV7',
  chromatic: 'Chromatic',
  borrowed: 'Borrowed',
  'passing-dim': 'Passing',
}

function ChordMatrix({
  families,
  selectedId,
  onPickStep,
}: {
  families: ProgressionFamily[]
  selectedId?: string | null
  onPickStep: (step: ProgressionStep) => void
}) {
  return (
    <div className="overflow-x-auto">
      <div
        role="grid"
        aria-label="Next chord by scale degree"
        className="grid gap-px rounded-md bg-cosmos-800/70 p-px"
        style={{
          gridTemplateColumns: '4.25rem repeat(7, minmax(3.15rem, 1fr))',
        }}
      >
        <div className="sticky left-0 z-10 bg-cosmos-950" />
        {DEGREES.map((degree) => (
          <div
            key={degree}
            role="columnheader"
            className="bg-cosmos-950 py-1 text-center text-[11px] font-semibold tracking-[0.14em] text-cosmos-500"
          >
            {degree}
          </div>
        ))}
        {families.flatMap((family) => {
          const columns = stepsByColumn(family.steps)
          return [
            <div
              key={`${family.id}-label`}
              role="rowheader"
              title={`${family.heading}. ${family.hint}`}
              className="sticky left-0 z-10 flex items-center justify-end bg-cosmos-950 px-1.5 text-right text-[11px] leading-tight font-medium text-cosmos-400"
            >
              {ROW_LABEL[family.id] ?? family.heading}
            </div>,
            ...columns.map((steps, index) => (
              <div
                key={`${family.id}-${DEGREES[index]}`}
                role="gridcell"
                className="flex min-h-7 flex-col justify-center gap-px bg-cosmos-950 p-px"
              >
                {steps.map((step) => {
                  const selected = selectedId === step.id
                  return (
                    <button
                      key={step.id}
                      type="button"
                      title={`${step.roman} · ${progressionStepHint(step)}`}
                      aria-pressed={selected}
                      onClick={() => onPickStep(step)}
                      className={`min-w-0 rounded-[4px] px-0 py-0.5 text-center leading-none transition ${
                        selected
                          ? 'bg-nebula-600 text-white'
                          : 'text-cosmos-100 hover:bg-cosmos-800'
                      }`}
                    >
                      <span className="block whitespace-nowrap text-xs font-semibold tracking-tight">
                        {step.roman}
                      </span>
                      <span
                        className={`mt-0.5 block whitespace-nowrap text-[10px] font-medium ${
                          selected ? 'text-white/80' : 'text-nebula-300'
                        }`}
                      >
                        {step.symbol}
                      </span>
                    </button>
                  )
                })}
              </div>
            )),
          ]
        })}
      </div>
    </div>
  )
}

/** The group card is draggable, and a slider drag would move the card instead. */
function suspendGroupDrag(event: PointerEvent<HTMLElement>) {
  const group = event.currentTarget.closest('[data-group-card]')
  if (!(group instanceof HTMLElement) || group.dataset.dragLocked === '1') return
  group.dataset.dragLocked = '1'
  group.dataset.wasDraggable = group.draggable ? '1' : '0'
  group.draggable = false
  const release = () => {
    group.draggable = group.dataset.wasDraggable !== '0'
    delete group.dataset.dragLocked
    delete group.dataset.wasDraggable
    window.removeEventListener('pointerup', release)
    window.removeEventListener('pointercancel', release)
  }
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)
}

const stepButtonClass =
  'flex h-6 w-6 items-center justify-center rounded-md border border-cosmos-700 text-xs text-cosmos-300 transition hover:border-nebula-500 hover:text-white disabled:opacity-30'

function GenerateProgressionForm({
  count,
  spice,
  exoticism,
  keyRoot,
  scaleLabel,
  filledCount,
  onCountChange,
  onKeyChange,
  onSpiceChange,
  onExoticismChange,
  onGenerate,
}: {
  count: number
  spice: number
  exoticism: number
  keyRoot: KeyCenter
  scaleLabel: string
  filledCount: number
  onCountChange: (count: number) => void
  onKeyChange: (keyRoot: KeyCenter) => void
  onSpiceChange: (spice: number) => void
  onExoticismChange: (exoticism: number) => void
  onGenerate: () => void
}) {
  const radioName = useId()
  return (
    <div
      data-no-drag
      className="space-y-1.5 rounded-md border border-cosmos-800 bg-cosmos-950/80 p-1.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold tracking-[0.12em] text-cosmos-500 uppercase">
            Chords
          </span>
          <button
            type="button"
            aria-label="Fewer chords"
            disabled={count <= MIN_GENERATED_CHORDS}
            onClick={() => onCountChange(count - 1)}
            className={stepButtonClass}
          >
            −
          </button>
          <input
            key={count}
            type="number"
            min={MIN_GENERATED_CHORDS}
            max={MAX_GENERATED_CHORDS}
            defaultValue={count}
            aria-label="Number of chords"
            onBlur={(event) => {
              const next = Number(event.target.value)
              if (Number.isFinite(next)) onCountChange(clampGeneratedCount(next))
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
            className="w-12 rounded-md border border-cosmos-700 bg-cosmos-900 px-1 py-0.5 text-center text-xs tabular-nums text-white outline-none focus:border-nebula-500"
          />
          <button
            type="button"
            aria-label="More chords"
            disabled={count >= MAX_GENERATED_CHORDS}
            onClick={() => onCountChange(count + 1)}
            className={stepButtonClass}
          >
            +
          </button>
        </div>
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-cosmos-500">Key</span>
          <select
            value={keyRoot}
            aria-label="Progression key"
            onChange={(event) => {
              const next = event.target.value
              if (!KEY_CENTERS.includes(next as KeyCenter)) return
              onKeyChange(next as KeyCenter)
            }}
            className={selectClass}
          >
            {KEY_CENTERS.map((root) => (
              <option key={root} value={root}>
                {root}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[10px] text-cosmos-500">{scaleLabel} scale</span>
      </div>
      <fieldset className="m-0 min-w-0 space-y-1 border-0 p-0">
        <legend className="text-[10px] font-semibold tracking-[0.12em] text-cosmos-500 uppercase">
          Chord choice
        </legend>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Chord choice">
          {SPICINESS_LABELS.map((label, index) => {
            const selected = spice === index
            return (
              <label
                key={label}
                className={`flex cursor-pointer items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition ${
                  selected
                    ? 'border-nebula-400 bg-nebula-600/30 text-white'
                    : 'border-cosmos-700 text-cosmos-300 hover:border-nebula-500'
                }`}
              >
                <input
                  type="radio"
                  name={radioName}
                  value={index}
                  checked={selected}
                  onChange={() => onSpiceChange(index)}
                  className="accent-nebula-500"
                />
                {label}
              </label>
            )
          })}
        </div>
        <span className="block text-[10px] leading-snug text-cosmos-500">
          {SPICINESS_HINTS[spice] ?? SPICINESS_HINTS[2]}
        </span>
      </fieldset>
      <label className="block">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-semibold tracking-[0.12em] text-cosmos-500 uppercase">
            V-system
          </span>
          <span className="text-[11px] font-semibold text-cosmos-200 tabular-nums">
            {exoticism.toFixed(1)}
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={EXOTICISM_MAX}
          step="any"
          value={exoticism}
          aria-label="V-system exoticism"
          aria-valuetext={exoticismLabel(exoticism)}
          draggable={false}
          onPointerDown={suspendGroupDrag}
          onDragStart={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onChange={(event) =>
            onExoticismChange(clampExoticism(Number(event.target.value)))
          }
          className="mt-1 h-6 w-full accent-nebula-500"
        />
        <span className="block text-[10px] leading-snug text-cosmos-500">
          {exoticismLabel(exoticism)}
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onGenerate}
          className="rounded-md border border-nebula-400/80 bg-nebula-600/30 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-nebula-500/50"
        >
          {filledCount > 0 ? 'Replace progression' : 'Create progression'}
        </button>
        {filledCount > 0 ? (
          <span className="text-[10px] text-cosmos-500">
            Replaces the chords in this group
          </span>
        ) : null}
      </div>
    </div>
  )
}

function stepsByColumn(steps: ProgressionStep[]): ProgressionStep[][] {
  const columns: ProgressionStep[][] = DEGREES.map(() => [])
  for (const step of steps) {
    columns[columnForStep(step)].push(step)
  }
  return columns
}

function columnForStep(step: ProgressionStep): number {
  if (step.kind === 'passing-dim') {
    const numeral = step.roman.replace(/^[b#]+/, '').replace(/°7$/, '')
    const index = DEGREES.indexOf(numeral as (typeof DEGREES)[number])
    if (index >= 0) return index
  }
  if (step.degree >= 1 && step.degree <= DEGREES.length) return step.degree - 1
  return 0
}
