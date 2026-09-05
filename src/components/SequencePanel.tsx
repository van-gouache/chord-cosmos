import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react'

import { playArrangement, playBeat, stopAll } from '../audio/player'
import {
  DEFAULT_STRUM_PATTERN,
  MAX_BPM,
  MAX_STEPS_PER_MEASURE,
  MIN_BPM,
  MIN_STEPS_PER_MEASURE,
  STRUM_PATTERNS,
  barSteps,
  exportSong,
  formatStrumPattern,
  hydrateSlot,
  locationKey,
  locationsEqual,
  playTimeline,
  slotPlayback,
  slotStrumPattern,
  type PlaybackStyle,
  type SequenceSlot,
  type SlotLocation,
  type Song,
} from '../state/songs'
import { incomingVoicingFrom, isVoicingDrag } from './voicingDrag'
import { OctaveSelect } from './OctaveShiftButtons'
import type { Fingering } from '../theory/fretboard'
import type { VoicingShape } from '../theory/vsystem'
import { inversionOrdinal } from '../theory/voicings'
import { ChordDiagram, type DiagramSize } from './ChordDiagram'
import { SongManager } from './SongManager'

const DRAG_MIME = 'application/x-chord-slot'
const MEASURE_DRAG_MIME = 'application/x-chord-measure'
const BPM_PRESETS = [60, 80, 90, 120, 160]
const PLAYBACK_OPTIONS: { id: PlaybackStyle; label: string; hint: string }[] = [
  { id: 'strum', label: 'Strum', hint: 'All notes together' },
  { id: 'arp-up', label: 'Arp ↑', hint: 'Low to high' },
  { id: 'arp-down', label: 'Arp ↓', hint: 'High to low' },
]

interface Props {
  song: Song | null
  songs: Song[]
  slotCount: number
  onSelectSong: (id: string) => void
  onNewSong: () => void
  onDuplicateSong: (id: string) => void
  onImportSongs: (value: unknown) => number
  onDeleteSong: (id: string) => void
  onRename: (id: string, name: string) => void
  onRemoveSlot: (location: SlotLocation) => void
  onMoveSlot: (from: SlotLocation, to: SlotLocation) => void
  onPlaceIncoming: (location: SlotLocation, slot: SequenceSlot) => void
  onDuplicateSlot: (location: SlotLocation) => void
  onSetSlotNote: (location: SlotLocation, note: string) => void
  onSetSlotFeel: (
    location: SlotLocation,
    patch: Pick<SequenceSlot, 'playback' | 'strumPattern'>
  ) => void
  onShiftSlotOctave: (location: SlotLocation, deltaFrets: number) => void
  onAddMeasure: (sectionId: string) => void
  onDuplicateMeasure: (sectionId: string, measureId: string) => void
  onMoveMeasure: (
    from: { sectionId: string; barId: string },
    to: { sectionId: string; beforeBarId?: string | null }
  ) => void
  onRemoveMeasure: (sectionId: string, measureId: string) => void
  onAddSection: () => void
  onRenameSection: (sectionId: string, name: string) => void
  onSetSectionNote: (sectionId: string, note: string) => void
  onRemoveSection: (sectionId: string) => void
  onSetBpm: (bpm: number) => void
  onSetMeasureSteps: (barId: string, steps: number) => void
  onSetPlayback: (playback: PlaybackStyle) => void
  onSetStrumPattern: (pattern: string | undefined) => void
  onClear: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  focusMode: boolean
  onToggleFocus: () => void
}

export function SequencePanel({
  song,
  songs,
  slotCount,
  onSelectSong,
  onNewSong,
  onDuplicateSong,
  onImportSongs,
  onDeleteSong,
  onRename,
  onRemoveSlot,
  onMoveSlot,
  onPlaceIncoming,
  onDuplicateSlot,
  onSetSlotNote,
  onSetSlotFeel,
  onShiftSlotOctave,
  onAddMeasure,
  onDuplicateMeasure,
  onMoveMeasure,
  onRemoveMeasure,
  onAddSection,
  onRenameSection,
  onSetSectionNote,
  onRemoveSection,
  onSetBpm,
  onSetMeasureSteps,
  onSetPlayback,
  onSetStrumPattern,
  onClear,
  focusMode,
  onToggleFocus,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const [dragFrom, setDragFrom] = useState<SlotLocation | null>(null)
  const [dropTarget, setDropTarget] = useState<SlotLocation | null>(null)
  const [dragMeasureFrom, setDragMeasureFrom] = useState<{
    sectionId: string
    barId: string
  } | null>(null)
  const [dropMeasureTarget, setDropMeasureTarget] = useState<{
    sectionId: string
    beforeBarId?: string | null
  } | null>(null)
  const [selected, setSelected] = useState<SlotLocation | null>(null)
  const [copied, setCopied] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const [playbackOpen, setPlaybackOpen] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const playingCellRef = useRef<HTMLDivElement>(null)

  const timeline = useMemo(() => (song ? playTimeline(song) : []), [song])

  const hydratedById = useMemo(() => {
    const map = new Map<
      string,
      { fingering: Fingering | null; shape: VoicingShape | null }
    >()
    for (const event of timeline) {
      if (!event.slot || map.has(event.slot.id)) continue
      map.set(event.slot.id, hydrateSlot(event.slot))
    }
    return map
  }, [timeline])

  const midiByIndex = useMemo(() => {
    return timeline.map((event) => {
      if (!event.slot) return null
      return hydratedById.get(event.slot.id)?.fingering?.midiNotes ?? null
    })
  }, [hydratedById, timeline])

  useEffect(() => {
    return () => {
      stopRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (!focusMode || managerOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.fullscreenElement) return
      event.preventDefault()
      onToggleFocus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [focusMode, managerOpen, onToggleFocus])

  const stop = useCallback(() => {
    stopRef.current?.()
    stopRef.current = null
    setIsPlaying(false)
    setPlayingIndex(null)
    stopAll()
  }, [])

  const playFrom = useCallback(
    (startIndex = 0) => {
      if (!song) return
      const remaining = timeline.slice(startIndex)
      if (!remaining.some((event) => event.slot)) return
      stopRef.current?.()
      stopAll()
      setIsPlaying(true)
      setPlayingIndex(startIndex)
      const cancel = playArrangement(
        remaining.map((event, offset) => ({
          midiNotes: midiByIndex[startIndex + offset],
          seconds: event.seconds,
          style: slotPlayback(event.slot, song.playback),
          strumPattern: slotStrumPattern(event.slot, song.strumPattern),
        })),
        {
          onBeat: (index) => setPlayingIndex(startIndex + index),
          onDone: () => {
            setIsPlaying(false)
            setPlayingIndex(null)
            stopRef.current = null
          },
        }
      )
      stopRef.current = cancel
    },
    [midiByIndex, song, timeline]
  )

  const play = useCallback(() => playFrom(0), [playFrom])

  const playFromMeasure = useCallback(
    (barId: string) => {
      const startIndex = timeline.findIndex(
        (event) => event.location?.barId === barId
      )
      if (startIndex >= 0) playFrom(startIndex)
    },
    [playFrom, timeline]
  )

  const playFromSection = useCallback(
    (sectionId: string) => {
      const startIndex = timeline.findIndex(
        (event) => event.location?.sectionId === sectionId
      )
      if (startIndex >= 0) playFrom(startIndex)
    },
    [playFrom, timeline]
  )

  const copy = async () => {
    if (!song) return
    try {
      await navigator.clipboard.writeText(exportSong(song))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard blocked; nothing useful to do.
    }
  }

  const dropOn = (to: SlotLocation) => {
    if (dragFrom && !locationsEqual(dragFrom, to)) {
      onMoveSlot(dragFrom, to)
      setSelected(to)
    }
    setDragFrom(null)
    setDropTarget(null)
  }

  const dropMeasureOn = (to: {
    sectionId: string
    beforeBarId?: string | null
  }) => {
    if (
      dragMeasureFrom &&
      (dragMeasureFrom.sectionId !== to.sectionId ||
        dragMeasureFrom.barId !== to.beforeBarId)
    ) {
      onMoveMeasure(dragMeasureFrom, to)
    }
    setDragMeasureFrom(null)
    setDropMeasureTarget(null)
  }

  const allowMeasureDrop = (event: {
    preventDefault: () => void
    dataTransfer: DataTransfer
  }) => {
    if (
      focusMode ||
      !(dragMeasureFrom || isMeasureDrag([...event.dataTransfer.types]))
    ) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const startMeasureDrag = (
    event: {
      preventDefault: () => void
      dataTransfer: DataTransfer
      target: EventTarget
    },
    sectionId: string,
    barId: string
  ) => {
    if (isSlotDragTarget(event.target)) return
    if (focusMode || isInteractiveDragTarget(event.target)) {
      event.preventDefault()
      return
    }
    event.dataTransfer.setData(
      MEASURE_DRAG_MIME,
      JSON.stringify({ sectionId, barId })
    )
    event.dataTransfer.setData(
      'text/plain',
      JSON.stringify({ sectionId, barId })
    )
    event.dataTransfer.effectAllowed = 'move'
    setDragMeasureFrom({ sectionId, barId })
  }

  const playingLocation =
    playingIndex !== null ? (timeline[playingIndex]?.location ?? null) : null

  useEffect(() => {
    if (!focusMode || playingIndex === null) return
    playingCellRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
  }, [focusMode, playingIndex])

  if (!song?.sections) return null

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 px-5 pt-3 pb-3">
        {focusMode ? (
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight text-white">
              {song.name}
            </h2>
            <p className="hidden shrink-0 text-xs text-cosmos-400 sm:block">
              {playbackSummary(song)}
            </p>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={isPlaying ? stop : play}
                disabled={slotCount === 0}
                className="flex h-8 items-center rounded-lg bg-nebula-600 px-3.5 text-sm font-semibold text-white transition hover:bg-nebula-500 disabled:cursor-not-allowed disabled:bg-cosmos-800 disabled:text-cosmos-600"
              >
                {isPlaying ? '■ Stop' : '▶ Play'}
              </button>
              <button
                type="button"
                aria-pressed
                onClick={onToggleFocus}
                className="flex h-8 items-center rounded-lg border border-cosmos-700 px-3 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
              >
                Exit
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <input
                    value={song.name}
                    onChange={(e) => onRename(song.id, e.target.value)}
                    aria-label="Sequence name"
                    className="min-w-0 flex-1 bg-transparent px-0 py-0.5 text-left text-2xl font-bold tracking-tight text-white outline-none hover:bg-cosmos-850 focus:bg-cosmos-850"
                  />
                  <button
                    type="button"
                    onClick={() => setManagerOpen(true)}
                    className="h-8 shrink-0 rounded-lg border border-cosmos-700 px-3 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
                  >
                    Songs{songs.length > 1 ? ` · ${songs.length}` : ''}
                  </button>
                </div>
                <p className="mt-0.5 text-sm text-cosmos-400">
                  {slotCount} chord{slotCount === 1 ? '' : 's'} · {sectionMeta(song)}
                </p>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={isPlaying ? stop : play}
                disabled={slotCount === 0}
                className="flex h-8 items-center rounded-lg bg-nebula-600 px-3.5 text-sm font-semibold text-white transition hover:bg-nebula-500 disabled:cursor-not-allowed disabled:bg-cosmos-800 disabled:text-cosmos-600"
              >
                {isPlaying ? '■ Stop' : '▶ Play'}
              </button>
              <button
                type="button"
                aria-expanded={playbackOpen}
                aria-controls="playback-panel"
                onClick={() => setPlaybackOpen((open) => !open)}
                className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm transition ${
                  playbackOpen
                    ? 'border-nebula-500 text-white'
                    : 'border-cosmos-700 text-cosmos-300 hover:border-nebula-500 hover:text-white'
                }`}
              >
                <span>{playbackSummary(song)}</span>
                <span aria-hidden className="text-[10px] text-cosmos-500">
                  {playbackOpen ? '▴' : '▾'}
                </span>
              </button>
              <button
                type="button"
                onClick={copy}
                disabled={slotCount === 0}
                title="Copy the sequence as text"
                className="flex h-8 items-center rounded-lg border border-cosmos-700 px-3 text-sm text-cosmos-300 transition hover:border-star-400 hover:text-star-300 disabled:opacity-40"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              {slotCount > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="flex h-8 items-center px-2 text-sm text-cosmos-400 transition hover:text-red-400"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                aria-pressed={false}
                onClick={() => {
                  setManagerOpen(false)
                  setPlaybackOpen(false)
                  setSelected(null)
                  onToggleFocus()
                }}
                className="flex h-8 shrink-0 items-center rounded-lg border border-cosmos-700 px-3 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
              >
                Full screen
              </button>
            </div>
          </>
        )}
      </header>

      {!focusMode && playbackOpen && (
        <div
          id="playback-panel"
          className="shrink-0 border-b border-cosmos-700/70 px-5 py-3"
        >
          <div className="rounded-xl border border-cosmos-700/80 bg-cosmos-850/60 px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
                Playback
              </p>
              <button
                type="button"
                onClick={() => setPlaybackOpen(false)}
                className="rounded-md px-2 py-0.5 text-xs text-cosmos-400 transition hover:text-white"
              >
                Hide
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex h-8 items-center rounded-lg border border-cosmos-700 bg-cosmos-900 p-0.5"
                role="group"
                aria-label="Playback style"
              >
                {PLAYBACK_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    title={option.hint}
                    aria-pressed={song.playback === option.id}
                    onClick={() => onSetPlayback(option.id)}
                    className={`h-7 rounded-md px-2.5 text-xs font-medium transition ${
                      song.playback === option.id
                        ? 'bg-nebula-600 text-white'
                        : 'text-cosmos-300 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {song.playback === 'strum' && (
                <label className="flex h-8 items-center gap-1.5 rounded-lg border border-cosmos-700 bg-cosmos-900 px-2">
                  <span className="text-[10px] font-semibold tracking-[0.12em] text-cosmos-400 uppercase">
                    Pattern
                  </span>
                  <select
                    value={song.strumPattern ?? DEFAULT_STRUM_PATTERN}
                    onChange={(event) => {
                      const next = event.target.value
                      onSetStrumPattern(
                        next === DEFAULT_STRUM_PATTERN ? undefined : next
                      )
                    }}
                    aria-label="Strum pattern"
                    className="h-7 bg-transparent text-xs text-white outline-none"
                  >
                    {STRUM_PATTERNS.map((pattern) => (
                      <option key={pattern.id} value={pattern.id}>
                        {pattern.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex h-8 min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-cosmos-700 bg-cosmos-900 px-2.5">
                <label className="shrink-0 text-[10px] font-semibold tracking-[0.12em] text-cosmos-400 uppercase">
                  Tempo
                </label>
                <input
                  type="range"
                  min={MIN_BPM}
                  max={MAX_BPM}
                  value={song.bpm}
                  onChange={(e) => onSetBpm(Number(e.target.value))}
                  aria-label="Tempo"
                  className="min-w-[72px] flex-1 accent-nebula-500"
                />
                <input
                  type="number"
                  min={MIN_BPM}
                  max={MAX_BPM}
                  value={song.bpm}
                  onChange={(e) => {
                    const next = Number(e.target.value)
                    if (Number.isFinite(next)) onSetBpm(next)
                  }}
                  aria-label="BPM"
                  className="h-6 w-12 rounded-md border border-cosmos-700 bg-cosmos-850 px-1 text-center text-xs tabular-nums text-white outline-none focus:border-nebula-500"
                />
                <div className="hidden items-center sm:flex">
                  {BPM_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onSetBpm(preset)}
                      className={`h-6 rounded px-1.5 text-[11px] tabular-nums transition ${
                        song.bpm === preset
                          ? 'text-white'
                          : 'text-cosmos-500 hover:text-white'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <SongManager
        key={managerOpen ? 'open' : 'closed'}
        open={!focusMode && managerOpen}
        songs={songs}
        activeSongId={song.id}
        onClose={() => setManagerOpen(false)}
        onSelect={onSelectSong}
        onNew={onNewSong}
        onRename={onRename}
        onDuplicate={onDuplicateSong}
        onDelete={onDeleteSong}
        onImport={onImportSongs}
      />

      <div
        ref={scrollRef}
        className={
          focusMode
            ? 'min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-4'
            : 'min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-5'
        }
      >
        {song.sections.map((section, sectionIndex) => {
          const sectionStart = timeline.findIndex(
            (event) => event.location?.sectionId === section.id
          )
          const canPlayFromSection =
            sectionStart >= 0 &&
            timeline.slice(sectionStart).some((event) => event.slot)
          return (
          <div key={section.id}>
            {focusMode ? (
              (song.sections.length > 1 ||
                section.note.trim() ||
                section.name.trim() !== 'A') && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-white">{section.name}</p>
                    {canPlayFromSection && (
                      <button
                        type="button"
                        onClick={() => playFromSection(section.id)}
                        aria-label={`Play from section ${section.name}`}
                        title={`Play from ${section.name}`}
                        className="rounded-md px-1.5 py-0.5 text-[11px] text-cosmos-400 transition hover:bg-nebula-600/20 hover:text-white"
                      >
                        ▶
                      </button>
                    )}
                  </div>
                  {section.note.trim() && (
                    <p className="mt-0.5 text-xs text-cosmos-400">{section.note}</p>
                  )}
                </div>
              )
            ) : (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
                    Section
                  </span>
                  {canPlayFromSection && (
                    <button
                      type="button"
                      onClick={() => playFromSection(section.id)}
                      aria-label={`Play from section ${section.name}`}
                      title={`Play from ${section.name}`}
                      className="rounded-md px-1.5 py-0.5 text-[11px] text-cosmos-400 transition hover:bg-nebula-600/20 hover:text-white"
                    >
                      ▶
                    </button>
                  )}
                </div>
                <input
                  value={section.name}
                  onChange={(e) => onRenameSection(section.id, e.target.value)}
                  aria-label={`Section ${sectionIndex + 1} name`}
                  className="w-28 rounded-lg border border-cosmos-700 bg-cosmos-900 px-2 py-1 text-sm font-semibold text-white outline-none focus:border-nebula-500"
                />
                <input
                  value={section.note}
                  onChange={(e) => onSetSectionNote(section.id, e.target.value)}
                  placeholder="Notes for this section…"
                  aria-label={`${section.name} notes`}
                  className="min-w-[180px] flex-1 rounded-lg border border-cosmos-700/70 bg-transparent px-2 py-1 text-xs text-cosmos-300 outline-none placeholder:text-cosmos-600 focus:border-nebula-500"
                />
                {song.sections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveSection(section.id)}
                    className="rounded-lg px-2 py-1 text-xs text-cosmos-400 transition hover:text-red-400"
                  >
                    Remove section
                  </button>
                )}
              </div>
            )}

            <div
              className={
                focusMode && section.bars.length > 1
                  ? 'grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3'
                  : 'grid grid-cols-1 gap-3 min-[760px]:grid-cols-2 min-[1180px]:grid-cols-3'
              }
            >
              {section.bars.map((bar, barIndex) => {
                const steps = barSteps(bar)
                const showMeasureLabel =
                  !focusMode ||
                  song.sections.some((item) => item.bars.length > 1) ||
                  song.sections.length > 1
                const visibleSlots = focusMode
                  ? bar.slots
                      .map((slot, slotIndex) => ({ slot, slotIndex }))
                      .filter((item) => item.slot)
                  : bar.slots.map((slot, slotIndex) => ({ slot, slotIndex }))
                const gridSteps = focusMode ? visibleSlots.length : steps
                const measureStart = timeline.findIndex(
                  (event) => event.location?.barId === bar.id
                )
                const canPlayFromMeasure =
                  measureStart >= 0 &&
                  timeline.slice(measureStart).some((event) => event.slot)
                const shareRow = focusMode && section.bars.length > 1
                const measureOverflowsRow =
                  shareRow && visibleSlots.length > 4
                return (
                <div
                  key={bar.id}
                  draggable={!focusMode}
                  title={
                    focusMode ? undefined : 'Drag onto another measure to swap'
                  }
                  onDragStart={(event) =>
                    startMeasureDrag(event, section.id, bar.id)
                  }
                  onDragEnter={allowMeasureDrop}
                  onDragOver={(event) => {
                    allowMeasureDrop(event)
                    if (
                      dragMeasureFrom ||
                      isMeasureDrag([...event.dataTransfer.types])
                    ) {
                      setDropMeasureTarget({
                        sectionId: section.id,
                        beforeBarId: bar.id,
                      })
                    }
                  }}
                  onDrop={(event) => {
                    if (
                      !(
                        dragMeasureFrom ||
                        isMeasureDrag([...event.dataTransfer.types])
                      )
                    ) {
                      return
                    }
                    event.preventDefault()
                    event.stopPropagation()
                    dropMeasureOn({ sectionId: section.id, beforeBarId: bar.id })
                  }}
                  onDragEnd={() => {
                    setDragMeasureFrom(null)
                    setDropMeasureTarget(null)
                  }}
                  className={
                    focusMode
                      ? `min-w-0 ${measureOverflowsRow ? 'col-span-full' : ''}`
                      : `min-w-0 select-none rounded-xl border bg-cosmos-900/60 p-2.5 transition ${
                          dragMeasureFrom?.barId === bar.id
                            ? 'border-cosmos-600 opacity-45'
                            : dropMeasureTarget?.beforeBarId === bar.id
                              ? 'border-nebula-400 bg-nebula-500/10'
                              : 'border-cosmos-700/70'
                        }`
                  }
                >
                  {(showMeasureLabel || !focusMode) && (
                    <div
                      className={
                        focusMode
                          ? 'mb-2 flex flex-wrap items-center justify-between gap-2'
                          : 'mb-2 flex cursor-grab flex-wrap items-center justify-between gap-2 active:cursor-grabbing'
                      }
                    >
                      {showMeasureLabel && (
                        <div className="flex items-center gap-1.5">
                          {!focusMode && (
                            <span
                              aria-hidden
                              className="grid grid-cols-2 gap-px px-0.5 text-cosmos-500"
                            >
                              <span className="h-1 w-1 rounded-full bg-current" />
                              <span className="h-1 w-1 rounded-full bg-current" />
                              <span className="h-1 w-1 rounded-full bg-current" />
                              <span className="h-1 w-1 rounded-full bg-current" />
                              <span className="h-1 w-1 rounded-full bg-current" />
                              <span className="h-1 w-1 rounded-full bg-current" />
                            </span>
                          )}
                          <p className="text-[11px] font-semibold tracking-wide text-cosmos-400 uppercase">
                            Measure {barIndex + 1}
                          </p>
                          {canPlayFromMeasure && (
                            <button
                              type="button"
                              onClick={() => playFromMeasure(bar.id)}
                              aria-label={`Play from measure ${barIndex + 1}`}
                              title={`Play from measure ${barIndex + 1}`}
                              className="rounded-md px-1.5 py-0.5 text-[11px] text-cosmos-400 transition hover:bg-nebula-600/20 hover:text-white"
                            >
                              ▶
                            </button>
                          )}
                        </div>
                      )}
                      {!focusMode && (
                        <div className="flex items-center gap-1.5">
                          <MeasureStepsControl
                            steps={steps}
                            measureId={bar.id}
                            measureIndex={barIndex}
                            onChange={(next) => onSetMeasureSteps(bar.id, next)}
                          />
                          <button
                            type="button"
                            onClick={() => onDuplicateMeasure(section.id, bar.id)}
                            aria-label={`Copy measure ${barIndex + 1}`}
                            title={`Copy measure ${barIndex + 1}`}
                            className="ml-1 text-[11px] text-cosmos-400 transition hover:text-white"
                          >
                            ⧉
                          </button>
                          {section.bars.length > 1 && (
                            <button
                              type="button"
                              onClick={() => onRemoveMeasure(section.id, bar.id)}
                              aria-label={`Remove measure ${barIndex + 1}`}
                              className="text-[11px] text-cosmos-500 transition hover:text-red-400"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className={`grid ${
                      focusMode
                        ? shareRow && !measureOverflowsRow
                          ? 'justify-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,14rem),14rem))]'
                          : 'justify-start gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),22rem))]'
                        : `gap-2 ${stepGridClass(steps)}`
                    }`}
                  >
                    {visibleSlots.map(({ slot, slotIndex }) => {
                      const location: SlotLocation = {
                        sectionId: section.id,
                        barId: bar.id,
                        slotIndex,
                      }
                      const eventIndex = timeline.findIndex(
                        (event) =>
                          event.location !== null &&
                          locationsEqual(event.location, location)
                      )
                      const isPlaying =
                        playingLocation !== null &&
                        locationsEqual(playingLocation, location)
                      const isSelected =
                        selected !== null && locationsEqual(selected, location)
                      const isDrop =
                        dropTarget !== null && locationsEqual(dropTarget, location)
                      const isDragSource =
                        dragFrom !== null && locationsEqual(dragFrom, location)

                      return (
                        <SlotCell
                          key={locationKey(location)}
                          location={location}
                          slot={slot}
                          fingering={
                            slot ? (hydratedById.get(slot.id)?.fingering ?? null) : null
                          }
                          shape={slot ? (hydratedById.get(slot.id)?.shape ?? null) : null}
                          diagramSize={
                            focusMode ? 'present' : diagramSizeForSteps(steps)
                          }
                          steps={focusMode ? Math.max(1, gridSteps) : steps}
                          presenting={focusMode}
                          measureDragging={Boolean(dragMeasureFrom)}
                          songPlayback={song.playback}
                          songPattern={song.strumPattern}
                          isPlaying={isPlaying}
                          isSelected={!focusMode && isSelected}
                          isDrop={!focusMode && isDrop}
                          isDragSource={!focusMode && isDragSource}
                          cellRef={isPlaying ? playingCellRef : undefined}
                          onSelect={() => {
                            if (focusMode) {
                              if (!slot) return
                              const notes = midiByIndex[eventIndex]
                              if (notes) {
                                playBeat(notes, {
                                  style: slotPlayback(slot, song.playback),
                                  seconds:
                                    timeline[eventIndex]?.seconds ?? 1.2,
                                  strumPattern: slotStrumPattern(
                                    slot,
                                    song.strumPattern
                                  ),
                                })
                              }
                              return
                            }
                            setSelected(location)
                          }}
                          onPreview={() => {
                            if (!slot) return
                            const notes = midiByIndex[eventIndex]
                            if (!notes) return
                            playBeat(notes, {
                              style: slotPlayback(slot, song.playback),
                              seconds: timeline[eventIndex]?.seconds ?? 1.2,
                              strumPattern: slotStrumPattern(
                                slot,
                                song.strumPattern
                              ),
                            })
                          }}
                          onRemove={() => onRemoveSlot(location)}
                          onDuplicate={() => onDuplicateSlot(location)}
                          onNoteChange={(note) => onSetSlotNote(location, note)}
                          onFeelChange={(patch) => onSetSlotFeel(location, patch)}
                          onOctaveShift={(delta) => onShiftSlotOctave(location, delta)}
                          onDragStart={() => setDragFrom(location)}
                          onDragEnd={() => {
                            setDragFrom(null)
                            setDropTarget(null)
                          }}
                          onDragOver={() => setDropTarget(location)}
                          onDrop={(event) => {
                            const incoming = incomingVoicingFrom(
                              event.dataTransfer
                            )
                            if (incoming) {
                              onPlaceIncoming(location, incoming)
                              setSelected(location)
                              setDragFrom(null)
                              setDropTarget(null)
                              return
                            }
                            dropOn(location)
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
                )
              })}
              {!focusMode && (
                <button
                  type="button"
                  onClick={() => onAddMeasure(section.id)}
                  onDragEnter={allowMeasureDrop}
                  onDragOver={(event) => {
                    allowMeasureDrop(event)
                    if (dragMeasureFrom || isMeasureDrag([...event.dataTransfer.types])) {
                      setDropMeasureTarget({
                        sectionId: section.id,
                        beforeBarId: null,
                      })
                    }
                  }}
                  onDrop={(event) => {
                    if (
                      !(
                        dragMeasureFrom ||
                        isMeasureDrag([...event.dataTransfer.types])
                      )
                    ) {
                      return
                    }
                    event.preventDefault()
                    event.stopPropagation()
                    dropMeasureOn({ sectionId: section.id, beforeBarId: null })
                  }}
                  aria-label={`Add measure ${section.bars.length + 1}`}
                  className={`flex min-h-[240px] min-w-0 flex-col items-center justify-center rounded-xl border border-dashed bg-cosmos-900/30 text-cosmos-400 transition ${
                    dropMeasureTarget?.sectionId === section.id &&
                    dropMeasureTarget.beforeBarId === null
                      ? 'border-nebula-400 bg-nebula-500/10 text-white'
                      : 'border-cosmos-700 hover:border-nebula-500 hover:bg-nebula-500/5 hover:text-white'
                  }`}
                >
                  <span className="text-[11px] font-semibold tracking-wide uppercase">
                    Measure {section.bars.length + 1}
                  </span>
                  <span className="mt-2 text-sm">+ Add measure</span>
                </button>
              )}
            </div>
          </div>
          )
        })}

        {!focusMode && (
          <button
            type="button"
            onClick={onAddSection}
            className="rounded-xl border border-dashed border-cosmos-700 px-3 py-2 text-xs text-cosmos-400 transition hover:border-nebula-500 hover:text-white"
          >
            + Add section
          </button>
        )}

        {slotCount === 0 && (
          <p className="text-center text-xs text-cosmos-400">
            {focusMode
              ? 'This sequence has no chords yet.'
              : `Add a voicing and it lands in the next empty step. Each measure can hold up to ${MAX_STEPS_PER_MEASURE} chords.`}
          </p>
        )}
      </div>
    </section>
  )
}

interface SlotCellProps {
  location: SlotLocation
  slot: Song['sections'][number]['bars'][number]['slots'][number]
  fingering: Fingering | null
  shape: VoicingShape | null
  diagramSize: DiagramSize
  steps: number
  presenting: boolean
  measureDragging?: boolean
  songPlayback: PlaybackStyle
  songPattern?: string
  isPlaying: boolean
  isSelected: boolean
  isDrop: boolean
  isDragSource: boolean
  cellRef?: Ref<HTMLDivElement>
  onSelect: () => void
  onPreview: () => void
  onRemove: () => void
  onDuplicate: () => void
  onNoteChange: (note: string) => void
  onFeelChange: (patch: Pick<SequenceSlot, 'playback' | 'strumPattern'>) => void
  onOctaveShift: (deltaFrets: number) => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: () => void
  onDrop: (event: { dataTransfer: DataTransfer }) => void
}

function SlotCell({
  location,
  slot,
  fingering,
  shape,
  diagramSize,
  steps,
  presenting,
  measureDragging = false,
  songPlayback,
  songPattern,
  isPlaying,
  isSelected,
  isDrop,
  isDragSource,
  cellRef,
  onSelect,
  onPreview,
  onRemove,
  onDuplicate,
  onNoteChange,
  onFeelChange,
  onOctaveShift,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: SlotCellProps) {
  const allowDrop = (event: { preventDefault: () => void; dataTransfer: DataTransfer }) => {
    if (presenting) return
    if (measureDragging || isMeasureDrag([...event.dataTransfer.types])) return
    event.preventDefault()
    event.dataTransfer.dropEffect = isVoicingDrag([...event.dataTransfer.types])
      ? 'copy'
      : 'move'
    onDragOver()
  }

  const handleDrop = (event: {
    preventDefault: () => void
    stopPropagation: () => void
    dataTransfer: DataTransfer
  }) => {
    if (presenting) return
    event.preventDefault()
    event.stopPropagation()
    onDrop(event)
  }

  return (
    <div
      ref={cellRef}
      data-slot-cell=""
      draggable={!presenting && Boolean(slot)}
      title={
        presenting
          ? undefined
          : slot
            ? 'Drag onto another chord to swap, or onto an empty step to move'
            : 'Drop a shape here'
      }
      onDragStart={(event) => {
        if (presenting || !slot) {
          event.preventDefault()
          return
        }
        event.stopPropagation()
        event.dataTransfer.setData(DRAG_MIME, JSON.stringify(location))
        event.dataTransfer.setData('text/plain', JSON.stringify(location))
        event.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnter={allowDrop}
      onDragOver={allowDrop}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`flex ${presenting ? '' : slotMinHeight(steps)} flex-col rounded-xl border transition ${
        presenting ? 'p-4' : 'p-2'
      } ${
        isPlaying
          ? 'border-star-400 bg-star-400/15'
          : isDrop
            ? 'border-nebula-400 bg-nebula-500/15'
            : isSelected
              ? 'border-nebula-500/70 bg-nebula-500/10'
              : slot
                ? presenting
                  ? 'border-cosmos-700/50 bg-cosmos-900/40'
                  : 'border-cosmos-700 bg-cosmos-850/80'
                : presenting
                  ? 'border-transparent bg-transparent'
                  : 'border-dashed border-cosmos-700/80 bg-transparent'
      } ${isDragSource ? 'opacity-40' : ''} ${
        slot
          ? presenting
            ? 'cursor-pointer'
            : 'cursor-grab active:cursor-grabbing'
          : ''
      }`}
    >
      {slot ? (
        <>
          <div
            className={`flex ${presenting ? '' : diagramAreaMinHeight(steps)} flex-1 items-center justify-center text-cosmos-200 ${
              presenting ? '' : 'pointer-events-none'
            }`}
          >
            {fingering && shape ? (
              <ChordDiagram
                fingering={fingering}
                shape={shape}
                size={diagramSize}
                showDegrees
                className={
                  presenting
                    ? 'h-auto w-full'
                    : 'mx-auto h-auto w-full max-w-[11rem]'
                }
              />
            ) : (
              <span className="text-xs text-cosmos-600">?</span>
            )}
          </div>
          {presenting ? (
            <div className="mt-2 text-center">
              <p className="truncate text-xl leading-tight font-bold text-white">
                {slot.chordSymbol}
              </p>
              <p className="mt-0.5 truncate text-sm text-nebula-400">
                {slot.groupId} · {shortInversion(slot.inversion)}
                {slot.playback ? ` · ${playbackLabel(slot.playback)}` : ''}
                {slotPlayback(slot, songPlayback) === 'strum' &&
                slot.strumPattern
                  ? ` · ${formatStrumPattern(slot.strumPattern)}`
                  : ''}
                {slot.note.trim() ? ` · ${slot.note}` : ''}
              </p>
            </div>
          ) : (
            <>
              <div className="mt-2 flex items-start justify-between gap-2">
                <div className="pointer-events-none min-w-0">
                  <p className="truncate text-base leading-tight font-bold text-white">
                    {slot.chordSymbol}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-nebula-300">
                    {slot.groupId} · {shortInversion(slot.inversion)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPreview()
                    }}
                    onDragEnter={allowDrop}
                    onDragOver={allowDrop}
                    onDrop={handleDrop}
                    aria-label={`Hear ${slot.chordSymbol}`}
                    className={slotIconClass}
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDuplicate()
                    }}
                    onDragEnter={allowDrop}
                    onDragOver={allowDrop}
                    onDrop={handleDrop}
                    aria-label={`Duplicate ${slot.chordSymbol}`}
                    className={slotIconClass}
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove()
                    }}
                    onDragEnter={allowDrop}
                    onDragOver={allowDrop}
                    onDrop={handleDrop}
                    aria-label={`Remove ${slot.chordSymbol}`}
                    className={`${slotIconClass} hover:text-red-400`}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <SlotFeelControls
                slot={slot}
                fingering={fingering}
                songPlayback={songPlayback}
                songPattern={songPattern}
                onChange={onFeelChange}
                onOctaveShift={onOctaveShift}
                onDragEnter={allowDrop}
                onDragOver={allowDrop}
                onDrop={handleDrop}
              />
              <input
                value={slot.note}
                onChange={(e) => onNoteChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onDragEnter={allowDrop}
                onDragOver={allowDrop}
                onDrop={handleDrop}
                placeholder="Note"
                aria-label={`Note for ${slot.chordSymbol}`}
                className="mt-1.5 w-full bg-transparent text-xs text-cosmos-300 outline-none placeholder:text-cosmos-600"
              />
            </>
          )}
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-cosmos-600">{presenting ? '·' : 'empty'}</p>
        </div>
      )}
    </div>
  )
}

function isMeasureDrag(types: readonly string[]): boolean {
  return types.some(
    (type) =>
      type === MEASURE_DRAG_MIME || type.toLowerCase() === MEASURE_DRAG_MIME
  )
}

function isInteractiveDragTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest('button, input, select, textarea, a, label'))
  )
}

function isSlotDragTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element && Boolean(target.closest('[data-slot-cell]'))
  )
}

function playbackLabel(playback: PlaybackStyle): string {
  return PLAYBACK_OPTIONS.find((option) => option.id === playback)?.label ?? 'Strum'
}

function playbackSummary(song: Song): string {
  const style = playbackLabel(song.playback)
  const pattern =
    song.playback === 'strum' &&
    song.strumPattern &&
    song.strumPattern !== DEFAULT_STRUM_PATTERN
      ? ` ${formatStrumPattern(song.strumPattern)}`
      : ''
  return `${style}${pattern} · ${song.bpm}`
}

const slotSelectClass =
  'h-7 min-w-0 flex-1 rounded-md border border-cosmos-700 bg-cosmos-900 px-1.5 text-xs text-cosmos-100 outline-none focus:border-nebula-500'

const slotIconClass =
  'flex h-7 w-7 items-center justify-center rounded-md text-sm text-cosmos-400 transition hover:bg-cosmos-700 hover:text-white'

function SlotFeelControls({
  slot,
  fingering,
  songPlayback,
  songPattern,
  onChange,
  onOctaveShift,
  onDragEnter,
  onDragOver,
  onDrop,
}: {
  slot: SequenceSlot
  fingering: Fingering | null
  songPlayback: PlaybackStyle
  songPattern?: string
  onChange: (patch: Pick<SequenceSlot, 'playback' | 'strumPattern'>) => void
  onOctaveShift: (deltaFrets: number) => void
  onDragEnter: (event: {
    preventDefault: () => void
    dataTransfer: DataTransfer
  }) => void
  onDragOver: (event: {
    preventDefault: () => void
    dataTransfer: DataTransfer
  }) => void
  onDrop: (event: {
    preventDefault: () => void
    stopPropagation: () => void
    dataTransfer: DataTransfer
  }) => void
}) {
  const style = slotPlayback(slot, songPlayback)
  return (
    <div
      className="mt-2 space-y-1.5"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex gap-1.5">
        {fingering && (
          <OctaveSelect
            fingering={fingering}
            chordSymbol={slot.chordSymbol}
            onShift={onOctaveShift}
            className={slotSelectClass}
          />
        )}
        <select
          value={slot.playback ?? ''}
          aria-label={`Playback for ${slot.chordSymbol}`}
          onChange={(event) => {
            const value = event.target.value
            onChange({
              playback: value === '' ? undefined : (value as PlaybackStyle),
            })
          }}
          className={slotSelectClass}
        >
          <option value="">Song</option>
          {PLAYBACK_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {style === 'strum' && (
        <select
          value={slot.strumPattern ?? ''}
          aria-label={`Strum pattern for ${slot.chordSymbol}`}
          onChange={(event) => {
            const value = event.target.value
            onChange({
              strumPattern: value === '' ? undefined : value,
            })
          }}
          className={`${slotSelectClass} w-full flex-none`}
        >
          <option value="">
            Song · {formatStrumPattern(songPattern ?? DEFAULT_STRUM_PATTERN)}
          </option>
          {STRUM_PATTERNS.map((pattern) => (
            <option key={pattern.id} value={pattern.id} title={pattern.hint}>
              {pattern.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

function sectionMeta(song: Song): string {
  const sections = song.sections.length
  const measures = song.sections.reduce((n, section) => n + section.bars.length, 0)
  return `${sections} section${sections === 1 ? '' : 's'} · ${measures} measure${
    measures === 1 ? '' : 's'
  }`
}

function MeasureStepsControl({
  steps,
  measureId,
  measureIndex,
  onChange,
}: {
  steps: number
  measureId: string
  measureIndex: number
  onChange: (steps: number) => void
}) {
  const commit = (raw: string) => {
    const next = Number(raw)
    if (Number.isFinite(next)) onChange(next)
  }

  return (
    <div className="flex items-center gap-1">
      <label
        className="text-[10px] font-semibold tracking-[0.12em] text-cosmos-500 uppercase"
        htmlFor={`measure-steps-${measureId}`}
      >
        Chords
      </label>
      <button
        type="button"
        aria-label={`Fewer chords in measure ${measureIndex + 1}`}
        disabled={steps <= MIN_STEPS_PER_MEASURE}
        onClick={() => onChange(steps - 1)}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-cosmos-700 text-xs text-cosmos-300 transition hover:border-nebula-500 hover:text-white disabled:opacity-30"
      >
        −
      </button>
      <input
        key={steps}
        id={`measure-steps-${measureId}`}
        type="number"
        min={MIN_STEPS_PER_MEASURE}
        max={MAX_STEPS_PER_MEASURE}
        defaultValue={steps}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        aria-label={`Chords in measure ${measureIndex + 1}`}
        className="w-12 rounded-md border border-cosmos-700 bg-cosmos-850 px-1 py-0.5 text-center text-xs tabular-nums text-white outline-none focus:border-nebula-500"
      />
      <button
        type="button"
        aria-label={`More chords in measure ${measureIndex + 1}`}
        disabled={steps >= MAX_STEPS_PER_MEASURE}
        onClick={() => onChange(steps + 1)}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-cosmos-700 text-xs text-cosmos-300 transition hover:border-nebula-500 hover:text-white disabled:opacity-30"
      >
        +
      </button>
    </div>
  )
}

function stepGridClass(steps: number): string {
  if (steps <= 1) return 'grid-cols-1'
  if (steps <= 8) return 'grid-cols-2'
  return 'grid-cols-2 sm:grid-cols-4'
}

function slotMinHeight(_steps: number): string {
  return 'min-h-[200px]'
}

function diagramAreaMinHeight(_steps: number): string {
  return 'min-h-[132px]'
}

function diagramSizeForSteps(_steps: number): DiagramSize {
  return 'md'
}

function shortInversion(inversion: number): string {
  return (
    ['root', '1st', '2nd', '3rd'][inversion] ?? inversionOrdinal(inversion)
  )
}
