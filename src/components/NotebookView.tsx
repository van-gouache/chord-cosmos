import type { RefCallback } from 'react'

import { ChordDiagram } from './ChordDiagram'
import { displayChordSymbol } from '../theory/chords'
import {
  DEFAULT_MODE,
  MODE_OPTIONS,
  romanBadge,
  romanForChord,
  type ModeId,
} from '../theory/diatonic'
import { inversionOrdinal } from '../theory/voicings'
import { isLineGroupId } from '../theory/lineOutline'
import {
  NOTEBOOK_STYLES,
  type NotebookStyle,
} from '../state/notebook'
import {
  hydrateSlot,
  locationsEqual,
  type SequenceSlot,
  type SlotLocation,
  type Song,
} from '../state/songs'

interface Props {
  song: Song
  style: NotebookStyle
  selected: SlotLocation | null
  playingLocation: SlotLocation | null
  playingCellRef: RefCallback<HTMLElement>
  onSelect: (location: SlotLocation) => void
  onPreview: (location: SlotLocation, slot: SequenceSlot) => void
  onPlayFromSection: (sectionId: string) => void
}

export function NotebookStyleSwitch({
  value,
  onChange,
}: {
  value: NotebookStyle
  onChange: (style: NotebookStyle) => void
}) {
  return (
    <div
      className="flex h-8 items-center rounded-lg border border-cosmos-700 bg-cosmos-900 p-0.5"
      role="group"
      aria-label="Notebook page style"
    >
      {NOTEBOOK_STYLES.map((option) => (
        <button
          key={option.id}
          type="button"
          title={option.hint}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={`h-7 rounded-md px-2 text-[11px] font-medium transition ${
            value === option.id
              ? 'bg-nebula-600 text-white'
              : 'text-cosmos-300 hover:text-white'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function NotebookView({
  song,
  style,
  selected,
  playingLocation,
  playingCellRef,
  onSelect,
  onPreview,
  onPlayFromSection,
}: Props) {
  return (
    <article className="notebook-page" data-style={style}>
      <header className="notebook-masthead">
        <p className="notebook-kicker">Practice notebook</p>
        <h2 className="notebook-title">{song.name}</h2>
      </header>

      {song.sections.map((section) => {
        const canPlay = section.bars.some((bar) => bar.slots.some(Boolean))
        return (
          <section key={section.id} className="notebook-section">
            <div className="notebook-rehearsal-row">
              <span className="notebook-rehearsal">{section.name || 'A'}</span>
              {section.note.trim() && (
                <p className="notebook-section-note">{section.note}</p>
              )}
              {canPlay && (
                <button
                  type="button"
                  className="notebook-play"
                  onClick={() => onPlayFromSection(section.id)}
                  aria-label={`Play from section ${section.name}`}
                >
                  ▶
                </button>
              )}
            </div>
            {section.bars.map((bar, barIndex) => {
              const filled = bar.slots.flatMap((slot, slotIndex) =>
                slot
                  ? [
                      <NotebookEntry
                        key={`${bar.id}-${slotIndex}`}
                        slot={slot}
                        keyRoot={bar.keyRoot}
                        mode={bar.mode}
                        location={{
                          sectionId: section.id,
                          barId: bar.id,
                          slotIndex,
                        }}
                        selected={selected}
                        playingLocation={playingLocation}
                        playingCellRef={playingCellRef}
                        onSelect={onSelect}
                        onPreview={onPreview}
                      />,
                    ]
                  : []
              )
              if (filled.length === 0) return null
              return (
                <div key={bar.id} className="notebook-group">
                  <div className="notebook-group-head">
                    <span className="notebook-group-label">
                      Group {barIndex + 1}
                    </span>
                    {bar.keyRoot ? (
                      <span className="notebook-group-key">
                        {bar.keyRoot}{' '}
                        {MODE_OPTIONS.find(
                          (option) => option.id === (bar.mode ?? DEFAULT_MODE)
                        )?.label ?? 'Ionian'}
                      </span>
                    ) : null}
                  </div>
                  <div className="notebook-box-row">{filled}</div>
                </div>
              )
            })}
          </section>
        )
      })}
    </article>
  )
}

function NotebookEntry({
  slot,
  keyRoot,
  mode,
  location,
  selected,
  playingLocation,
  playingCellRef,
  onSelect,
  onPreview,
}: {
  slot: SequenceSlot
  keyRoot?: string
  mode?: ModeId
  location: SlotLocation
  selected: SlotLocation | null
  playingLocation: SlotLocation | null
  playingCellRef: RefCallback<HTMLElement>
  onSelect: (location: SlotLocation) => void
  onPreview: (location: SlotLocation, slot: SequenceSlot) => void
}) {
  const isPlaying =
    playingLocation !== null && locationsEqual(playingLocation, location)
  const isSelected =
    selected !== null && locationsEqual(selected, location)
  const hydrated = hydrateSlot(slot)
  const romanLabel = isLineGroupId(slot.groupId)
    ? undefined
    : romanForChord(slot.chordSymbol, keyRoot, mode ?? DEFAULT_MODE)

  return (
    <button
      type="button"
      ref={isPlaying ? playingCellRef : undefined}
      className={`notebook-chord is-box${isPlaying ? ' is-playing' : ''}${
        isSelected ? ' is-selected' : ''
      }`}
      onClick={() => {
        if (!isLineGroupId(slot.groupId) || slot.lineAudio) {
          onPreview(location, slot)
        }
        onSelect(location)
      }}
    >
      <div className="notebook-chord-head">
        {romanLabel ? (
          <span className="notebook-roman" title={romanLabel}>
            {romanBadge(romanLabel)}
          </span>
        ) : null}
        <span className="notebook-symbol">
          {isLineGroupId(slot.groupId)
            ? 'Line'
            : displayChordSymbol(slot.chordSymbol)}
        </span>
      </div>
      {hydrated.fingering && hydrated.shape && (
        <ChordDiagram
          fingering={hydrated.fingering}
          shape={hydrated.shape}
          size="nb"
          showDegrees
          kind={isLineGroupId(slot.groupId) ? 'line' : 'chord'}
          highlightedNotes={
            isLineGroupId(slot.groupId) ? slot.lineNotes : slot.highlightedNotes
          }
          extendLow={slot.extendLow}
          extendHigh={slot.extendHigh}
          className="notebook-box-diagram"
        />
      )}
      <span className="notebook-voicing">
        {isLineGroupId(slot.groupId)
          ? `Line · ${slot.lineNotes?.length ?? 0} note${
              (slot.lineNotes?.length ?? 0) === 1 ? '' : 's'
            }`
          : `${slot.groupId} · ${shortInversion(slot.inversion)}`}
      </span>
      {slot.note.trim() ? (
        <span className="notebook-slot-note">{slot.note}</span>
      ) : null}
    </button>
  )
}

function shortInversion(inversion: number): string {
  return ['root', '1st', '2nd', '3rd'][inversion] ?? inversionOrdinal(inversion)
}
