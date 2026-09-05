import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ArpeggioChart } from './components/ArpeggioChart'
import { ChordInput } from './components/ChordInput'
import { FretboardBuilder } from './components/FretboardBuilder'
import { SplashScreen } from './components/SplashScreen'
import { SequencePanel } from './components/SequencePanel'
import { VGroupGrid } from './components/VGroupGrid'
import { VoicingPicker } from './components/VoicingPicker'
import { unlockAudio } from './audio/player'
import { locationExists, type SlotLocation } from './state/songs'
import { useSongs } from './state/useSongs'
import { tryParseChord } from './theory/chords'
import { generateAllTriads } from './theory/triads'
import { generateAllGroups, type Voicing } from './theory/voicings'

export default function App() {
  const [input, setInput] = useState('E-7')
  const [requestedGroupId, setRequestedGroupId] = useState('V-2')
  const [requestedTriadId, setRequestedTriadId] = useState('Close')
  const [workshopTab, setWorkshopTab] = useState<WorkshopTab>('vsystem')
  const [qualityNonce, setQualityNonce] = useState(0)
  const [selectedVoicing, setSelectedVoicing] = useState<Voicing | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<SlotLocation | null>(null)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [workshopOpen, setWorkshopOpen] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
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

  const toggleFocus = useCallback(() => {
    setFocusMode((open) => {
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
        setFocusMode(false)
      }
    }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const { chord, error } = useMemo(() => tryParseChord(input), [input])

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

  const selectedTriad = useMemo(() => {
    const requested = triadGroups.find((g) => g.group.id === requestedTriadId)
    if (requested && !requested.unreachable) return requested
    return triadGroups.find((g) => !g.unreachable) ?? requested ?? null
  }, [triadGroups, requestedTriadId])

  const selectedTriadId = selectedTriad?.group.id ?? null
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
    const placed = songs.addVoicing(voicing, selectedSlot)
    if (placed) setSelectedSlot(placed.nextSelection)
    setJustAdded(voicing.id)
    window.setTimeout(() => setJustAdded(null), 1400)
  }

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 flex-col bg-cosmos-950"
      onPointerDown={unlockAudio}
    >
      <h1 className="sr-only">Chord Cosmos</h1>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <div
        className={
          focusMode
            ? 'flex min-h-0 flex-1 flex-col'
            : 'flex min-h-0 flex-1 flex-col lg:flex-row'
        }
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <SequencePanel
            song={songs.activeSong}
            songs={songs.songs}
            slotCount={songs.slotCount}
            focusMode={focusMode}
            onToggleFocus={toggleFocus}
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
              songs.placeIncoming(location, slot)
              setJustAdded(slot.chordSymbol)
              window.setTimeout(() => setJustAdded(null), 1400)
            }}
            onDuplicateSlot={songs.duplicateSlot}
            onSetSlotNote={songs.setSlotNote}
            onSetSlotFeel={songs.setSlotFeel}
            onToggleHighlight={songs.toggleHighlight}
            onExtendFrets={songs.extendFrets}
            onShiftSlotOctave={songs.shiftSlotOctave}
            onAddMeasure={songs.addBar}
            onDuplicateMeasure={songs.duplicateBar}
            onMoveMeasure={songs.moveBar}
            onRemoveMeasure={songs.removeBar}
            onAddSection={songs.addSection}
            onRenameSection={songs.renameSection}
            onSetSectionNote={songs.setSectionNote}
            onRemoveSection={songs.removeSection}
            onSetBpm={songs.setBpm}
            onSetMeasureSteps={songs.setMeasureSteps}
            onSetPlayback={songs.setPlayback}
            onSetStrumPattern={songs.setStrumPattern}
            onClear={songs.clearEntries}
            canUndo={songs.canUndo}
            canRedo={songs.canRedo}
            onUndo={songs.undo}
            onRedo={songs.redo}
          />
        </div>

        {!focusMode &&
          (workshopOpen ? (
            <aside className="mx-3 mb-3 flex max-h-[48vh] min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-cosmos-700/70 bg-cosmos-900/80 lg:my-3 lg:mr-3 lg:ml-0 lg:max-h-none lg:w-[min(460px,38vw)]">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-cosmos-700/70 px-4 py-2.5">
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-cosmos-400 uppercase">
                    Voicing workshop
                  </p>
                  <p className="mt-0.5 text-[11px] text-cosmos-500">
                    {workshopTab === 'build'
                      ? 'Click frets to build a shape'
                      : workshopTab === 'arp'
                        ? chord
                          ? `3 notes per string for ${chord.symbol}`
                          : 'Type a chord to see its arpeggio'
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
                    className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
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
                    className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
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
                    className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
                      workshopTab === 'build'
                        ? 'bg-nebula-600 text-white'
                        : 'text-cosmos-400 hover:text-white'
                    }`}
                  >
                    Build
                  </button>
                  <button
                    type="button"
                    onClick={() => changeWorkshopTab('arp')}
                    className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
                      workshopTab === 'arp'
                        ? 'bg-nebula-600 text-white'
                        : 'text-cosmos-400 hover:text-white'
                    }`}
                  >
                    Arp
                  </button>
                </div>

                {workshopTab === 'build' ? (
                  <div className="rounded-xl border border-cosmos-700/60 bg-cosmos-950/40 p-3">
                    <FretboardBuilder onAdd={handleAdd} />
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
                </div>
                )}

                {workshopTab === 'arp' && (
                  <div className="rounded-xl border border-cosmos-700/60 bg-cosmos-950/40 p-3">
                    {chord ? (
                      <ArpeggioChart chord={chord} />
                    ) : (
                      <p className="p-6 text-center text-sm text-cosmos-400">
                        Type a chord to see its 3-notes-per-string arpeggio.
                      </p>
                    )}
                  </div>
                )}

                {workshopTab !== 'build' && workshopTab !== 'arp' && (
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
                  selectedResult && (
                    <VoicingPicker
                      result={selectedResult}
                      selectedVoicingId={activeVoicing?.id ?? null}
                      onSelectVoicing={setSelectedVoicing}
                      onAdd={handleAdd}
                    />
                  )}
                {chord && workshopTab === 'triads' && selectedTriad && (
                  <VoicingPicker
                    result={selectedTriad}
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
      {justAdded && !focusMode && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-nebula-500/50 bg-cosmos-850 px-5 py-2.5 text-sm font-medium text-white shadow-xl">
          Added to {songs.activeSong?.name}
        </div>
      )}
    </div>
  )
}

type WorkshopTab = 'vsystem' | 'triads' | 'build' | 'arp'
