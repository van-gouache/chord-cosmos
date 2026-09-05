import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  canRedo,
  canUndo,
  emptyHistory,
  recordChange,
  redoChange,
  undoChange,
  type SongHistory,
} from './history'

import type { Voicing } from '../theory/voicings'
import {
  MAX_BPM,
  MIN_BPM,
  appendBarIfNeeded,
  cloneSlot,
  duplicateBar,
  moveBar,
  cloneSong,
  countSlots,
  createSong,
  emptyBar,
  emptySection,
  firstEmptyLocation,
  lastBarSteps,
  loadState,
  moveSlot,
  normalizeSong,
  patchSlot,
  placeSlot,
  shiftSlotOctave,
  readImportedSongs,
  saveState,
  setBarSteps,
  slotFromVoicing,
  type PlaybackStyle,
  type SequenceSlot,
  type SlotLocation,
  type Song,
} from './songs'

/** Owns the saved songs and keeps them mirrored to localStorage. */
export function useSongs() {
  const [songs, setSongs] = useState<Song[]>(() => {
    const stored = loadState()
    return stored.songs.length > 0 ? stored.songs : [createSong('My sequence')]
  })
  const [activeSongId, setActiveSongId] = useState<string | null>(() => {
    const stored = loadState()
    return stored.activeSongId ?? null
  })
  const [historyRev, setHistoryRev] = useState(0)
  const songsRef = useRef(songs)
  const historiesRef = useRef<Record<string, SongHistory>>({})

  const commitSongs = useCallback((next: Song[]) => {
    songsRef.current = next
    setSongs(next)
  }, [])

  useEffect(() => {
    if (songsRef.current.every((song) => Array.isArray(song.sections))) return
    const migrated = songsRef.current
      .map((song) => normalizeSong(song))
      .filter((song): song is Song => song !== null)
    commitSongs(migrated.length > 0 ? migrated : [createSong('My sequence')])
  }, [commitSongs])

  useEffect(() => {
    saveState({ songs, activeSongId })
  }, [songs, activeSongId])

  const activeSong = useMemo(
    () => songs.find((s) => s.id === activeSongId) ?? songs[0] ?? null,
    [songs, activeSongId]
  )

  const activeHistory = activeSong
    ? historiesRef.current[activeSong.id]
    : undefined

  const updateSong = useCallback(
    (
      songId: string,
      change: (song: Song) => Song,
      options?: { coalesce?: boolean }
    ) => {
      const current = songsRef.current.find((song) => song.id === songId)
      if (!current) return
      const next = change(current)
      if (next === current) return
      historiesRef.current[songId] = recordChange(
        historiesRef.current[songId] ?? emptyHistory(),
        current,
        options
      )
      commitSongs(
        songsRef.current.map((song) =>
          song.id === songId ? { ...next, updatedAt: Date.now() } : song
        )
      )
      setHistoryRev((value) => value + 1)
    },
    [commitSongs]
  )

  const undo = useCallback(() => {
    const current = songsRef.current.find((song) => song.id === activeSongId) ??
      songsRef.current[0]
    if (!current) return
    const result = undoChange(
      historiesRef.current[current.id] ?? emptyHistory(),
      current
    )
    if (!result) return
    historiesRef.current[current.id] = result.history
    commitSongs(
      songsRef.current.map((song) =>
        song.id === current.id ? { ...result.song, updatedAt: Date.now() } : song
      )
    )
    setHistoryRev((value) => value + 1)
  }, [activeSongId, commitSongs])

  const redo = useCallback(() => {
    const current = songsRef.current.find((song) => song.id === activeSongId) ??
      songsRef.current[0]
    if (!current) return
    const result = redoChange(
      historiesRef.current[current.id] ?? emptyHistory(),
      current
    )
    if (!result) return
    historiesRef.current[current.id] = result.history
    commitSongs(
      songsRef.current.map((song) =>
        song.id === current.id ? { ...result.song, updatedAt: Date.now() } : song
      )
    )
    setHistoryRev((value) => value + 1)
  }, [activeSongId, commitSongs])

  const addVoicing = useCallback(
    (voicing: Voicing) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => {
        const prepared = appendBarIfNeeded(song)
        return placeSlot(
          prepared.song,
          prepared.location,
          slotFromVoicing(voicing)
        )
      })
    },
    [activeSong, updateSong]
  )

  const placeIncoming = useCallback(
    (location: SlotLocation, slot: SequenceSlot) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => placeSlot(song, location, slot))
    },
    [activeSong, updateSong]
  )

  const removeSlot = useCallback(
    (location: SlotLocation) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => placeSlot(song, location, null))
    },
    [activeSong, updateSong]
  )

  const relocateSlot = useCallback(
    (from: SlotLocation, to: SlotLocation) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => moveSlot(song, from, to))
    },
    [activeSong, updateSong]
  )

  const duplicateSlot = useCallback(
    (location: SlotLocation) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => {
        const section = song.sections.find((s) => s.id === location.sectionId)
        const bar = section?.bars.find((b) => b.id === location.barId)
        const slot = bar?.slots[location.slotIndex]
        if (!slot) return song
        const prepared = appendBarIfNeeded(song)
        return placeSlot(prepared.song, prepared.location, cloneSlot(slot))
      })
    },
    [activeSong, updateSong]
  )

  const setSlotNote = useCallback(
    (location: SlotLocation, note: string) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => patchSlot(song, location, { note }), {
        coalesce: true,
      })
    },
    [activeSong, updateSong]
  )

  const setSlotFeel = useCallback(
    (location: SlotLocation, patch: Pick<SequenceSlot, 'playback' | 'strumPattern'>) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => patchSlot(song, location, patch))
    },
    [activeSong, updateSong]
  )

  const shiftSlotOctaveBy = useCallback(
    (location: SlotLocation, deltaFrets: number) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) =>
        shiftSlotOctave(song, location, deltaFrets)
      )
    },
    [activeSong, updateSong]
  )

  const moveBarBy = useCallback(
    (
      from: { sectionId: string; barId: string },
      to: { sectionId: string; beforeBarId?: string | null }
    ) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => moveBar(song, from, to))
    },
    [activeSong, updateSong]
  )

  const duplicateBarBy = useCallback(
    (sectionId: string, barId: string) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => duplicateBar(song, sectionId, barId))
    },
    [activeSong, updateSong]
  )

  const addBar = useCallback(
    (sectionId: string) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => ({
        ...song,
        sections: song.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                bars: [...section.bars, emptyBar(lastBarSteps(song, sectionId))],
              }
            : section
        ),
      }))
    },
    [activeSong, updateSong]
  )

  const removeBar = useCallback(
    (sectionId: string, barId: string) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => ({
        ...song,
        sections: song.sections.map((section) => {
          if (section.id !== sectionId) return section
          const bars = section.bars.filter((b) => b.id !== barId)
          return {
            ...section,
            bars: bars.length > 0 ? bars : [emptyBar()],
          }
        }),
      }))
    },
    [activeSong, updateSong]
  )

  const addSection = useCallback(() => {
    if (!activeSong) return
    updateSong(activeSong.id, (song) => {
      const label = String.fromCharCode(65 + song.sections.length) // A, B, C...
      return {
        ...song,
        sections: [...song.sections, emptySection(label, lastBarSteps(song))],
      }
    })
  }, [activeSong, updateSong])

  const renameSection = useCallback(
    (sectionId: string, name: string) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => ({
        ...song,
        sections: song.sections.map((section) =>
          section.id === sectionId ? { ...section, name } : section
        ),
      }),
      { coalesce: true }
    )
    },
    [activeSong, updateSong]
  )

  const setSectionNote = useCallback(
    (sectionId: string, note: string) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => ({
        ...song,
        sections: song.sections.map((section) =>
          section.id === sectionId ? { ...section, note } : section
        ),
      }),
      { coalesce: true }
    )
    },
    [activeSong, updateSong]
  )

  const removeSection = useCallback(
    (sectionId: string) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => {
        const sections = song.sections.filter((s) => s.id !== sectionId)
        return {
          ...song,
          sections:
            sections.length > 0
              ? sections
              : [emptySection('A')],
        }
      })
    },
    [activeSong, updateSong]
  )

  const setBpm = useCallback(
    (bpm: number) => {
      if (!activeSong) return
      const next = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)))
      updateSong(activeSong.id, (song) => ({ ...song, bpm: next }), {
        coalesce: true,
      })
    },
    [activeSong, updateSong]
  )

  const setMeasureSteps = useCallback(
    (barId: string, steps: number) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => setBarSteps(song, barId, steps))
    },
    [activeSong, updateSong]
  )

  const setPlayback = useCallback(
    (playback: PlaybackStyle) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => ({ ...song, playback }))
    },
    [activeSong, updateSong]
  )

  const setStrumPattern = useCallback(
    (strumPattern: string | undefined) => {
      if (!activeSong) return
      updateSong(activeSong.id, (song) => ({ ...song, strumPattern }))
    },
    [activeSong, updateSong]
  )

  const renameSong = useCallback(
    (songId: string, name: string) => {
      updateSong(songId, (song) => ({ ...song, name }), { coalesce: true })
    },
    [updateSong]
  )

  const newSong = useCallback(() => {
    const song = createSong(`Sequence ${songsRef.current.length + 1}`)
    commitSongs([...songsRef.current, song])
    setActiveSongId(song.id)
    return song
  }, [commitSongs])

  const duplicateSong = useCallback(
    (songId: string) => {
      const source = songsRef.current.find((song) => song.id === songId)
      if (!source) return
      const copy = cloneSong(source)
      commitSongs([...songsRef.current, copy])
      setActiveSongId(copy.id)
    },
    [commitSongs]
  )

  const importSongs = useCallback((value: unknown): number => {
    const incoming = readImportedSongs(value).map((song) =>
      cloneSong(song, song.name)
    )
    if (incoming.length === 0) return 0
    commitSongs([...songsRef.current, ...incoming])
    setActiveSongId(incoming[incoming.length - 1].id)
    return incoming.length
  }, [commitSongs])

  const deleteSong = useCallback(
    (songId: string) => {
      delete historiesRef.current[songId]
      const remaining = songsRef.current.filter((s) => s.id !== songId)
      if (remaining.length === 0) {
        const replacement = createSong('My sequence')
        setActiveSongId(replacement.id)
        commitSongs([replacement])
        setHistoryRev((value) => value + 1)
        return
      }
      if (songId === activeSongId) setActiveSongId(remaining[0].id)
      commitSongs(remaining)
      setHistoryRev((value) => value + 1)
    },
    [activeSongId, commitSongs]
  )

  const clearEntries = useCallback(() => {
    if (!activeSong) return
    updateSong(activeSong.id, (song) => ({
      ...song,
      sections: [emptySection('A')],
    }))
  }, [activeSong, updateSong])

  return {
    songs,
    activeSong,
    slotCount: activeSong ? countSlots(activeSong) : 0,
    firstEmpty: activeSong ? firstEmptyLocation(activeSong) : null,
    setActiveSongId,
    addVoicing,
    placeIncoming,
    removeSlot,
    relocateSlot,
    duplicateSlot,
    setSlotNote,
    setSlotFeel,
    shiftSlotOctave: shiftSlotOctaveBy,
    addBar,
    duplicateBar: duplicateBarBy,
    moveBar: moveBarBy,
    removeBar,
    addSection,
    renameSection,
    setSectionNote,
    removeSection,
    setBpm,
    setMeasureSteps,
    setPlayback,
    setStrumPattern,
    renameSong,
    newSong,
    duplicateSong,
    importSongs,
    deleteSong,
    clearEntries,
    undo,
    redo,
    canUndo: historyRev >= 0 && canUndo(activeHistory),
    canRedo: historyRev >= 0 && canRedo(activeHistory),
  }
}
