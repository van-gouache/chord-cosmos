import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { playArrangement, playBeat, stopAll } from '../audio/player'
import {
  MAX_LINE_RECORD_SECONDS,
  playLineAudio,
  startLineRecording,
  stopLineAudio,
  type LineRecorder,
} from '../audio/lineAudio'
import { AudioInputSelect } from './AudioInputSelect'
import { CircleOfFifths } from './CircleOfFifths'
import {
  cellPc,
  nearestEmptyCell,
  suggestForwardTargets,
} from '../theory/betweenTargets'
import { displayChordSymbol, tryParseChord, type ParsedChord } from '../theory/chords'
import { TargetNoteChips } from './TargetNoteChips'
import { LickOutlineChart } from './LickOutlineChart'
import { lickOutlineNotes } from '../theory/lickOutline'
import {
  DEFAULT_STRUM_PATTERN,
  MAX_BPM,
  MAX_SLOT_BEATS,
  MAX_STEPS_PER_MEASURE,
  MIN_BPM,
  MIN_SLOT_BEATS,
  MIN_STEPS_PER_MEASURE,
  barLabel,
  barSteps,
  exportSong,
  formatStrumPattern,
  hydrateSlot,
  firstEmptyInBar,
  barAt,
  locationKey,
  locationsEqual,
  nextFilledChordMap,
  playTimeline,
  slotBeats,
  slotMidiNotes,
  slotPlayback,
  slotStrumPattern,
  STRUM_PATTERNS,
  type PlaybackStyle,
  type SequenceSlot,
  type SlotLocation,
  type Song,
  type Bar,
} from '../state/songs'
import { incomingVoicingFrom, isVoicingDrag } from './voicingDrag'
import { ProgressionBuilder } from './ProgressionBuilder'
import { OctaveSelect } from './OctaveShiftButtons'
import type { KeyCenter, ModeId, ProgressionStep } from '../theory/diatonic'
import { DEFAULT_MODE, romanBadge, romanForChord } from '../theory/diatonic'
import type { Fingering } from '../theory/fretboard'
import type { VoicingShape } from '../theory/vsystem'
import { inversionOrdinal } from '../theory/voicings'
import { isLineGroupId } from '../theory/lineOutline'
import { ChordDiagram, type DiagramSize } from './ChordDiagram'
import { diagramFretWindow } from './fretWindow'
import { SongManager } from './SongManager'
import { NotebookStyleSwitch, NotebookView } from './NotebookView'
import type { NotebookStyle } from '../state/notebook'

const DRAG_MIME = 'application/x-chord-slot'
const MEASURE_DRAG_MIME = 'application/x-chord-measure'
const BPM_PRESETS = [60, 80, 90, 120, 160]
const PLAYBACK_OPTIONS: { id: PlaybackStyle; label: string }[] = [
  { id: 'strum', label: 'Strum' },
  { id: 'arp-up', label: 'Arp ↑' },
  { id: 'arp-down', label: 'Arp ↓' },
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
  onInsertSlot: (location: SlotLocation, side: 'before' | 'after') => void
  onRemoveStep: (location: SlotLocation) => void
  onMoveSlot: (from: SlotLocation, to: SlotLocation) => void
  onPlaceIncoming: (location: SlotLocation, slot: SequenceSlot) => void
  onDuplicateSlot: (location: SlotLocation) => void
  onSetSlotNote: (location: SlotLocation, note: string) => void
  onSetSlotBeats: (location: SlotLocation, beats: number) => void
  onSetSlotPlayback: (location: SlotLocation, playback: PlaybackStyle) => void
  onSetSlotStrumPattern: (location: SlotLocation, pattern: string | undefined) => void
  onSetLineAudio: (
    location: SlotLocation,
    audio: SequenceSlot['lineAudio'] | undefined
  ) => void
  audioInputId: string
  onAudioInputIdChange: (deviceId: string) => void
  onToggleHighlight: (
    location: SlotLocation,
    note: { string: number; fret: number }
  ) => void
  onExtendFrets: (
    location: SlotLocation,
    edge: 'low' | 'high',
    delta: number
  ) => void
  onShiftSlotOctave: (location: SlotLocation, deltaFrets: number) => void
  onAddGroup: (sectionId: string) => void
  onDuplicateGroup: (sectionId: string, measureId: string) => void
  onMoveGroup: (
    from: { sectionId: string; barId: string },
    to: { sectionId: string; beforeBarId?: string | null }
  ) => void
  onRemoveGroup: (sectionId: string, measureId: string) => void
  onAddSection: () => void
  onDuplicateSection: (sectionId: string) => void
  onSetSectionCollapsed: (sectionId: string, collapsed: boolean) => void
  onSetBarCollapsed: (barId: string, collapsed: boolean) => void
  onRenameGroup: (barId: string, name: string) => void
  onRenameSection: (sectionId: string, name: string) => void
  onSetSectionNote: (sectionId: string, note: string) => void
  onRemoveSection: (sectionId: string) => void
  onSetBpm: (bpm: number) => void
  onSetGroupSteps: (barId: string, steps: number) => void
  onSetBarHarmony: (
    barId: string,
    harmony: { keyRoot: KeyCenter | null; mode?: ModeId }
  ) => void
  onPickProgressionStep: (
    location: SlotLocation | null,
    step: ProgressionStep
  ) => void
  pendingProgression?: {
    location: SlotLocation
    stepId: string
    roman: string
    symbol: string
  } | null
  onClear: () => void
  selected: SlotLocation | null
  onSelectSlot: (location: SlotLocation | null) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  showForwardTargets?: boolean
  showLickOutline?: boolean
  showCircleOfFifths?: boolean
  onPlayingLocationChange?: (location: SlotLocation | null) => void
  notebookMode?: boolean
  notebookStyle?: NotebookStyle
  toolbarCollapsed?: boolean
  onToggleToolbar?: () => void
  onToggleNotebook?: () => void
  onNotebookStyleChange?: (style: NotebookStyle) => void
  workshopChordSymbol?: string
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
  onInsertSlot,
  onRemoveStep,
  onMoveSlot,
  onPlaceIncoming,
  onDuplicateSlot,
  onSetSlotNote,
  onSetSlotBeats,
  onSetSlotPlayback,
  onSetSlotStrumPattern,
  onSetLineAudio,
  audioInputId,
  onAudioInputIdChange,
  onToggleHighlight,
  onExtendFrets,
  onShiftSlotOctave,
  onAddGroup,
  onDuplicateGroup,
  onMoveGroup,
  onRemoveGroup,
  onAddSection,
  onDuplicateSection,
  onSetSectionCollapsed,
  onSetBarCollapsed,
  onRenameGroup,
  onRenameSection,
  onSetSectionNote,
  onRemoveSection,
  onSetBpm,
  onSetGroupSteps,
  onSetBarHarmony,
  onPickProgressionStep,
  pendingProgression = null,
  onClear,
  selected,
  onSelectSlot,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  showForwardTargets = true,
  showLickOutline = false,
  showCircleOfFifths = false,
  onPlayingLocationChange,
  notebookMode = false,
  notebookStyle = 'cream',
  toolbarCollapsed = false,
  onToggleToolbar,
  onToggleNotebook,
  onNotebookStyleChange,
  workshopChordSymbol,
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
  const [copied, setCopied] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const [recordingAt, setRecordingAt] = useState<SlotLocation | null>(null)
  const [recordError, setRecordError] = useState<string | null>(null)
  const recorderRef = useRef<LineRecorder | null>(null)
  const recordingAtRef = useRef<SlotLocation | null>(null)
  const recordTimerRef = useRef<number | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const playingCellRef = useRef<HTMLElement | null>(null)
  const bindPlayingCell = (el: HTMLElement | null) => {
    playingCellRef.current = el
  }

  const timeline = useMemo(() => (song ? playTimeline(song) : []), [song])
  const playingLocation =
    playingIndex !== null ? (timeline[playingIndex]?.location ?? null) : null

  useEffect(() => {
    onPlayingLocationChange?.(playingLocation)
  }, [onPlayingLocationChange, playingLocation])

  const nextByLocation = useMemo(
    () => (song ? nextFilledChordMap(song) : new Map<string, ParsedChord>()),
    [song]
  )

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
      const fingering = hydratedById.get(event.slot.id)?.fingering ?? null
      return slotMidiNotes(event.slot, fingering)
    })
  }, [hydratedById, timeline])

  useEffect(() => {
    return () => {
      stopRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (!notebookMode || managerOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.fullscreenElement) return
      event.preventDefault()
      onToggleNotebook?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [notebookMode, managerOpen, onToggleNotebook])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const action = undoRedoAction(event)
      if (!action) return
      if (action === 'undo' && canUndo) {
        event.preventDefault()
        onUndo()
      } else if (action === 'redo' && canRedo) {
        event.preventDefault()
        onRedo()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [canRedo, canUndo, onRedo, onUndo])

  const stop = useCallback(() => {
    stopRef.current?.()
    stopRef.current = null
    setIsPlaying(false)
    setPlayingIndex(null)
    stopAll()
    stopLineAudio()
  }, [])

  const finishRecording = useCallback(
    async (save: boolean) => {
      const recorder = recorderRef.current
      const location = recordingAtRef.current
      recorderRef.current = null
      recordingAtRef.current = null
      if (recordTimerRef.current !== null) {
        window.clearTimeout(recordTimerRef.current)
        recordTimerRef.current = null
      }
      setRecordingAt(null)
      if (!recorder) return
      if (!save) {
        recorder.cancel()
        return
      }
      try {
        const clip = await recorder.stop()
        if (location) onSetLineAudio(location, clip)
      } catch (error) {
        setRecordError(
          error instanceof Error ? error.message : 'Could not save that take.'
        )
      }
    },
    [onSetLineAudio]
  )

  const startRecording = useCallback(
    async (location: SlotLocation) => {
      stop()
      await finishRecording(false)
      setRecordError(null)
      try {
        const recorder = await startLineRecording(audioInputId || undefined)
        recorderRef.current = recorder
        recordingAtRef.current = location
        setRecordingAt(location)
        recordTimerRef.current = window.setTimeout(() => {
          void finishRecording(true)
        }, MAX_LINE_RECORD_SECONDS * 1000)
      } catch {
        setRecordError('Could not start the microphone. Check Config → Audio input.')
      }
    },
    [audioInputId, finishRecording, stop]
  )

  useEffect(() => {
    return () => {
      recorderRef.current?.cancel()
      if (recordTimerRef.current !== null) {
        window.clearTimeout(recordTimerRef.current)
      }
    }
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
          style: slotPlayback(event.slot),
          strumPattern: slotStrumPattern(event.slot),
        })),
        {
          onBeat: (index) => {
            setPlayingIndex(startIndex + index)
            const clip = remaining[index]?.slot?.lineAudio
            if (clip) playLineAudio(clip)
          },
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
      onSelectSlot(to)
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
      onMoveGroup(dragMeasureFrom, to)
    }
    setDragMeasureFrom(null)
    setDropMeasureTarget(null)
  }

  const allowMeasureDrop = (event: {
    preventDefault: () => void
    dataTransfer: DataTransfer
  }) => {
    if (
      false ||
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
    if (false || isInteractiveDragTarget(event.target)) {
      event.preventDefault()
      return
    }
    if (isSlotDragTarget(event.target)) return
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

  useEffect(() => {
    if (!notebookMode || playingIndex === null) return
    playingCellRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
  }, [notebookMode, playingIndex])

  if (!song?.sections) return null

  const firstUnkeyedBarId = song.sections
    .flatMap((section) => section.bars)
    .find((group) => !group.keyRoot)?.id

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header
        className={`min-w-0 shrink-0 px-5 ${
          !notebookMode && toolbarCollapsed ? 'py-1.5' : 'pt-3 pb-3'
        }`}
      >
        {notebookMode ? (
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight text-white">
              {song.name}
            </h2>
            <div className="ml-auto flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={isPlaying ? stop : play}
                disabled={slotCount === 0}
                className="flex h-8 items-center rounded-lg bg-nebula-600 px-3.5 text-sm font-semibold text-white transition hover:bg-nebula-500 disabled:cursor-not-allowed disabled:bg-cosmos-800 disabled:text-cosmos-600"
              >
                {isPlaying ? '■ Stop' : '▶ Play'}
              </button>
              {onNotebookStyleChange && (
                <NotebookStyleSwitch
                  value={notebookStyle}
                  onChange={onNotebookStyleChange}
                />
              )}
              <button
                type="button"
                aria-pressed
                onClick={() => {
                  setManagerOpen(false)
                  onToggleNotebook?.()
                }}
                className="flex h-8 items-center rounded-lg border border-cosmos-700 px-3 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
              >
                Exit
              </button>
            </div>
          </div>
        ) : toolbarCollapsed ? (
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-expanded={false}
              onClick={onToggleToolbar}
              aria-label="Show the sequence toolbar"
              title="Show the toolbar"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-nebula-400/80 bg-nebula-600/30 px-2.5 py-1 text-xs font-semibold tracking-wide text-white shadow-[0_0_0_1px_rgba(79,108,255,0.25)] transition hover:border-nebula-300 hover:bg-nebula-500/50"
            >
              <span aria-hidden className="text-sm leading-none">
                ▾
              </span>
              Toolbar
            </button>
            <p className="min-w-0 flex-1 truncate text-sm text-cosmos-400">
              <span className="font-semibold text-white">{song.name}</span>
              {` · ${slotCount} chord${slotCount === 1 ? '' : 's'}`}
            </p>
            <button
              type="button"
              onClick={isPlaying ? stop : play}
              disabled={slotCount === 0}
              className="flex h-7 shrink-0 items-center rounded-lg bg-nebula-600 px-3 text-sm font-semibold text-white transition hover:bg-nebula-500 disabled:cursor-not-allowed disabled:bg-cosmos-800 disabled:text-cosmos-600"
            >
              {isPlaying ? '■ Stop' : '▶ Play'}
            </button>
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

            <div className="@container mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={isPlaying ? stop : play}
                disabled={slotCount === 0}
                className="flex h-8 shrink-0 items-center rounded-lg bg-nebula-600 px-3.5 text-sm font-semibold text-white transition hover:bg-nebula-500 disabled:cursor-not-allowed disabled:bg-cosmos-800 disabled:text-cosmos-600"
              >
                {isPlaying ? '■ Stop' : '▶ Play'}
              </button>
              <div
                className="flex h-8 shrink-0 items-center rounded-lg border border-cosmos-700 p-0.5"
                role="group"
                aria-label="Undo and redo"
              >
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  title={`Undo ${UNDO_SHORTCUT.undo}`}
                  aria-label="Undo"
                  className="flex h-7 items-center rounded-md px-2.5 text-sm text-cosmos-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={onRedo}
                  disabled={!canRedo}
                  title={`Redo ${UNDO_SHORTCUT.redo}`}
                  aria-label="Redo"
                  className="flex h-7 items-center rounded-md px-2.5 text-sm text-cosmos-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Redo
                </button>
              </div>
              <TempoControl bpm={song.bpm} onChange={onSetBpm} />
              <button
                type="button"
                onClick={copy}
                disabled={slotCount === 0}
                title="Copy the sequence as text"
                className="flex h-8 shrink-0 items-center rounded-lg border border-cosmos-700 px-3 text-sm text-cosmos-300 transition hover:border-star-400 hover:text-star-300 disabled:opacity-40"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              {slotCount > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="flex h-8 shrink-0 items-center px-2 text-sm text-cosmos-400 transition hover:text-red-400"
                >
                  Clear
                </button>
              )}
              {onToggleNotebook && (
                <button
                  type="button"
                  aria-pressed={notebookMode}
                  onClick={() => {
                  setManagerOpen(false)
                  onToggleNotebook()
                  }}
                  className="flex h-8 shrink-0 items-center rounded-lg border border-cosmos-700 px-3 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
                >
                  Notebook
                </button>
              )}
              {onToggleToolbar && (
                <button
                  type="button"
                  aria-expanded
                  onClick={onToggleToolbar}
                  aria-label="Hide the sequence toolbar"
                  title="Hide the toolbar for a taller sequence view"
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-cosmos-700 px-3 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
                >
                  <span aria-hidden className="text-xs leading-none">
                    ▴
                  </span>
                  Collapse
                </button>
              )}
            </div>
          </>
        )}
      </header>

      <SongManager
        key={managerOpen ? 'open' : 'closed'}
        open={!notebookMode && managerOpen}
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
          notebookMode
            ? 'min-h-0 flex-1 overflow-y-auto px-4 pb-5'
            : 'min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-5'
        }
      >
        {notebookMode ? (
          <NotebookView
            song={song}
            style={notebookStyle}
            selected={selected}
            playingLocation={playingLocation}
            playingCellRef={bindPlayingCell}
            onSelect={onSelectSlot}
            onPreview={(location, slot) => {
              if (slot.lineAudio) {
                playLineAudio(slot.lineAudio)
                return
              }
              const eventIndex = timeline.findIndex(
                (event) =>
                  event.location !== null &&
                  locationsEqual(event.location, location)
              )
              const notes = midiByIndex[eventIndex]
              if (!notes) return
              playBeat(notes, {
                style: slotPlayback(slot),
                seconds: timeline[eventIndex]?.seconds ?? 1.2,
                strumPattern: slotStrumPattern(slot),
              })
            }}
            onPlayFromSection={playFromSection}
          />
        ) : (
          <>
        {song.sections.map((section, sectionIndex) => {
          const sectionStart = timeline.findIndex(
            (event) => event.location?.sectionId === section.id
          )
          const canPlayFromSection =
            sectionStart >= 0 &&
            timeline.slice(sectionStart).some((event) => event.slot)
          return (
          <div key={section.id}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onSetSectionCollapsed(section.id, !section.collapsed)
                    }
                    aria-expanded={!section.collapsed}
                    aria-label={
                      section.collapsed
                        ? `Expand section ${section.name}`
                        : `Collapse section ${section.name}`
                    }
                    title={section.collapsed ? 'Expand section' : 'Collapse section'}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-nebula-400/80 bg-nebula-600/30 px-2.5 py-1 text-xs font-semibold tracking-wide text-white shadow-[0_0_0_1px_rgba(79,108,255,0.25)] transition hover:border-nebula-300 hover:bg-nebula-500/50"
                  >
                    <span aria-hidden className="text-sm leading-none">
                      {section.collapsed ? '▸' : '▾'}
                    </span>
                    {section.collapsed ? 'Expand' : 'Collapse'}
                  </button>
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
                {section.collapsed && (
                  <span className="text-[11px] text-cosmos-500">
                    {section.bars.length}{' '}
                    {section.bars.length === 1 ? 'group' : 'groups'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onDuplicateSection(section.id)}
                  aria-label={`Copy section ${section.name}`}
                  title={`Copy section ${section.name}`}
                  className="rounded-lg px-2 py-1 text-xs text-cosmos-400 transition hover:text-white"
                >
                  ⧉
                </button>
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

            {!section.collapsed && (
            <div className="flex flex-wrap items-stretch gap-3">
              {section.bars.map((bar, barIndex) => {
                const steps = barSteps(bar)
                const canInsertInBar =
                  bar.slots[bar.slots.length - 1] === null ||
                  bar.slots.length < MAX_STEPS_PER_MEASURE
                const showMeasureLabel =
                  !false ||
                  song.sections.some((item) => item.bars.length > 1) ||
                  song.sections.length > 1
                const visibleSlots = false
                  ? bar.slots
                      .map((slot, slotIndex) => ({ slot, slotIndex }))
                      .filter((item) => item.slot)
                  : bar.slots.map((slot, slotIndex) => ({ slot, slotIndex }))
                const gridSteps = false ? visibleSlots.length : steps
                const measureStart = timeline.findIndex(
                  (event) => event.location?.barId === bar.id
                )
                const canPlayFromMeasure =
                  measureStart >= 0 &&
                  timeline.slice(measureStart).some((event) => event.slot)
                const shareRow = false && section.bars.length > 1
                const measureOverflowsRow =
                  shareRow && visibleSlots.length > 4
                const groupBasis = groupRowBasis(steps)
                return (
                <div
                  key={bar.id}
                  draggable={!false}
                  title={
                    false ? undefined : 'Drag onto another group to swap'
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
                  style={{
                    flex: `1 1 ${groupBasis}`,
                    minWidth: `min(100%, ${groupBasis})`,
                  }}
                  className={
                    false
                      ? `min-w-0 ${measureOverflowsRow ? 'col-span-full' : ''}`
                      : `max-w-full select-none rounded-xl border bg-cosmos-900/60 p-2.5 transition ${
                          dragMeasureFrom?.barId === bar.id
                            ? 'border-cosmos-600 opacity-45'
                            : dropMeasureTarget?.beforeBarId === bar.id
                              ? 'border-nebula-400 bg-nebula-500/10'
                              : 'border-cosmos-700/70'
                        }`
                  }
                >
                  {(showMeasureLabel || !false) && (
                    <div
                      className={
                        false
                          ? 'mb-2 flex flex-wrap items-center justify-between gap-2'
                          : 'mb-2 flex cursor-grab flex-wrap items-center justify-between gap-2 active:cursor-grabbing'
                      }
                    >
                      {showMeasureLabel && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation()
                              onSetBarCollapsed(bar.id, !bar.collapsed)
                            }}
                            aria-expanded={!bar.collapsed}
                            aria-label={
                              bar.collapsed
                                ? `Expand ${barLabel(bar, barIndex)}`
                                : `Collapse ${barLabel(bar, barIndex)}`
                            }
                            title={
                              bar.collapsed
                                ? `Expand ${barLabel(bar, barIndex)}`
                                : `Collapse ${barLabel(bar, barIndex)}`
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-nebula-400/80 bg-nebula-600/30 px-2.5 py-1 text-xs font-semibold tracking-wide text-white shadow-[0_0_0_1px_rgba(79,108,255,0.25)] transition hover:border-nebula-300 hover:bg-nebula-500/50"
                          >
                            <span aria-hidden className="text-sm leading-none">
                              {bar.collapsed ? '▸' : '▾'}
                            </span>
                            {bar.collapsed ? 'Expand' : 'Collapse'}
                          </button>
                          {!false && (
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
                          <input
                            value={bar.name ?? ''}
                            placeholder={`Group ${barIndex + 1}`}
                            onChange={(event) =>
                              onRenameGroup(bar.id, event.target.value)
                            }
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Group ${barIndex + 1} name`}
                            className="w-32 rounded-md border border-cosmos-700 bg-cosmos-900 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-white outline-none placeholder:text-cosmos-500 focus:border-nebula-500"
                          />
                          {canPlayFromMeasure && (
                            <button
                              type="button"
                              onClick={() => playFromMeasure(bar.id)}
                              aria-label={`Play from ${barLabel(bar, barIndex)}`}
                              title={`Play from ${barLabel(bar, barIndex)}`}
                              className="rounded-md px-1.5 py-0.5 text-[11px] text-cosmos-400 transition hover:bg-nebula-600/20 hover:text-white"
                            >
                              ▶
                            </button>
                          )}
                        </div>
                      )}
                      {!false && (
                        <div className="flex items-center gap-1.5">
                          <MeasureStepsControl
                            steps={steps}
                            measureId={bar.id}
                            groupLabel={barLabel(bar, barIndex)}
                            onChange={(next) => onSetGroupSteps(bar.id, next)}
                          />
                          <button
                            type="button"
                            onClick={() => onDuplicateGroup(section.id, bar.id)}
                            aria-label={`Copy ${barLabel(bar, barIndex)}`}
                            title={`Copy ${barLabel(bar, barIndex)}`}
                            className="ml-1 text-[11px] text-cosmos-400 transition hover:text-white"
                          >
                            ⧉
                          </button>
                          {section.bars.length > 1 && (
                            <button
                              type="button"
                              onClick={() => onRemoveGroup(section.id, bar.id)}
                              aria-label={`Remove ${barLabel(bar, barIndex)}`}
                              className="text-[11px] text-cosmos-500 transition hover:text-red-400"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {bar.collapsed && (
                    <p className="truncate px-0.5 text-[11px] text-cosmos-500">
                      {groupChordSummary(bar)}
                    </p>
                  )}
                  {!bar.collapsed && (
                    <>
                    <ProgressionBuilder
                      keyRoot={bar.keyRoot}
                      mode={bar.mode}
                      chordSymbols={keyHintSymbols(
                        bar,
                        selected?.barId === bar.id ||
                          (!selected && bar.id === firstUnkeyedBarId)
                          ? workshopChordSymbol
                          : undefined,
                      )}
                      selectedId={
                        pendingProgression?.location.barId === bar.id
                          ? pendingProgression.stepId
                          : null
                      }
                      onHarmonyChange={(harmony) =>
                        onSetBarHarmony(bar.id, harmony)
                      }
                      onPickStep={(step) => {
                        if (!song) return
                        const inThisBar =
                          selected?.barId === bar.id &&
                          selected.sectionId === section.id
                        const selectedEmpty =
                          inThisBar &&
                          selected &&
                          bar.slots[selected.slotIndex] === null
                            ? selected
                            : null
                        const target =
                          selectedEmpty ??
                          firstEmptyInBar(song, section.id, bar.id)
                        onPickProgressionStep(target, step)
                      }}
                    />
                    {showCircleOfFifths && bar.keyRoot ? (
                      <div className="mb-2 rounded-lg border border-cosmos-800/80 bg-cosmos-950/50 p-1.5">
                        <CircleOfFifths
                          keyRoot={bar.keyRoot}
                          chordRootName={
                            circleChordRoot(
                              bar,
                              selected,
                              playingLocation,
                              song,
                            ) ??
                            undefined
                          }
                        />
                      </div>
                    ) : null}
                  <div
                    className={`grid ${
                      false
                        ? shareRow && !measureOverflowsRow
                          ? 'justify-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,14rem),14rem))]'
                          : 'justify-start gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),22rem))]'
                        : 'gap-2'
                    }`}
                    style={
                      false
                        ? undefined
                        : {
                            gridTemplateColumns: `repeat(auto-fit, minmax(${SEQUENCER_SLOT_MIN}, 1fr))`,
                          }
                    }
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
                          nextChord={nextByLocation.get(locationKey(location)) ?? null}
                          showForwardTargets={showForwardTargets}
                          showLickOutline={showLickOutline}
                          slot={slot}
                          fingering={
                            slot ? (hydratedById.get(slot.id)?.fingering ?? null) : null
                          }
                          shape={slot ? (hydratedById.get(slot.id)?.shape ?? null) : null}
                          diagramSize={
                            false ? 'present' : diagramSizeForSteps(steps)
                          }
                          steps={false ? Math.max(1, gridSteps) : steps}
                          presenting={false}
                          measureDragging={Boolean(dragMeasureFrom)}
                          isPlaying={isPlaying}
                          isSelected={!false && isSelected}
                          isDrop={!false && isDrop}
                          isDragSource={!false && isDragSource}
                          cellRef={isPlaying ? bindPlayingCell : undefined}
                          onSelect={() => {
                            onSelectSlot(location)
                          }}
                          onPreview={() => {
                            if (!slot) return
                            const notes = midiByIndex[eventIndex]
                            if (!notes) return
                            playBeat(notes, {
                              style: slotPlayback(slot),
                              seconds: timeline[eventIndex]?.seconds ?? 1.2,
                              strumPattern: slotStrumPattern(slot),
                            })
                          }}
                          onRemove={() => onRemoveSlot(location)}
                          canInsert={canInsertInBar}
                          onInsert={(side) => onInsertSlot(location, side)}
                          onRemoveStep={() => onRemoveStep(location)}
                          onDuplicate={() => onDuplicateSlot(location)}
                          onNoteChange={(note) => onSetSlotNote(location, note)}
                          onBeatsChange={(beats) => onSetSlotBeats(location, beats)}
                          onPlaybackChange={(playback) =>
                            onSetSlotPlayback(location, playback)
                          }
                          onStrumPatternChange={(pattern) =>
                            onSetSlotStrumPattern(location, pattern)
                          }
                          recording={
                            recordingAt !== null &&
                            locationsEqual(recordingAt, location)
                          }
                          recordError={
                            recordingAt !== null &&
                            locationsEqual(recordingAt, location)
                              ? recordError
                              : selected !== null &&
                                  locationsEqual(selected, location)
                                ? recordError
                                : null
                          }
                          audioInputId={audioInputId}
                          onAudioInputIdChange={onAudioInputIdChange}
                          onStartRecord={() => void startRecording(location)}
                          onStopRecord={() => void finishRecording(true)}
                          onPlayClip={() => {
                            if (slot?.lineAudio) playLineAudio(slot.lineAudio)
                          }}
                          onClearClip={() => onSetLineAudio(location, undefined)}
                          onToggleHighlight={(note) =>
                            onToggleHighlight(location, note)
                          }
                          onExtendFrets={(edge, delta) =>
                            onExtendFrets(location, edge, delta)
                          }
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
                              onSelectSlot(location)
                              setDragFrom(null)
                              setDropTarget(null)
                              return
                            }
                            dropOn(location)
                          }}
                          keyRoot={bar.keyRoot}
                          mode={bar.mode}
                          pendingLabel={
                            pendingProgression &&
                            locationsEqual(pendingProgression.location, location)
                              ? pendingProgression.roman
                              : null
                          }
                        />
                      )
                    })}
                  </div>
                    </>
                  )}
                </div>
                )
              })}
              {!false && (
                <button
                  type="button"
                  onClick={() => onAddGroup(section.id)}
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
                  aria-label={`Add group ${section.bars.length + 1}`}
                  className={`flex min-h-[240px] min-w-[min(100%,10rem)] flex-[1_1_12rem] flex-col items-center justify-center rounded-xl border border-dashed bg-cosmos-900/30 text-cosmos-400 transition ${
                    dropMeasureTarget?.sectionId === section.id &&
                    dropMeasureTarget.beforeBarId === null
                      ? 'border-nebula-400 bg-nebula-500/10 text-white'
                      : 'border-cosmos-700 hover:border-nebula-500 hover:bg-nebula-500/5 hover:text-white'
                  }`}
                >
                  <span className="text-[11px] font-semibold tracking-wide uppercase">
                    Group {section.bars.length + 1}
                  </span>
                  <span className="mt-2 text-sm">+ Add group</span>
                </button>
              )}
            </div>
            )}
          </div>
          )
        })}

        {!false && (
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
            {false
              ? 'This sequence has no chords yet.'
              : `Add a voicing to the highlighted step, or the next empty one. Each group can hold up to ${MAX_STEPS_PER_MEASURE} chords.`}
          </p>
        )}
          </>
        )}
      </div>
    </section>
  )
}

interface SlotCellProps {
  location: SlotLocation
  nextChord: ParsedChord | null
  showForwardTargets: boolean
  showLickOutline: boolean
  slot: Song['sections'][number]['bars'][number]['slots'][number]
  fingering: Fingering | null
  shape: VoicingShape | null
  diagramSize: DiagramSize
  steps: number
  presenting: boolean
  measureDragging?: boolean
  isPlaying: boolean
  isSelected: boolean
  isDrop: boolean
  isDragSource: boolean
  cellRef?: (el: HTMLElement | null) => void
  onSelect: () => void
  onPreview: () => void
  onRemove: () => void
  canInsert: boolean
  onInsert: (side: 'before' | 'after') => void
  onRemoveStep: () => void
  onDuplicate: () => void
  onNoteChange: (note: string) => void
  onBeatsChange: (beats: number) => void
  onPlaybackChange: (playback: PlaybackStyle) => void
  onStrumPatternChange: (pattern: string | undefined) => void
  recording?: boolean
  recordError?: string | null
  audioInputId: string
  onAudioInputIdChange: (deviceId: string) => void
  onStartRecord: () => void
  onStopRecord: () => void
  onPlayClip: () => void
  onClearClip: () => void
  onToggleHighlight: (note: { string: number; fret: number }) => void
  onExtendFrets: (edge: 'low' | 'high', delta: number) => void
  onOctaveShift: (deltaFrets: number) => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: () => void
  onDrop: (event: { dataTransfer: DataTransfer }) => void
  pendingLabel?: string | null
  keyRoot?: KeyCenter
  mode?: ModeId
}

function SlotCell({
  location,
  nextChord,
  showForwardTargets,
  showLickOutline,
  slot,
  fingering,
  shape,
  diagramSize,
  steps,
  presenting,
  measureDragging = false,
  isPlaying,
  isSelected,
  isDrop,
  isDragSource,
  cellRef,
  onSelect,
  onPreview,
  onRemove,
  canInsert,
  onInsert,
  onRemoveStep,
  onDuplicate,
  onNoteChange,
  onBeatsChange,
  onPlaybackChange,
  onStrumPatternChange,
  recording = false,
  recordError = null,
  audioInputId,
  onAudioInputIdChange,
  onStartRecord,
  onStopRecord,
  onPlayClip,
  onClearClip,
  onToggleHighlight,
  onExtendFrets,
  onOctaveShift,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  pendingLabel = null,
  keyRoot,
  mode,
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

  const isLine = Boolean(slot && isLineGroupId(slot.groupId))
  const fretBox =
    slot && fingering
      ? diagramFretWindow(fingering, {
          highlightedFrets: (isLine
            ? slot.lineNotes
            : slot.highlightedNotes
          )?.map((note) => note.fret),
          extendLow: slot.extendLow,
          extendHigh: slot.extendHigh,
          ...(isLine ? { tightHighlights: true, minRows: 1 } : {}),
        })
      : null
  const chordName = slot
    ? isLine
      ? 'Line'
      : displayChordSymbol(slot.chordSymbol)
    : ''
  const chordParts = slot && !isLine ? splitChordDisplay(slot.chordSymbol) : null
  const currentChord = slot && !isLine
    ? tryParseChord(slot.chordSymbol).chord
    : null
  const targetTones =
    showForwardTargets && currentChord && nextChord
      ? suggestForwardTargets(currentChord, nextChord)
      : []
  const targetCells =
    fingering && fretBox
      ? new Map(
          targetTones.flatMap((target) => {
            const cell = nearestEmptyCell(target.pc, fingering, fretBox)
            return cell ? [[target.pc, cell] as const] : []
          })
        )
      : new Map<number, { string: number; fret: number }>()
  const outlinedPcs = new Set(
    (slot?.highlightedNotes ?? []).map((note) => cellPc(note))
  )
  const lickNotes =
    showLickOutline && !isLine && fingering && currentChord
      ? lickOutlineNotes(fingering, currentChord)
      : []
  const romanLabel =
    slot && !isLine
      ? romanForChord(slot.chordSymbol, keyRoot, mode ?? DEFAULT_MODE)
      : undefined

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
        if (
          presenting ||
          !slot ||
          isInteractiveDragTarget(event.target) ||
          event.currentTarget.dataset.dragLocked === '1'
        ) {
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
      className={`relative flex ${presenting ? '' : slotMinHeight(steps)} flex-col rounded-xl border transition ${
        presenting ? 'p-4' : 'min-w-[14rem] p-2'
      } ${
        isPlaying
          ? 'border-star-400 bg-star-400/15'
          : recording
            ? 'border-rose-400 bg-rose-400/10'
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
      {!presenting && (
        <RemoveStepButton
          target={slot ? chordName : 'this empty step'}
          onRemoveStep={onRemoveStep}
          onDragEnter={allowDrop}
          onDragOver={allowDrop}
          onDrop={handleDrop}
        />
      )}
      {slot ? (
        <>
          {romanLabel ? (
            <span
              title={romanLabel}
              className="pointer-events-none absolute top-1.5 left-2 z-10 max-w-[46%] truncate text-xs font-semibold tracking-wide text-nebula-300"
            >
              {romanBadge(romanLabel)}
            </span>
          ) : null}
          {!presenting && (
            <InsertSlotButtons
              chordName={chordName}
              canInsert={canInsert}
              onInsert={onInsert}
              onDragEnter={allowDrop}
              onDragOver={allowDrop}
              onDrop={handleDrop}
            />
          )}
          <div
            className={`flex ${presenting ? '' : diagramAreaMinHeight(steps)} flex-1 flex-col items-center justify-center text-cosmos-200`}
          >
            {!presenting && fretBox && (
              <FretExtendButtons
                chordSymbol={chordName}
                edge="low"
                canPlus={fretBox.canExtendLow}
                canMinus={(slot.extendLow ?? 0) > 0}
                onAdjust={(delta) => onExtendFrets('low', delta)}
              />
            )}
            <div className="pointer-events-none flex w-full items-center justify-center">
              {fingering && shape ? (
                <ChordDiagram
                  fingering={fingering}
                  shape={shape}
                  size={diagramSize}
                  showDegrees
                  kind={isLine ? 'line' : 'chord'}
                  highlightedNotes={
                    isLine ? slot.lineNotes : slot.highlightedNotes
                  }
                  extendLow={slot.extendLow}
                  extendHigh={slot.extendHigh}
                  onToggleNote={presenting ? undefined : onToggleHighlight}
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
            {!presenting && lickNotes.length > 0 && fingering && (
              <div className="pointer-events-none mt-2 w-full border-t border-cosmos-700/50 pt-2">
                <LickOutlineChart fingering={fingering} notes={lickNotes} />
              </div>
            )}
            {!presenting && fretBox && (
              <FretExtendButtons
                chordSymbol={chordName}
                edge="high"
                canPlus={fretBox.canExtendHigh}
                canMinus={(slot.extendHigh ?? 0) > 0}
                onAdjust={(delta) => onExtendFrets('high', delta)}
              />
            )}
            {!presenting && targetTones.length > 0 && (
              <div
                className="pointer-events-auto w-full"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <TargetNoteChips
                  compact
                  heading={`New in ${nextChord?.symbol ?? 'next'}`}
                  targets={targetTones}
                  activePcs={outlinedPcs}
                  availablePcs={new Set(targetCells.keys())}
                  onPick={(target) => {
                    const cell = targetCells.get(target.pc)
                    if (cell) onToggleHighlight(cell)
                  }}
                />
              </div>
            )}
          </div>
          {presenting ? (
            <div className="mt-2 text-center">
              <p className="text-xl leading-tight font-bold text-white [overflow-wrap:anywhere]">
                <ChordNameText parts={chordParts} fallback={chordName} />
              </p>
              <p className="mt-0.5 truncate text-sm text-nebula-400">
                {slotVoicingLabel(slot)}
                {slotPlayback(slot) !== 'strum'
                  ? ` · ${playbackLabel(slotPlayback(slot))}`
                  : slotStrumPattern(slot) !== DEFAULT_STRUM_PATTERN
                    ? ` · ${formatStrumPattern(slotStrumPattern(slot))}`
                    : ''}
                {` · ${slotBeats(slot)} beat${slotBeats(slot) === 1 ? '' : 's'}`}
                {slot.note.trim() ? ` · ${slot.note}` : ''}
              </p>
            </div>
          ) : (
            <>
              <div className="mt-2 flex items-start justify-between gap-2">
                <div className="pointer-events-none min-w-min">
                  <p className="text-sm leading-tight font-bold whitespace-nowrap text-white">
                    <ChordNameText
                      parts={chordParts}
                      fallback={chordName}
                      nowrap
                    />
                  </p>
                  <p className="mt-0.5 truncate text-xs text-nebula-300">
                    {slotVoicingLabel(slot)}
                    {isLine && slot.lineAudio
                      ? ` · take ${slot.lineAudio.duration.toFixed(1)}s`
                      : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  {!isLine && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onPreview()
                      }}
                      onDragEnter={allowDrop}
                      onDragOver={allowDrop}
                      onDrop={handleDrop}
                      aria-label={`Hear ${chordName}`}
                      className={slotIconClass}
                    >
                      ▶
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDuplicate()
                    }}
                    onDragEnter={allowDrop}
                    onDragOver={allowDrop}
                    onDrop={handleDrop}
                    aria-label={`Duplicate ${chordName}`}
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
                    aria-label={`Remove ${chordName}`}
                    className={`${slotIconClass} hover:text-red-400`}
                  >
                    ✕
                  </button>
                </div>
              </div>
              {!isLine && (
                <SlotPlayControls
                  slot={slot}
                  fingering={fingering}
                  onBeatsChange={onBeatsChange}
                  onPlaybackChange={onPlaybackChange}
                  onStrumPatternChange={onStrumPatternChange}
                  onOctaveShift={onOctaveShift}
                  onDragEnter={allowDrop}
                  onDragOver={allowDrop}
                  onDrop={handleDrop}
                />
              )}
              {isLine && (
                <>
                  <div
                    className="mt-2"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onDragEnter={allowDrop}
                    onDragOver={allowDrop}
                    onDrop={handleDrop}
                  >
                    <SlotBeatsControl
                      beats={slotBeats(slot)}
                      chordName={chordName}
                      onChange={onBeatsChange}
                    />
                  </div>
                  <LineTakeControls
                  recording={recording}
                  hasClip={Boolean(slot.lineAudio)}
                  error={recordError}
                  audioInputId={audioInputId}
                  onAudioInputIdChange={onAudioInputIdChange}
                  onStartRecord={onStartRecord}
                  onStopRecord={onStopRecord}
                  onPlayClip={onPlayClip}
                  onClearClip={onClearClip}
                />
                </>
              )}
              <input
                value={slot.note}
                onChange={(e) => onNoteChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onDragEnter={allowDrop}
                onDragOver={allowDrop}
                onDrop={handleDrop}
                placeholder="Note"
                aria-label={`Note for ${chordName}`}
                className="mt-2 min-h-[2.25rem] w-full min-w-[7rem] rounded-lg border border-cosmos-700/70 bg-cosmos-950/60 px-2 py-1.5 text-xs text-cosmos-300 outline-none placeholder:text-cosmos-600 focus:border-nebula-500"
              />
            </>
          )}
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p
            className={`text-xs ${
              pendingLabel ? 'font-semibold text-nebula-300' : 'text-cosmos-600'
            }`}
          >
            {presenting ? '·' : pendingLabel ? pendingLabel : 'empty'}
          </p>
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

const UNDO_SHORTCUT = /Mac|iPhone|iPad/.test(
  typeof navigator === 'undefined' ? '' : navigator.platform
)
  ? { undo: '⌘Z', redo: '⇧⌘Z' }
  : { undo: 'Ctrl+Z', redo: 'Ctrl+Y' }

function undoRedoAction(event: KeyboardEvent): 'undo' | 'redo' | null {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && !event.shiftKey) return 'redo'
  return null
}

const slotSelectClass =
  'h-7 min-w-0 flex-1 rounded-md border border-cosmos-700 bg-cosmos-900 px-1.5 text-xs text-cosmos-100 outline-none focus:border-nebula-500'

const slotIconClass =
  'flex h-7 w-7 items-center justify-center rounded-md text-sm text-cosmos-400 transition hover:bg-cosmos-700 hover:text-white'

function TempoControl({
  bpm,
  onChange,
}: {
  bpm: number
  onChange: (bpm: number) => void
}) {
  return (
    <div className="flex h-8 min-w-0 max-w-full flex-1 basis-[12rem] items-center gap-2 overflow-hidden rounded-lg border border-cosmos-700 bg-cosmos-900 px-2.5">
      <label className="shrink-0 text-[10px] font-semibold tracking-[0.12em] text-cosmos-400 uppercase">
        Tempo
      </label>
      <input
        type="range"
        min={MIN_BPM}
        max={MAX_BPM}
        value={bpm}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Tempo"
        className="min-w-0 flex-1 accent-nebula-500"
      />
      <input
        type="number"
        min={MIN_BPM}
        max={MAX_BPM}
        value={bpm}
        onChange={(e) => {
          const next = Number(e.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
        aria-label="BPM"
        className="h-6 w-12 shrink-0 rounded-md border border-cosmos-700 bg-cosmos-850 px-1 text-center text-xs tabular-nums text-white outline-none focus:border-nebula-500"
      />
      <div className="hidden shrink-0 items-center @[34rem]:flex">
        {BPM_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={`h-6 rounded px-1.5 text-[11px] tabular-nums transition ${
              bpm === preset ? 'text-white' : 'text-cosmos-500 hover:text-white'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  )
}

type SlotDragHandler = (event: {
  preventDefault: () => void
  dataTransfer: DataTransfer
}) => void

function playbackLabel(playback: PlaybackStyle): string {
  return PLAYBACK_OPTIONS.find((option) => option.id === playback)?.label ?? 'Strum'
}

function SlotPlayControls({
  slot,
  fingering,
  onBeatsChange,
  onPlaybackChange,
  onStrumPatternChange,
  onOctaveShift,
  onDragEnter,
  onDragOver,
  onDrop,
}: {
  slot: SequenceSlot
  fingering: Fingering | null
  onBeatsChange: (beats: number) => void
  onPlaybackChange: (playback: PlaybackStyle) => void
  onStrumPatternChange: (pattern: string | undefined) => void
  onOctaveShift: (deltaFrets: number) => void
  onDragEnter: SlotDragHandler
  onDragOver: SlotDragHandler
  onDrop: (event: {
    preventDefault: () => void
    stopPropagation: () => void
    dataTransfer: DataTransfer
  }) => void
}) {
  const feel = slotPlayback(slot)
  return (
    <div
      className="mt-2 space-y-1.5"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-1.5">
        {fingering && (
          <OctaveSelect
            fingering={fingering}
            chordSymbol={displayChordSymbol(slot.chordSymbol)}
            onShift={onOctaveShift}
            className={slotSelectClass}
          />
        )}
        <select
          value={feel}
          aria-label={`Feel for ${displayChordSymbol(slot.chordSymbol)}`}
          onChange={(event) =>
            onPlaybackChange(event.target.value as PlaybackStyle)
          }
          className={slotSelectClass}
        >
          {PLAYBACK_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {feel === 'strum' && (
        <select
          value={slotStrumPattern(slot)}
          aria-label={`Strum pattern for ${displayChordSymbol(slot.chordSymbol)}`}
          onChange={(event) => {
            const value = event.target.value
            onStrumPatternChange(
              value === DEFAULT_STRUM_PATTERN ? undefined : value
            )
          }}
          className={`${slotSelectClass} w-full flex-none`}
        >
          {STRUM_PATTERNS.map((pattern) => (
            <option key={pattern.id} value={pattern.id} title={pattern.hint}>
              {pattern.label}
            </option>
          ))}
        </select>
      )}
      <SlotBeatsControl
        beats={slotBeats(slot)}
        chordName={displayChordSymbol(slot.chordSymbol)}
        onChange={onBeatsChange}
      />
    </div>
  )
}

function SlotBeatsControl({
  beats,
  chordName,
  onChange,
}: {
  beats: number
  chordName: string
  onChange: (beats: number) => void
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <label className="shrink-0 text-[10px] font-semibold tracking-[0.12em] text-cosmos-500 uppercase">
        Beats
      </label>
      <button
        type="button"
        aria-label={`Fewer beats for ${chordName}`}
        disabled={beats <= MIN_SLOT_BEATS}
        onClick={() => onChange(beats - 1)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-cosmos-700 text-xs text-cosmos-300 transition hover:border-nebula-500 hover:text-white disabled:opacity-30"
      >
        −
      </button>
      <input
        key={beats}
        type="number"
        min={MIN_SLOT_BEATS}
        max={MAX_SLOT_BEATS}
        defaultValue={beats}
        aria-label={`Beats for ${chordName}`}
        onBlur={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        className="h-6 w-8 rounded-md border border-cosmos-700 bg-cosmos-900 text-center text-xs tabular-nums text-white outline-none focus:border-nebula-500"
      />
      <button
        type="button"
        aria-label={`More beats for ${chordName}`}
        disabled={beats >= MAX_SLOT_BEATS}
        onClick={() => onChange(beats + 1)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-cosmos-700 text-xs text-cosmos-300 transition hover:border-nebula-500 hover:text-white disabled:opacity-30"
      >
        +
      </button>
    </div>
  )
}

function sectionMeta(song: Song): string {
  const sections = song.sections.length
  const groups = song.sections.reduce((n, section) => n + section.bars.length, 0)
  return `${sections} section${sections === 1 ? '' : 's'} · ${groups} group${
    groups === 1 ? '' : 's'
  }`
}

/**
 * Shared top offset so the corner controls line up across every card,
 * whether or not the card shows a roman numeral above them.
 */
const SLOT_CORNER_TOP = 'top-[1.55rem]'

function InsertSlotButtons({
  chordName,
  canInsert,
  onInsert,
  onDragEnter,
  onDragOver,
  onDrop,
}: {
  chordName: string
  canInsert: boolean
  onInsert: (side: 'before' | 'after') => void
  onDragEnter: SlotDragHandler
  onDragOver: SlotDragHandler
  onDrop: (event: {
    preventDefault: () => void
    stopPropagation: () => void
    dataTransfer: DataTransfer
  }) => void
}) {
  const sides: { side: 'before' | 'after'; glyph: string; word: string }[] = [
    { side: 'before', glyph: '◀+', word: 'before' },
    { side: 'after', glyph: '+▶', word: 'after' },
  ]
  return (
    <div
      className={`absolute left-2 ${SLOT_CORNER_TOP} z-10 flex items-center gap-1`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {sides.map(({ side, glyph, word }) => (
        <button
          key={side}
          type="button"
          disabled={!canInsert}
          onClick={() => onInsert(side)}
          aria-label={`Insert an empty step ${word} ${chordName}`}
          title={
            canInsert
              ? `Insert an empty step ${word} ${chordName}`
              : `This group is full — raise its chord count to insert ${word} ${chordName}`
          }
          className="flex h-6 w-6 items-center justify-center rounded-md border border-cosmos-700 text-xs leading-none text-cosmos-300 transition hover:border-nebula-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          {glyph}
        </button>
      ))}
    </div>
  )
}

function RemoveStepButton({
  target,
  onRemoveStep,
  onDragEnter,
  onDragOver,
  onDrop,
}: {
  target: string
  onRemoveStep: () => void
  onDragEnter: SlotDragHandler
  onDragOver: SlotDragHandler
  onDrop: (event: {
    preventDefault: () => void
    stopPropagation: () => void
    dataTransfer: DataTransfer
  }) => void
}) {
  return (
    <div
      className={`absolute right-2 ${SLOT_CORNER_TOP} z-10 flex items-center`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <button
        type="button"
        onClick={onRemoveStep}
        aria-label={`Remove ${target} and close the gap`}
        title={`Remove ${target} and pull the later chords back`}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-cosmos-700 text-xs leading-none text-cosmos-300 transition hover:border-red-400 hover:text-red-400"
      >
        ✕
      </button>
    </div>
  )
}

function FretExtendButtons({
  chordSymbol,
  edge,
  canPlus,
  canMinus,
  onAdjust,
}: {
  chordSymbol: string
  edge: 'low' | 'high'
  canPlus: boolean
  canMinus: boolean
  onAdjust: (delta: number) => void
}) {
  const toward = edge === 'low' ? 'toward the nut' : 'toward the body'
  const extra = edge === 'low' ? 'lower fret' : 'higher fret'
  return (
    <div
      className="pointer-events-auto flex items-center justify-center gap-1 py-0.5"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={!canMinus}
        aria-label={`Hide extra ${extra} on ${chordSymbol}`}
        onClick={() => onAdjust(-1)}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-cosmos-700 text-xs text-cosmos-300 transition hover:border-nebula-500 hover:text-white disabled:opacity-30"
      >
        −
      </button>
      <button
        type="button"
        disabled={!canPlus}
        aria-label={`Show one more fret ${toward} on ${chordSymbol}`}
        onClick={() => onAdjust(1)}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-cosmos-700 text-xs text-cosmos-300 transition hover:border-nebula-500 hover:text-white disabled:opacity-30"
      >
        +
      </button>
    </div>
  )
}

function MeasureStepsControl({
  steps,
  measureId,
  groupLabel,
  onChange,
}: {
  steps: number
  measureId: string
  groupLabel: string
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
        htmlFor={`group-steps-${measureId}`}
      >
        Chords
      </label>
      <button
        type="button"
        aria-label={`Fewer chords in ${groupLabel}`}
        disabled={steps <= MIN_STEPS_PER_MEASURE}
        onClick={() => onChange(steps - 1)}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-cosmos-700 text-xs text-cosmos-300 transition hover:border-nebula-500 hover:text-white disabled:opacity-30"
      >
        −
      </button>
      <input
        key={steps}
        id={`group-steps-${measureId}`}
        type="number"
        min={MIN_STEPS_PER_MEASURE}
        max={MAX_STEPS_PER_MEASURE}
        defaultValue={steps}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        aria-label={`Chords in ${groupLabel}`}
        className="w-12 rounded-md border border-cosmos-700 bg-cosmos-850 px-1 py-0.5 text-center text-xs tabular-nums text-white outline-none focus:border-nebula-500"
      />
      <button
        type="button"
        aria-label={`More chords in ${groupLabel}`}
        disabled={steps >= MAX_STEPS_PER_MEASURE}
        onClick={() => onChange(steps + 1)}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-cosmos-700 text-xs text-cosmos-300 transition hover:border-nebula-500 hover:text-white disabled:opacity-30"
      >
        +
      </button>
    </div>
  )
}

const SEQUENCER_SLOT_MIN = '14rem'

function groupRowBasis(steps: number): string {
  const gaps = Math.max(steps - 1, 0) * 0.5
  const pad = 1.25
  return `calc(${steps} * ${SEQUENCER_SLOT_MIN} + ${gaps + pad}rem)`
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

function splitChordDisplay(input: string): { root: string; suffix: string } {
  const { chord } = tryParseChord(input)
  if (!chord) return { root: displayChordSymbol(input), suffix: '' }
  return {
    root: chord.symbol.slice(0, chord.rootName.length),
    suffix: chord.symbol.slice(chord.rootName.length),
  }
}

function ChordNameText({
  parts,
  fallback,
  nowrap = false,
}: {
  parts: { root: string; suffix: string } | null
  fallback: string
  nowrap?: boolean
}) {
  if (!parts?.suffix) return fallback
  return (
    <>
      {parts.root}
      {nowrap ? null : <wbr />}
      {parts.suffix}
    </>
  )
}

function LineTakeControls({
  recording,
  hasClip,
  error,
  audioInputId,
  onAudioInputIdChange,
  onStartRecord,
  onStopRecord,
  onPlayClip,
  onClearClip,
}: {
  recording: boolean
  hasClip: boolean
  error: string | null
  audioInputId: string
  onAudioInputIdChange: (deviceId: string) => void
  onStartRecord: () => void
  onStopRecord: () => void
  onPlayClip: () => void
  onClearClip: () => void
}) {
  return (
    <div
      className="mt-2 space-y-1.5"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <AudioInputSelect
        compact
        value={audioInputId}
        onChange={onAudioInputIdChange}
      />
      <div className="flex gap-1.5">
        {recording ? (
          <button
            type="button"
            onClick={onStopRecord}
            className={`${slotSelectClass} border-rose-400 text-rose-200`}
          >
            Stop
          </button>
        ) : (
          <button type="button" onClick={onStartRecord} className={slotSelectClass}>
            Record
          </button>
        )}
        <button
          type="button"
          onClick={onPlayClip}
          disabled={!hasClip || recording}
          className={slotSelectClass}
        >
          ▶
        </button>
        <button
          type="button"
          onClick={onClearClip}
          disabled={!hasClip || recording}
          className={slotSelectClass}
        >
          Clear
        </button>
      </div>
      {recording ? (
        <p className="text-[11px] text-rose-300">
          Recording… tap Stop or wait {MAX_LINE_RECORD_SECONDS}s
        </p>
      ) : error ? (
        <p className="text-[11px] text-rose-300">{error}</p>
      ) : null}
    </div>
  )
}

function slotVoicingLabel(slot: SequenceSlot): string {
  if (isLineGroupId(slot.groupId)) {
    const n = slot.lineNotes?.length ?? 0
    return `Line · ${n} note${n === 1 ? '' : 's'}`
  }
  return `${slot.groupId} · ${shortInversion(slot.inversion)}`
}

function barChordSymbols(bar: Bar): string[] {
  return bar.slots.flatMap((slot) => {
    if (!slot || isLineGroupId(slot.groupId)) return []
    return [slot.chordSymbol]
  })
}

function keyHintSymbols(bar: Bar, workshopChordSymbol?: string): string[] {
  const symbols = barChordSymbols(bar)
  const hint = workshopChordSymbol?.trim()
  if (hint && !symbols.includes(hint)) symbols.push(hint)
  return symbols
}

function groupChordSummary(bar: Bar): string {
  const names = bar.slots.flatMap((slot) => {
    if (!slot) return []
    if (isLineGroupId(slot.groupId)) return ['Line']
    return [displayChordSymbol(slot.chordSymbol)]
  })
  if (names.length === 0) return 'Empty group'
  return names.join(' · ')
}

function circleChordRoot(
  bar: Bar,
  selected: SlotLocation | null,
  playing: SlotLocation | null,
  song: Song | null,
): string | null {
  if (playing && song) {
    const source = barAt(song, playing.barId)
    const fromPlay = source
      ? chordSlotAtOrBefore(source, playing.slotIndex)
      : undefined
    if (fromPlay) {
      return (
        tryParseChord(fromPlay.chordSymbol).chord?.rootName ??
        fromPlay.chordSymbol
      )
    }
  }
  const fromSelected =
    selected?.barId === bar.id
      ? chordSlotAtOrBefore(bar, selected.slotIndex)
      : undefined
  const pick = fromSelected ?? bar.slots.find(
    (slot) => slot && !isLineGroupId(slot.groupId),
  )
  if (!pick) return null
  return tryParseChord(pick.chordSymbol).chord?.rootName ?? pick.chordSymbol
}

function chordSlotAtOrBefore(bar: Bar, slotIndex: number) {
  for (let i = slotIndex; i >= 0; i--) {
    const slot = bar.slots[i]
    if (slot && !isLineGroupId(slot.groupId)) return slot
  }
  return undefined
}

function shortInversion(inversion: number): string {
  return (
    ['root', '1st', '2nd', '3rd'][inversion] ?? inversionOrdinal(inversion)
  )
}
