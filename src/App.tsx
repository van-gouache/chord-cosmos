import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ChordInput } from './components/ChordInput'
import { FretboardBuilder } from './components/FretboardBuilder'
import { SplashScreen } from './components/SplashScreen'
import { SequencePanel } from './components/SequencePanel'
import { VGroupGrid } from './components/VGroupGrid'
import { VoicingPicker } from './components/VoicingPicker'
import { unlockAudio } from './audio/player'
import { WorkshopConfig } from './components/WorkshopConfig'
import { CircleOfFifths } from './components/CircleOfFifths'
import { KeyCenterSuggestions } from './components/KeyCenterSuggestions'
import { barAt, locationExists, nextChordForWorkshop, type SlotLocation } from './state/songs'
import { loadPrefs, updatePrefs } from './state/prefs'
import { useSongs } from './state/useSongs'
import { tryParseChord } from './theory/chords'
import { isLineGroupId } from './theory/lineOutline'
import type { ProgressionStep } from './theory/diatonic'
import { generateAllTriads, generateTriadGroup, TRIAD_GROUPS_BY_ID } from './theory/triads'
import { V_GROUPS_BY_ID } from './theory/vsystem'
import { generateAllGroups, generateGroup, type Voicing } from './theory/voicings'

export default function App() {
  const [input, setInput] = useState('E-7')
  const [requestedGroupId, setRequestedGroupId] = useState('V-2')
  const [requestedTriadId, setRequestedTriadId] = useState('Close')
  const [workshopTab, setWorkshopTab] = useState<WorkshopTab>('vsystem')
  const [showForwardTargets, setShowForwardTargets] = useState(
    () => loadPrefs().showForwardTargets
  )
  const [showLickOutline, setShowLickOutline] = useState(
    () => loadPrefs().showLickOutline
  )
  const [showCircleOfFifths, setShowCircleOfFifths] = useState(
    () => loadPrefs().showCircleOfFifths
  )
  const [notebookMode, setNotebookMode] = useState(false)
  const [notebookStyle, setNotebookStyle] = useState(
    () => loadPrefs().notebookStyle
  )
  const [audioInputId, setAudioInputId] = useState(
    () => loadPrefs().audioInputId
  )
  const [qualityNonce, setQualityNonce] = useState(0)
  const [selectedVoicing, setSelectedVoicing] = useState<Voicing | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<SlotLocation | null>(null)
  const [playingSlot, setPlayingSlot] = useState<SlotLocation | null>(null)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [workshopOpen, setWorkshopOpen] = useState(true)
  const [pendingProgression, setPendingProgression] = useState<{
    location: SlotLocation
    stepId: string
    roman: string
    symbol: string
  } | null>(null)
  const [showSplash, setShowSplash] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)
  const usedBrowserFullscreen = useRef(false)

  const songs = useSongs()

  useEffect(() => {
    if (!selectedSlot) return
    if (!songs.activeSong || !locationExists(songs.activeSong, selectedSlot)) {
      setSelectedSlot(null)
    }
  }, [songs.activeSong, selectedSlot])

  useEffect(() => {
    if (!pendingProgression) return
    if (input !== pendingProgression.symbol) setPendingProgression(null)
  }, [input, pendingProgression])

  const toggleNotebook = useCallback(() => {
    setNotebookMode((open) => {
      if (!open) {
        void rootRef.current
          ?.requestFullscreen?.()
          .then(() => {
            usedBrowserFullscreen.current = true
          })
          .catch(() => {
            usedBrowserFullscreen.current = false
          })
        return true
      }
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {})
      }
      usedBrowserFullscreen.current = false
      return false
    })
  }, [])

  useEffect(() => {
    const sync = () => {
      if (!document.fullscreenElement && usedBrowserFullscreen.current) {
        usedBrowserFullscreen.current = false
        setNotebookMode(false)
      }
    }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const { chord, error } = useMemo(() => tryParseChord(input), [input])
  const workshopCircleKey = useMemo(() => {
    const song = songs.activeSong
    if (!song) return null
    const playingBar = playingSlot ? barAt(song, playingSlot.barId) : null
    if (playingBar?.keyRoot) return playingBar.keyRoot
    const selectedBar = selectedSlot
      ? barAt(song, selectedSlot.barId)
      : null
    if (selectedBar?.keyRoot) return selectedBar.keyRoot
    for (const section of song.sections) {
      for (const bar of section.bars) {
        if (bar.keyRoot) return bar.keyRoot
      }
    }
    return null
  }, [playingSlot, songs.activeSong, selectedSlot])
  const workshopCircleChordRoot = useMemo(() => {
    const song = songs.activeSong
    if (playingSlot && song) {
      const bar = barAt(song, playingSlot.barId)
      if (bar) {
        for (let i = playingSlot.slotIndex; i >= 0; i--) {
          const slot = bar.slots[i]
          if (slot && !isLineGroupId(slot.groupId)) {
            return tryParseChord(slot.chordSymbol).chord?.rootName ?? slot.chordSymbol
          }
        }
      }
    }
    return chord?.rootName
  }, [chord?.rootName, playingSlot, songs.activeSong])
  const voicingTargetBar = useMemo(() => {
    const song = songs.activeSong
    if (!song) return null
    if (selectedSlot) return barAt(song, selectedSlot.barId)
    return song.sections[0]?.bars[0] ?? null
  }, [selectedSlot, songs.activeSong])
  const workshopNextChord = useMemo(() => {
    if (!chord || !songs.activeSong) return null
    return nextChordForWorkshop(songs.activeSong, chord, selectedSlot)
  }, [chord, songs.activeSong, selectedSlot])

  const groups = useMemo(() => (chord ? generateAllGroups(chord) : []), [chord])
  const triadGroups = useMemo(
    () => (chord ? generateAllTriads(chord) : []),
    [chord]
  )

  // The requested group may not be playable for the new chord, so fall back to
  // the workhorse group and then to whatever is reachable.
  const selectedResult = useMemo(() => {
    const requested = groups.find((g) => g.group.id === requestedGroupId)
    if (requested && !requested.unreachable) return requested
    return (
      groups.find((g) => g.group.id === 'V-2' && !g.unreachable) ??
      groups.find((g) => !g.unreachable) ??
      null
    )
  }, [groups, requestedGroupId])

  const selectedGroupId = selectedResult?.group.id ?? null

  const selectedResultWithVariants = useMemo(() => {
    if (!chord || !selectedResult) return null
    const group = V_GROUPS_BY_ID[selectedResult.group.id]
    return group
      ? generateGroup(chord, group, { includeVariants: true })
      : selectedResult
  }, [chord, selectedResult])

  const selectedTriad = useMemo(() => {
    const requested = triadGroups.find((g) => g.group.id === requestedTriadId)
    if (requested && !requested.unreachable) return requested
    return triadGroups.find((g) => !g.unreachable) ?? requested ?? null
  }, [triadGroups, requestedTriadId])

  const selectedTriadId = selectedTriad?.group.id ?? null

  const selectedTriadWithVariants = useMemo(() => {
    if (!chord || !selectedTriad) return null
    const group = TRIAD_GROUPS_BY_ID[selectedTriad.group.id]
    return group
      ? generateTriadGroup(chord, group, { includeVariants: true })
      : selectedTriad
  }, [chord, selectedTriad])

  const activeGroupId =
    workshopTab === 'triads' ? selectedTriadId : selectedGroupId

  const changeWorkshopTab = (tab: WorkshopTab) => {
    if (tab === workshopTab) return
    const named = (value: WorkshopTab) => value === 'vsystem' || value === 'triads'
    setWorkshopTab(tab)
    if (!(named(workshopTab) && named(tab))) return
    setQualityNonce((n) => n + 1)
    const root =
      chord?.rootName ?? /^[A-Ga-g][#b]*/.exec(input.trim())?.[0] ?? 'E'
    setInput(root)
  }

  // A voicing selected for a different chord or group is no longer current.
  const activeVoicing =
    selectedVoicing &&
    selectedVoicing.chordSymbol === chord?.symbol &&
    selectedVoicing.groupId === activeGroupId
      ? selectedVoicing
      : null

  const handleAdd = (voicing: Voicing) => {
    const placed = songs.addVoicing(voicing, selectedSlot, {
      roman: romanForPlacement(selectedSlot, voicing.chordSymbol),
    })
    if (placed) setSelectedSlot(placed.nextSelection)
    setPendingProgression(null)
    setJustAdded(voicing.id)
    window.setTimeout(() => setJustAdded(null), 1400)
  }

  const romanForPlacement = (
    location: SlotLocation | null,
    chordSymbol: string
  ): string | undefined => {
    if (!pendingProgression || !location) return undefined
    if (pendingProgression.symbol !== chordSymbol) return undefined
    if (location.barId !== pendingProgression.location.barId) return undefined
    return pendingProgression.roman
  }

  const handlePickProgressionStep = (
    location: SlotLocation | null,
    step: ProgressionStep
  ) => {
    setInput(step.symbol)
    setWorkshopTab('vsystem')
    setWorkshopOpen(true)
    if (location) {
      setSelectedSlot(location)
      setPendingProgression({
        location,
        stepId: step.id,
        roman: step.roman,
        symbol: step.symbol,
      })
    } else {
      setPendingProgression(null)
    }
  }

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 flex-col overflow-hidden bg-cosmos-950"
      onPointerDown={unlockAudio}
    >
      <h1 className="sr-only">Chord Cosmos</h1>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <div
        className={
          notebookMode
            ? 'flex min-h-0 flex-1 flex-col'
            : 'flex min-h-0 flex-1 flex-col lg:flex-row'
        }
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <SequencePanel
            song={songs.activeSong}
            songs={songs.songs}
            slotCount={songs.slotCount}
            notebookMode={notebookMode}
            selected={selectedSlot}
            onSelectSlot={setSelectedSlot}
            onSelectSong={(id) => {
              songs.setActiveSongId(id)
              setSelectedSlot(null)
            }}
            onNewSong={songs.newSong}
            onDuplicateSong={songs.duplicateSong}
            onImportSongs={songs.importSongs}
            onDeleteSong={songs.deleteSong}
            onRename={songs.renameSong}
            onRemoveSlot={songs.removeSlot}
            onMoveSlot={songs.relocateSlot}
            onPlaceIncoming={(location, slot) => {
              const roman = romanForPlacement(location, slot.chordSymbol)
              songs.placeIncoming(
                location,
                roman ? { ...slot, roman } : slot
              )
              if (roman) setPendingProgression(null)
              setJustAdded(slot.chordSymbol)
              window.setTimeout(() => setJustAdded(null), 1400)
            }}
            onDuplicateSlot={songs.duplicateSlot}
            onSetSlotNote={songs.setSlotNote}
            onSetSlotBeats={songs.setSlotBeats}
            onSetSlotPlayback={songs.setSlotPlayback}
            onSetSlotStrumPattern={songs.setSlotStrumPattern}
            onSetLineAudio={songs.setLineAudio}
            audioInputId={audioInputId}
            onAudioInputIdChange={(deviceId) => {
              setAudioInputId(deviceId)
              updatePrefs({ audioInputId: deviceId })
            }}
            onToggleHighlight={songs.toggleHighlight}
            onExtendFrets={songs.extendFrets}
            onShiftSlotOctave={songs.shiftSlotOctave}
            onAddGroup={songs.addBar}
            onDuplicateGroup={songs.duplicateBar}
            onMoveGroup={songs.moveBar}
            onRemoveGroup={songs.removeBar}
            onAddSection={songs.addSection}
            onDuplicateSection={songs.duplicateSection}
            onSetSectionCollapsed={songs.setSectionCollapsed}
            onSetBarCollapsed={songs.setBarCollapsed}
            onRenameSection={songs.renameSection}
            onSetSectionNote={songs.setSectionNote}
            onRemoveSection={songs.removeSection}
            onSetBpm={songs.setBpm}
            onSetGroupSteps={songs.setMeasureSteps}
            onSetBarHarmony={songs.setBarHarmony}
            onPickProgressionStep={handlePickProgressionStep}
            pendingProgression={pendingProgression}
            onClear={songs.clearEntries}
            canUndo={songs.canUndo}
            canRedo={songs.canRedo}
            onUndo={songs.undo}
            onRedo={songs.redo}
            showForwardTargets={showForwardTargets}
            showLickOutline={showLickOutline}
            showCircleOfFifths={showCircleOfFifths}
            onPlayingLocationChange={setPlayingSlot}
            workshopChordSymbol={chord?.symbol ?? input}
            notebookStyle={notebookStyle}
            onToggleNotebook={toggleNotebook}
            onNotebookStyleChange={(style) => {
              setNotebookStyle(style)
              updatePrefs({ notebookStyle: style })
            }}
          />
        </div>

        {!notebookMode &&
          (workshopOpen ? (
            <aside className="mx-3 mb-3 flex max-h-[48vh] min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-cosmos-700/70 bg-cosmos-900/80 lg:my-3 lg:mr-3 lg:ml-0 lg:max-h-full lg:w-[min(460px,38vw)]">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-cosmos-700/70 px-4 py-2.5">
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
                    Voicing workshop
                  </p>
                  <p className="mt-0.5 text-[11px] text-cosmos-500">
                    {pendingProgression && workshopTab === 'vsystem'
                      ? `Pick a V-System grip for ${pendingProgression.roman} · ${pendingProgression.symbol}`
                      : workshopTab === 'config'
                      ? 'Toggle helpers for the workshop and sequence'
                      : workshopTab === 'build'
                      ? 'Build a chord shape or outline a single-note line'
                      : chord
                        ? workshopTab === 'triads'
                          ? `${triadGroups.filter((g) => !g.unreachable).length} of ${triadGroups.length} triad families for ${chord.symbol}`
                          : `${groups.filter((g) => !g.unreachable).length} of 14 playable for ${chord.symbol}`
                        : 'Type a chord to add shapes'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWorkshopOpen(false)}
                  className="rounded-lg border border-cosmos-700 px-2.5 py-1 text-xs text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
                >
                  Hide
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                <div className="flex gap-1 rounded-lg bg-cosmos-950/70 p-1">
                  <button
                    type="button"
                    onClick={() => changeWorkshopTab('vsystem')}
                    className={`flex-1 rounded-md px-1.5 py-1.5 text-[11px] font-semibold tracking-wide uppercase transition ${
                      workshopTab === 'vsystem'
                        ? 'bg-nebula-600 text-white'
                        : 'text-cosmos-400 hover:text-white'
                    }`}
                  >
                    V-System
                  </button>
                  <button
                    type="button"
                    onClick={() => changeWorkshopTab('triads')}
                    className={`flex-1 rounded-md px-1.5 py-1.5 text-[11px] font-semibold tracking-wide uppercase transition ${
                      workshopTab === 'triads'
                        ? 'bg-nebula-600 text-white'
                        : 'text-cosmos-400 hover:text-white'
                    }`}
                  >
                    Triads
                  </button>
                  <button
                    type="button"
                    onClick={() => changeWorkshopTab('build')}
                    className={`flex-1 rounded-md px-1.5 py-1.5 text-[11px] font-semibold tracking-wide uppercase transition ${
                      workshopTab === 'build'
                        ? 'bg-nebula-600 text-white'
                        : 'text-cosmos-400 hover:text-white'
                    }`}
                  >
                    Build
                  </button>
                  <button
                    type="button"
                    onClick={() => changeWorkshopTab('config')}
                    className={`flex-1 rounded-md px-1.5 py-1.5 text-[11px] font-semibold tracking-wide uppercase transition ${
                      workshopTab === 'config'
                        ? 'bg-nebula-600 text-white'
                        : 'text-cosmos-400 hover:text-white'
                    }`}
                  >
                    Config
                  </button>
                </div>

                {workshopTab === 'config' ? (
                  <WorkshopConfig
                    showForwardTargets={showForwardTargets}
                    onShowForwardTargetsChange={(value) => {
                      setShowForwardTargets(value)
                      updatePrefs({ showForwardTargets: value })
                    }}
                    showLickOutline={showLickOutline}
                    onShowLickOutlineChange={(value) => {
                      setShowLickOutline(value)
                      updatePrefs({ showLickOutline: value })
                    }}
                    showCircleOfFifths={showCircleOfFifths}
                    onShowCircleOfFifthsChange={(value) => {
                      setShowCircleOfFifths(value)
                      updatePrefs({ showCircleOfFifths: value })
                    }}
                    notebookStyle={notebookStyle}
                    onNotebookStyleChange={(style) => {
                      setNotebookStyle(style)
                      updatePrefs({ notebookStyle: style })
                    }}
                    audioInputId={audioInputId}
                    onAudioInputIdChange={(deviceId) => {
                      setAudioInputId(deviceId)
                      updatePrefs({ audioInputId: deviceId })
                    }}
                  />
                ) : workshopTab === 'build' ? (
                  <div className="rounded-xl border border-cosmos-700/60 bg-cosmos-950/40 p-3">
                    <FretboardBuilder
                      onAdd={handleAdd}
                      onAddLine={(notes) => {
                        const placed = songs.addLine(notes, selectedSlot)
                        if (placed) setSelectedSlot(placed.nextSelection)
                        setJustAdded('line')
                        window.setTimeout(() => setJustAdded(null), 1400)
                      }}
                    />
                  </div>
                ) : (
                <div className="rounded-xl border border-cosmos-700/60 bg-cosmos-950/40 p-3">
                  <ChordInput
                    value={input}
                    onChange={setInput}
                    chord={chord}
                    error={error}
                    mode={workshopTab === 'triads' ? 'triads' : 'vsystem'}
                    qualityNonce={qualityNonce}
                  />
                  {voicingTargetBar && !voicingTargetBar.keyRoot && chord ? (
                    <div className="mt-3 rounded-lg border border-cosmos-800/80 bg-cosmos-950/50 p-2">
                      <p className="mb-1.5 text-[11px] leading-snug text-cosmos-500">
                        This group has no key center. Typical homes for{' '}
                        {chord.symbol}:
                      </p>
                      <KeyCenterSuggestions
                        chordSymbols={[
                          ...voicingTargetBar.slots.flatMap((slot) =>
                            slot && !isLineGroupId(slot.groupId)
                              ? [slot.chordSymbol]
                              : [],
                          ),
                          chord.symbol,
                        ]}
                        onPick={(harmony) =>
                          songs.setBarHarmony(voicingTargetBar.id, harmony)
                        }
                      />
                    </div>
                  ) : null}
                  {showCircleOfFifths ? (
                    <div className="mt-3 rounded-lg border border-cosmos-800/80 bg-cosmos-950/50 p-2">
                      {workshopCircleKey ? (
                        <CircleOfFifths
                          keyRoot={workshopCircleKey}
                          chordRootName={workshopCircleChordRoot}
                        />
                      ) : (
                        <p className="text-center text-[11px] leading-snug text-cosmos-500">
                          Set a group key on the sequence to place this chord
                          on the circle of fifths.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
                )}

                {workshopTab !== 'build' && workshopTab !== 'config' && (
                <div className="rounded-xl border border-cosmos-700/60 bg-cosmos-950/40 p-3">
                  {chord ? (
                    workshopTab === 'triads' ? (
                      <VGroupGrid
                        groups={triadGroups}
                        selectedGroupId={selectedTriadId}
                        onSelect={setRequestedTriadId}
                      />
                    ) : (
                      <VGroupGrid
                        groups={groups}
                        selectedGroupId={selectedGroupId}
                        onSelect={setRequestedGroupId}
                      />
                    )
                  ) : (
                    <p className="p-6 text-center text-sm text-cosmos-400">
                      Type a chord to see its voicing groups.
                    </p>
                  )}
                </div>
                )}

                {chord &&
                  workshopTab === 'vsystem' &&
                  selectedResultWithVariants && (
                    <VoicingPicker
                      result={selectedResultWithVariants}
                      chord={chord}
                      nextChord={workshopNextChord}
                      showForwardTargets={showForwardTargets}
                      showLickOutline={showLickOutline}
                      selectedVoicingId={activeVoicing?.id ?? null}
                      onSelectVoicing={setSelectedVoicing}
                      onAdd={handleAdd}
                    />
                  )}
                {chord &&
                  workshopTab === 'triads' &&
                  selectedTriadWithVariants && (
                    <VoicingPicker
                      result={selectedTriadWithVariants}
                      chord={chord}
                      nextChord={workshopNextChord}
                      showForwardTargets={showForwardTargets}
                      showLickOutline={showLickOutline}
                      selectedVoicingId={activeVoicing?.id ?? null}
                      onSelectVoicing={setSelectedVoicing}
                      onAdd={handleAdd}
                    />
                  )}
                {chord &&
                  workshopTab === 'triads' &&
                  !selectedTriad && (
                    <p className="rounded-xl border border-dashed border-cosmos-700 p-6 text-center text-sm text-cosmos-400">
                      This symbol doesn&apos;t imply a triad (needs a 3rd or sus
                      and a 5th).
                    </p>
                  )}
              </div>
            </aside>
          ) : (
            <button
              type="button"
              onClick={() => setWorkshopOpen(true)}
              className="m-3 flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-cosmos-700/70 bg-cosmos-900/80 px-3 py-2 text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase transition hover:border-nebula-500 hover:text-white lg:my-3 lg:mr-3 lg:ml-0 lg:w-11 lg:[writing-mode:vertical-rl] lg:rotate-180"
            >
              Voicing workshop
            </button>
          ))}
      </div>

      {/* Confirmation that a shape landed in the sequence */}
      {justAdded && !notebookMode && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-nebula-500/50 bg-cosmos-850 px-5 py-2.5 text-sm font-medium text-white shadow-xl">
          Added to {songs.activeSong?.name}
        </div>
      )}
    </div>
  )
}

type WorkshopTab = 'vsystem' | 'triads' | 'build' | 'config'
