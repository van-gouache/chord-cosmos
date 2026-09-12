import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BEATS_PER_BAR,
  DEFAULT_BPM,
  DEFAULT_SLOT_BEATS,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  appendBarIfNeeded,
  cloneSlot,
  duplicateBar,
  duplicateSection,
  setSectionCollapsed,
  setBarCollapsed,
  setBarName,
  moveBar,
  cloneSong,
  countSlots,
  createSong,
  emptySection,
  libraryForJsonExport,
  exportSong,
  firstEmptyLocation,
  firstEmptyInBar,
  nextEmptyAfter,
  resolveAddLocation,
  loadState,
  normalizeSong,
  locationKey,
  locationsEqual,
  formatStrumPattern,
  moveSlot,
  normalizeStrumPattern,
  packEntriesIntoSection,
  parseStrumPattern,
  hydrateSlot,
  insertSlotAt,
  canInsertSlotAt,
  removeStepAt,
  patchSlot,
  placeSlot,
  toggleHighlightedNote,
  toggleSlotHighlight,
  adjustSlotFretExtend,
  shiftSlotOctave,
  randomizeSlotShape,
  canRandomizeSlotShape,
  voicingForSlot,
  playTimeline,
  readImportedSongs,
  saveState,
  slotFromVoicingPayload,
  slotFromLineNotes,
  slotMidiNotes,
  setBarSteps,
  setBarHarmony,
  slotBeats,
  stepSeconds,
  type SequenceSlot,
  type Song,
} from './songs'
import { parseChord } from '../theory/chords'
import { tabLabel } from '../theory/fretboard'
import { generateTriadGroup, TRIAD_GROUPS_BY_ID } from '../theory/triads'
import { V_GROUPS_BY_ID } from '../theory/vsystem'
import { generateGroup } from '../theory/voicings'

function slot(partial: Partial<SequenceSlot> & { chordSymbol: string }): SequenceSlot {
  return {
    id: partial.id ?? `slot-${partial.chordSymbol}`,
    chordSymbol: partial.chordSymbol,
    groupId: partial.groupId ?? 'V-2',
    inversion: partial.inversion ?? 0,
    tab: partial.tab ?? 'x-7-9-7-8-x',
    note: partial.note ?? '',
    highlightedNotes: partial.highlightedNotes,
  }
}

function songWithSlots(symbols: string[]): Song {
  const song = createSong('Test')
  const section = packEntriesIntoSection(
    symbols.map((chordSymbol, i) => slot({ id: `e${i}`, chordSymbol }))
  )
  return { ...song, sections: [section] }
}

describe('song grid helpers', () => {
  it('creates a song with one empty four-step measure', () => {
    const song = createSong('Demo')
    expect(song.bpm).toBe(DEFAULT_BPM)
    expect(song.playback).toBe('strum')
    expect(song.sections).toHaveLength(1)
    expect(song.sections[0].bars).toHaveLength(1)
    expect(song.sections[0].bars[0].slots).toHaveLength(BEATS_PER_BAR)
    expect(song.sections[0].bars[0].slots.every((s) => s === null)).toBe(true)
    expect(countSlots(song)).toBe(0)
  })

  it('stores a group key center and finds the first empty step in that group', () => {
    const song = createSong('Demo')
    const bar = song.sections[0].bars[0]
    const next = setBarHarmony(song, bar.id, { keyRoot: 'Bb', mode: 'ionian' })
    expect(next.sections[0].bars[0].keyRoot).toBe('Bb')
    expect(next.sections[0].bars[0].mode).toBe('ionian')
    const roundTrip = normalizeSong(JSON.parse(JSON.stringify(next)))
    expect(roundTrip).not.toBeNull()
    expect(roundTrip!.sections[0].bars[0].keyRoot).toBe('Bb')
    expect(firstEmptyInBar(next, song.sections[0].id, bar.id)?.slotIndex).toBe(0)
    const cleared = setBarHarmony(next, bar.id, { keyRoot: null })
    expect(cleared.sections[0].bars[0].keyRoot).toBeUndefined()
    expect(cleared.sections[0].bars[0].mode).toBe('ionian')
  })

  it('persists a progression roman numeral on a chord slot', () => {
    const song = createSong('Demo')
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    const placed = placeSlot(song, location, {
      id: 'slot-1',
      chordSymbol: 'D-7',
      groupId: 'V-2',
      inversion: 0,
      tab: 'x-5-7-5-6-x',
      note: '',
      roman: 'II-7',
    })
    const roundTrip = normalizeSong(JSON.parse(JSON.stringify(placed)))
    expect(roundTrip?.sections[0].bars[0].slots[0]?.roman).toBe('II-7')
    expect(
      slotFromVoicingPayload(
        JSON.stringify({
          chordSymbol: 'D-7',
          groupId: 'V-2',
          inversion: 0,
          tab: 'x-5-7-5-6-x',
          roman: 'II-7',
        })
      )?.roman
    ).toBe('II-7')
  })

  it('rebuilds a slot from a dragged voicing payload', () => {
    const slot = slotFromVoicingPayload(
      JSON.stringify({
        chordSymbol: 'Em7',
        groupId: 'V-4',
        inversion: 0,
        tab: 'x-7-9-7-8-x',
      })
    )
    expect(slot?.chordSymbol).toBe('Em7')
    expect(slot?.groupId).toBe('V-4')
    expect(slot?.tab).toBe('x-7-9-7-8-x')
    expect(slotFromVoicingPayload('nope')).toBeNull()
  })

  it('stores a single-note line as outlined frets', () => {
    const line = slotFromLineNotes([
      { string: 5, fret: 7 },
      { string: 4, fret: 8 },
      { string: 5, fret: 10 },
    ])
    expect(line?.groupId).toBe('Line')
    expect(line?.chordSymbol).toBe('Line')
    expect(line?.playback).toBeUndefined()
    expect(line?.lineNotes).toEqual([
      { string: 5, fret: 7 },
      { string: 4, fret: 8 },
      { string: 5, fret: 10 },
    ])
    expect(slotMidiNotes(line!, null)).toBeNull()

    const song = createSong('Line')
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    const placed = placeSlot(song, location, line!)
    const hydrated = hydrateSlot(placed.sections[0].bars[0].slots[0]!)
    expect(hydrated.shape?.group.id).toBe('Line')
    expect(hydrated.fingering?.notes).toHaveLength(0)

    const dropped = slotFromVoicingPayload(
      JSON.stringify({
        chordSymbol: 'Line',
        groupId: 'Line',
        inversion: 0,
        tab: 'x-x-x-x-x-x',
        lineNotes: line!.lineNotes,
      })
    )
    expect(dropped?.lineNotes).toEqual(line!.lineNotes)

    const added = toggleSlotHighlight(placed, location, { string: 3, fret: 9 })
    expect(added.sections[0].bars[0].slots[0]?.lineNotes).toEqual([
      { string: 5, fret: 7 },
      { string: 4, fret: 8 },
      { string: 5, fret: 10 },
      { string: 3, fret: 9 },
    ])
    const repeated = toggleSlotHighlight(placed, location, { string: 5, fret: 7 })
    expect(repeated.sections[0].bars[0].slots[0]?.lineNotes).toEqual([
      { string: 5, fret: 7 },
      { string: 4, fret: 8 },
      { string: 5, fret: 10 },
      { string: 5, fret: 7 },
    ])

    const up = shiftSlotOctave(placed, location, 12)
    expect(up.sections[0].bars[0].slots[0]?.lineNotes).toEqual([
      { string: 5, fret: 19 },
      { string: 4, fret: 20 },
      { string: 5, fret: 22 },
    ])
  })

  it('lets a line last exactly as long as its written rhythm', () => {
    const straight = slotFromLineNotes([
      { string: 5, fret: 7, value: 8 },
      { string: 5, fret: 8, value: 8 },
    ])
    expect(slotBeats(straight!)).toBe(1)

    const triplets = slotFromLineNotes(
      Array.from({ length: 3 }, () => ({
        string: 5,
        fret: 7,
        value: 8 as const,
        tuplet: 3 as const,
      }))
    )
    expect(slotBeats(triplets!)).toBe(1)

    expect(slotBeats({ ...straight!, lineNotes: undefined })).toBe(
      DEFAULT_SLOT_BEATS
    )
  })

  it('clones a song with fresh ids and the same chords', () => {
    const song = songWithSlots(['Em7', 'A7'])
    const copy = cloneSong(song, 'Copy')
    expect(copy.id).not.toBe(song.id)
    expect(copy.name).toBe('Copy')
    expect(copy.sections[0].id).not.toBe(song.sections[0].id)
    expect(copy.sections[0].bars[0].id).not.toBe(song.sections[0].bars[0].id)
    expect(copy.sections[0].bars[0].slots[0]?.id).not.toBe(
      song.sections[0].bars[0].slots[0]?.id
    )
    expect(copy.sections[0].bars[0].slots.map((s) => s?.chordSymbol ?? null)).toEqual([
      'Em7',
      'A7',
      null,
      null,
    ])
  })

  it('reads a single song, an array, or a library wrapper for import', () => {
    const song = songWithSlots(['CΔ7'])
    expect(readImportedSongs(song)).toHaveLength(1)
    expect(readImportedSongs([song, createSong('Two')])).toHaveLength(2)
    expect(readImportedSongs({ songs: [song] })).toHaveLength(1)
    expect(readImportedSongs({ name: 'Nameless' })).toHaveLength(1)
    expect(readImportedSongs({ name: 'Nameless' })[0].name).toBe('Nameless')
    expect(readImportedSongs('nope')).toEqual([])
  })

  it('resizes one measure without changing the others', () => {
    const song = songWithSlots(['Em7', 'A7', 'DΔ7', 'GΔ7', 'CΔ7'])
    const first = song.sections[0].bars[0]
    const second = song.sections[0].bars[1]
    expect(first.slots).toHaveLength(4)
    expect(second.slots).toHaveLength(4)

    const tighter = setBarSteps(song, first.id, 2)
    expect(tighter.sections[0].bars[0].slots.map((s) => s?.chordSymbol ?? null)).toEqual([
      'Em7',
      'A7',
    ])
    expect(tighter.sections[0].bars[1].slots.map((s) => s?.chordSymbol ?? null)).toEqual([
      'CΔ7',
      null,
      null,
      null,
    ])

    const wider = setBarSteps(tighter, first.id, 6)
    expect(wider.sections[0].bars[0].slots.map((s) => s?.chordSymbol ?? null)).toEqual([
      'Em7',
      'A7',
      null,
      null,
      null,
      null,
    ])
    expect(wider.sections[0].bars[1].slots).toHaveLength(4)
  })

  it('clamps a measure to between 1 and 32 steps', () => {
    const song = createSong()
    const barId = song.sections[0].bars[0].id
    expect(setBarSteps(song, barId, 0).sections[0].bars[0].slots).toHaveLength(1)
    expect(setBarSteps(song, barId, 99).sections[0].bars[0].slots).toHaveLength(32)
    expect(setBarSteps(song, barId, 3).sections[0].bars[0].slots).toHaveLength(3)
  })

  it('inserts an empty step between chords, taking up a trailing gap first', () => {
    const song = songWithSlots(['Em7', 'A7', 'DΔ7'])
    const bar = song.sections[0].bars[0]
    const location = { sectionId: song.sections[0].id, barId: bar.id, slotIndex: 1 }

    const before = insertSlotAt(song, location, 'before')
    expect(before?.location.slotIndex).toBe(1)
    expect(
      before?.song.sections[0].bars[0].slots.map((s) => s?.chordSymbol ?? null)
    ).toEqual(['Em7', null, 'A7', 'DΔ7'])

    const after = insertSlotAt(song, location, 'after')
    expect(after?.location.slotIndex).toBe(2)
    expect(
      after?.song.sections[0].bars[0].slots.map((s) => s?.chordSymbol ?? null)
    ).toEqual(['Em7', 'A7', null, 'DΔ7'])
  })

  it('widens a full group by one step to make room for an insert', () => {
    const song = songWithSlots(['Em7', 'A7', 'DΔ7', 'GΔ7'])
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    const opened = insertSlotAt(song, location, 'after')
    expect(
      opened?.song.sections[0].bars[0].slots.map((s) => s?.chordSymbol ?? null)
    ).toEqual(['Em7', null, 'A7', 'DΔ7', 'GΔ7'])
  })

  it('refuses to insert once a group holds the maximum number of chords', () => {
    const filled = {
      ...createSong('Full'),
      sections: [
        packEntriesIntoSection(
          Array.from({ length: 32 }, (_, i) =>
            slot({ id: `f${i}`, chordSymbol: 'CΔ7' })
          ),
          'A',
          32
        ),
      ],
    }
    const location = {
      sectionId: filled.sections[0].id,
      barId: filled.sections[0].bars[0].id,
      slotIndex: 0,
    }
    expect(canInsertSlotAt(filled, location, 'after')).toBe(false)
    expect(insertSlotAt(filled, location, 'after')).toBeNull()

    const roomy = songWithSlots(['Em7', 'A7'])
    const roomyLocation = {
      sectionId: roomy.sections[0].id,
      barId: roomy.sections[0].bars[0].id,
      slotIndex: 0,
    }
    expect(canInsertSlotAt(roomy, roomyLocation, 'after')).toBe(true)
  })

  it('appends a step after the last chord in a group', () => {
    const song = songWithSlots(['Em7', 'A7', 'DΔ7', 'GΔ7'])
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 3,
    }
    expect(canInsertSlotAt(song, location, 'after')).toBe(true)
    const opened = insertSlotAt(song, location, 'after')
    expect(opened?.location.slotIndex).toBe(4)
    expect(
      opened?.song.sections[0].bars[0].slots.map((s) => s?.chordSymbol ?? null)
    ).toEqual(['Em7', 'A7', 'DΔ7', 'GΔ7', null])
  })

  it('keeps a trailing gap when inserting after the second-to-last chord', () => {
    const song = songWithSlots(['Em7', 'A7', 'DΔ7'])
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 2,
    }
    const opened = insertSlotAt(song, location, 'after')
    expect(opened?.location.slotIndex).toBe(3)
    expect(
      opened?.song.sections[0].bars[0].slots.map((s) => s?.chordSymbol ?? null)
    ).toEqual(['Em7', 'A7', 'DΔ7', null])
  })

  it('cannot append past the last step of a group already at the maximum', () => {
    const full = {
      ...createSong('Full'),
      sections: [
        packEntriesIntoSection(
          Array.from({ length: 31 }, (_, i) =>
            slot({ id: `g${i}`, chordSymbol: 'CΔ7' })
          ),
          'A',
          32
        ),
      ],
    }
    const bar = full.sections[0].bars[0]
    expect(bar.slots).toHaveLength(32)
    const last = { sectionId: full.sections[0].id, barId: bar.id, slotIndex: 31 }
    expect(canInsertSlotAt(full, last, 'after')).toBe(false)
    expect(insertSlotAt(full, last, 'after')).toBeNull()

    // Anywhere earlier can still shift into that trailing gap.
    const inner = { ...last, slotIndex: 0 }
    expect(canInsertSlotAt(full, inner, 'after')).toBe(true)
    expect(
      insertSlotAt(full, inner, 'after')?.song.sections[0].bars[0].slots
    ).toHaveLength(32)
  })

  it('removes a step and pulls the later chords back', () => {
    const song = songWithSlots(['Em7', 'A7', 'DΔ7', 'GΔ7'])
    const bar = song.sections[0].bars[0]
    const closed = removeStepAt(song, {
      sectionId: song.sections[0].id,
      barId: bar.id,
      slotIndex: 1,
    })
    expect(
      closed.sections[0].bars[0].slots.map((s) => s?.chordSymbol ?? null)
    ).toEqual(['Em7', 'DΔ7', 'GΔ7'])
  })

  it('clears the chord instead of emptying a one-step group', () => {
    const song = songWithSlots(['Em7'])
    const narrowed = setBarSteps(song, song.sections[0].bars[0].id, 1)
    const bar = narrowed.sections[0].bars[0]
    const closed = removeStepAt(narrowed, {
      sectionId: narrowed.sections[0].id,
      barId: bar.id,
      slotIndex: 0,
    })
    expect(closed.sections[0].bars[0].slots).toEqual([null])
  })

  it('sizes each step so a measure still lasts four beats', () => {
    expect(stepSeconds(60, 4)).toBe(1)
    expect(stepSeconds(60, 2)).toBe(2)
    expect(stepSeconds(60, 1)).toBe(4)
    expect(stepSeconds(60, 8)).toBe(0.5)
    expect(stepSeconds(60, 3)).toBeCloseTo(4 / 3)
  })

  it('packs leftover chords into a new bar', () => {
    const section = packEntriesIntoSection([
      slot({ chordSymbol: 'Em7' }),
      slot({ chordSymbol: 'A7' }),
      slot({ chordSymbol: 'DΔ7' }),
      slot({ chordSymbol: 'GΔ7' }),
      slot({ chordSymbol: 'CΔ7' }),
    ])
    expect(section.bars).toHaveLength(2)
    expect(section.bars[0].slots.map((s) => s?.chordSymbol)).toEqual([
      'Em7',
      'A7',
      'DΔ7',
      'GΔ7',
    ])
    expect(section.bars[1].slots.map((s) => s?.chordSymbol ?? null)).toEqual([
      'CΔ7',
      null,
      null,
      null,
    ])
  })

  it('adds to the highlighted step even when an earlier beat is empty', () => {
    const song = songWithSlots(['Em7'])
    const bar = song.sections[0].bars[0]
    const preferred = {
      sectionId: song.sections[0].id,
      barId: bar.id,
      slotIndex: 3,
    }
    expect(firstEmptyLocation(song)?.slotIndex).toBe(1)
    expect(resolveAddLocation(song, preferred).location.slotIndex).toBe(3)
    expect(
      resolveAddLocation(song, {
        sectionId: song.sections[0].id,
        barId: 'missing',
        slotIndex: 0,
      }).location.slotIndex
    ).toBe(1)
  })

  it('keeps the highlighted step when replacing a filled chord', () => {
    const song = songWithSlots(['Em7', 'A7'])
    const preferred = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    expect(resolveAddLocation(song, preferred).location.slotIndex).toBe(0)
  })

  it('walks forward to the next empty step after a fill', () => {
    const song = songWithSlots(['Em7'])
    const after = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 1,
    }
    const filled = placeSlot(
      song,
      after,
      slot({ id: 'later', chordSymbol: 'DMaj7' })
    )
    expect(nextEmptyAfter(filled, after)?.slotIndex).toBe(2)
  })

  it('finds the first empty beat and appends a bar when the grid is full', () => {
    const full = songWithSlots(['Em7', 'A7', 'DΔ7', 'GΔ7'])
    expect(firstEmptyLocation(full)).toBeNull()

    const prepared = appendBarIfNeeded(full)
    expect(prepared.song.sections[0].bars).toHaveLength(2)
    expect(prepared.song.sections[0].bars[1].slots).toHaveLength(1)
    expect(prepared.location.slotIndex).toBe(0)
    expect(prepared.location.barId).toBe(prepared.song.sections[0].bars[1].id)
  })

  it('swaps two occupied steps', () => {
    const song = songWithSlots(['Em7', 'A7'])
    const bar = song.sections[0].bars[0]
    const moved = moveSlot(
      song,
      { sectionId: song.sections[0].id, barId: bar.id, slotIndex: 0 },
      { sectionId: song.sections[0].id, barId: bar.id, slotIndex: 1 }
    )
    expect(moved.sections[0].bars[0].slots.map((s) => s?.chordSymbol ?? null)).toEqual([
      'A7',
      'Em7',
      null,
      null,
    ])
  })

  it('moves onto an empty step and leaves the source empty', () => {
    const song = songWithSlots(['Em7', 'A7'])
    const bar = song.sections[0].bars[0]
    const moved = moveSlot(
      song,
      { sectionId: song.sections[0].id, barId: bar.id, slotIndex: 0 },
      { sectionId: song.sections[0].id, barId: bar.id, slotIndex: 2 }
    )
    expect(moved.sections[0].bars[0].slots.map((s) => s?.chordSymbol ?? null)).toEqual([
      null,
      'A7',
      'Em7',
      null,
    ])
  })

  it('leaves the song unchanged when moving a slot onto itself', () => {
    const song = songWithSlots(['Em7'])
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    expect(moveSlot(song, location, location)).toBe(song)
  })

  it('walks empty steps in the play timeline without giving them time', () => {
    const song = songWithSlots(['Em7'])
    const events = playTimeline({ ...song, bpm: 60 })
    expect(events).toHaveLength(BEATS_PER_BAR)
    expect(events[0].slot?.chordSymbol).toBe('Em7')
    expect(slotBeats(events[0].slot)).toBe(4)
    expect(events[0].seconds).toBe(4)
    expect(events.slice(1).every((e) => e.slot === null)).toBe(true)
    expect(events.slice(1).every((e) => e.seconds === 0)).toBe(true)
    expect(events.map((e) => e.index)).toEqual([0, 1, 2, 3])
  })

  it('lets each chord choose how many beats it lasts', () => {
    const song = songWithSlots(['Em7', 'A7'])
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    const next = patchSlot({ ...song, bpm: 60 }, location, { beats: 2 })
    const events = playTimeline(next)
    expect(events[0].seconds).toBe(2)
    expect(events[1].seconds).toBe(4)
    expect(next.sections[0].bars[0].slots[0]?.beats).toBe(2)
    expect(patchSlot(next, location, { beats: 4 }).sections[0].bars[0].slots[0]?.beats).toBeUndefined()
  })

  it('clones a slot with a new id', () => {
    const original = slot({
      id: 'same',
      chordSymbol: 'Em7',
      note: 'hold',
      highlightedNotes: [
        { string: 2, fret: 8 },
        { string: 5, fret: 0 },
      ],
    })
    const copy = cloneSlot(original)
    expect(copy.id).not.toBe(original.id)
    expect(copy.chordSymbol).toBe('Em7')
    expect(copy.note).toBe('hold')
    expect(copy.highlightedNotes).toEqual([
      { string: 2, fret: 8 },
      { string: 5, fret: 0 },
    ])
  })

  it('toggles outlined notes on empty diagram cells', () => {
    const mark = { string: 5, fret: 7 }
    expect(toggleHighlightedNote(undefined, mark)).toEqual([mark])
    expect(toggleHighlightedNote([mark], mark)).toBeUndefined()
    expect(
      toggleHighlightedNote(
        [
          { string: 1, fret: 5 },
          { string: 4, fret: 8 },
        ],
        { string: 3, fret: 6 }
      )
    ).toEqual([
      { string: 1, fret: 5 },
      { string: 3, fret: 6 },
      { string: 4, fret: 8 },
    ])

    const song = songWithSlots(['Em7'])
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    const highlighted = toggleSlotHighlight(song, location, mark)
    expect(highlighted.sections[0].bars[0].slots[0]?.highlightedNotes).toEqual([
      mark,
    ])
    const cleared = toggleSlotHighlight(highlighted, location, mark)
    expect(cleared.sections[0].bars[0].slots[0]?.highlightedNotes).toBeUndefined()
  })

  it('adds and removes extra diagram fret rows', () => {
    const song = songWithSlots(['Em7'])
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    const high = adjustSlotFretExtend(song, location, 'high', 2)
    expect(high.sections[0].bars[0].slots[0]?.extendHigh).toBe(2)
    const low = adjustSlotFretExtend(high, location, 'low', 1)
    expect(low.sections[0].bars[0].slots[0]?.extendLow).toBe(1)
    const clearedHigh = adjustSlotFretExtend(low, location, 'high', -2)
    expect(clearedHigh.sections[0].bars[0].slots[0]?.extendHigh).toBeUndefined()
  })

  it('duplicates a measure immediately after the original', () => {
    const song = songWithSlots(['Em7', 'A7'])
    const section = song.sections[0]
    const bar = section.bars[0]
    const next = duplicateBar(song, section.id, bar.id)

    expect(next.sections[0].bars).toHaveLength(2)
    const [first, copy] = next.sections[0].bars
    expect(copy.id).not.toBe(first.id)
    expect(copy.slots.map((item) => item?.chordSymbol ?? null)).toEqual(
      first.slots.map((item) => item?.chordSymbol ?? null)
    )
    expect(copy.slots[0]?.id).not.toBe(first.slots[0]?.id)

    const missing = duplicateBar(song, section.id, 'nope')
    expect(missing.sections[0].bars).toHaveLength(1)
  })

  it('duplicates a section immediately after the original', () => {
    const song = songWithSlots(['Em7', 'A7'])
    const section = song.sections[0]
    const next = duplicateSection(song, section.id)
    expect(next.sections).toHaveLength(2)
    const [first, copy] = next.sections
    expect(copy.id).not.toBe(first.id)
    expect(copy.name).toBe(`${first.name} copy`)
    expect(copy.collapsed).toBeFalsy()
    expect(copy.bars).toHaveLength(first.bars.length)
    expect(copy.bars[0].id).not.toBe(first.bars[0].id)
    expect(copy.bars[0].slots[0]?.id).not.toBe(first.bars[0].slots[0]?.id)
    expect(copy.bars[0].slots[0]?.chordSymbol).toBe(
      first.bars[0].slots[0]?.chordSymbol
    )

    const collapsed = setSectionCollapsed(next, first.id, true)
    expect(collapsed.sections[0].collapsed).toBe(true)
    const opened = setSectionCollapsed(collapsed, first.id, false)
    expect(opened.sections[0].collapsed).toBeUndefined()

    expect(duplicateSection(song, 'nope').sections).toHaveLength(1)
  })

  it('collapses a group and persists that on reload', () => {
    const song = createSong('Demo')
    const bar = song.sections[0].bars[0]
    const collapsed = setBarCollapsed(song, bar.id, true)
    expect(collapsed.sections[0].bars[0].collapsed).toBe(true)
    const roundTrip = normalizeSong(JSON.parse(JSON.stringify(collapsed)))
    expect(roundTrip?.sections[0].bars[0].collapsed).toBe(true)
    expect(setBarCollapsed(collapsed, bar.id, false).sections[0].bars[0].collapsed).toBeUndefined()
    const copy = duplicateBar(collapsed, song.sections[0].id, bar.id)
    expect(copy.sections[0].bars[1].collapsed).toBeUndefined()
  })

  it('names a group and keeps the title through save, copy, and export', () => {
    const song = createSong('Demo')
    const bar = song.sections[0].bars[0]
    const named = setBarName(song, bar.id, 'Turnaround')
    expect(named.sections[0].bars[0].name).toBe('Turnaround')
    const roundTrip = normalizeSong(JSON.parse(JSON.stringify(named)))
    expect(roundTrip?.sections[0].bars[0].name).toBe('Turnaround')
    const copy = duplicateBar(named, named.sections[0].id, bar.id)
    expect(copy.sections[0].bars[1].name).toBe('Turnaround')
    expect(exportSong(named)).toContain('m1 Turnaround (4).')
    expect(setBarName(named, bar.id, '').sections[0].bars[0].name).toBeUndefined()
  })

  it('swaps two measures in the same section', () => {
    const song = songWithSlots([
      'Em7',
      'A7',
      'DΔ7',
      'GΔ7',
      'CΔ7',
      'FΔ7',
      'BbΔ7',
      'EbΔ7',
      'AbΔ7',
    ])
    const section = song.sections[0]
    expect(section.bars).toHaveLength(3)
    const [first, second, third] = section.bars
    const swapped = moveBar(
      song,
      { sectionId: section.id, barId: first.id },
      { sectionId: section.id, beforeBarId: third.id }
    )
    expect(swapped.sections[0].bars.map((bar) => bar.id)).toEqual([
      third.id,
      second.id,
      first.id,
    ])
    expect(swapped.sections[0].bars[0].slots[0]?.chordSymbol).toBe('AbΔ7')
    expect(swapped.sections[0].bars[2].slots[0]?.chordSymbol).toBe('Em7')
  })

  it('leaves the song unchanged when dropping a measure on itself', () => {
    const song = songWithSlots(['Em7'])
    const section = song.sections[0]
    const bar = section.bars[0]
    expect(
      moveBar(
        song,
        { sectionId: section.id, barId: bar.id },
        { sectionId: section.id, beforeBarId: bar.id }
      )
    ).toBe(song)
  })

  it('places a slot and reports a stable location key', () => {
    const song = createSong()
    const location = firstEmptyLocation(song)!
    const next = placeSlot(song, location, slot({ chordSymbol: 'A7' }))
    expect(countSlots(next)).toBe(1)
    expect(locationKey(location)).toBe(
      `${location.sectionId}:${location.barId}:${location.slotIndex}`
    )
    expect(locationsEqual(location, location)).toBe(true)
  })

  it('exports sections, bars, and notes as text', () => {
    let song = songWithSlots(['Em7', 'A7'])
    const section = song.sections[0]
    const bar = section.bars[0]
    song = {
      ...song,
      name: 'Tune',
      bpm: 120,
      playback: 'arp-up',
      sections: [
        {
          ...section,
          name: 'Verse',
          note: 'keep it sparse',
          bars: [
            {
              ...bar,
              name: 'Intro',
              slots: bar.slots.map((s, i) =>
                i === 0 && s ? { ...s, note: 'bass on 1' } : s
              ),
            },
          ],
        },
      ],
    }
    const text = exportSong(song)
    expect(text).toContain('Tune')
    expect(text).toContain('120 bpm')
    expect(text).toContain('m1 Intro (4).')
    expect(text).toContain('[Verse]')
    expect(text).toContain('keep it sparse')
    expect(text).toContain('E-7')
    expect(text).toContain('E-7: bass on 1')
  })

  it('packs every sequence into a library backup that imports additively', () => {
    const first = songWithSlots(['Em7'])
    first.name = 'Autumn'
    const second = createSong('Blues')
    const library = libraryForJsonExport([first, second])
    expect(library.format).toBe('chord-cosmos.library.v1')
    expect(library.songs).toHaveLength(2)
    expect(JSON.stringify(library)).not.toContain('lineAudio')
    const read = readImportedSongs(library)
    expect(read.map((song) => song.name)).toEqual(['Autumn', 'Blues'])
  })

  it('parses and formats strum patterns', () => {
    expect(parseStrumPattern(undefined)).toEqual(['d'])
    expect(parseStrumPattern('D-U-x')).toEqual(['d', 'u', 'x'])
    expect(normalizeStrumPattern('')).toBeUndefined()
    expect(normalizeStrumPattern('Dudu')).toBe('dudu')
    expect(formatStrumPattern('ddudud')).toBe('D-D-U-U-D-U')
  })

  it('patches a slot feel and can return it to the song default', () => {
    const song = songWithSlots(['Em7'])
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    const overridden = patchSlot(song, location, {
      playback: 'arp-down',
      strumPattern: 'du',
    })
    expect(overridden.sections[0].bars[0].slots[0]?.playback).toBe('arp-down')
    expect(overridden.sections[0].bars[0].slots[0]?.strumPattern).toBe('du')

    const cleared = patchSlot(overridden, location, {
      playback: undefined,
      strumPattern: undefined,
    })
    expect(cleared.sections[0].bars[0].slots[0]?.playback).toBeUndefined()
    expect(cleared.sections[0].bars[0].slots[0]?.strumPattern).toBeUndefined()

    const strum = patchSlot(overridden, location, { playback: 'strum' })
    expect(strum.sections[0].bars[0].slots[0]?.playback).toBeUndefined()
    expect(
      patchSlot(overridden, location, { strumPattern: 'd' }).sections[0].bars[0]
        .slots[0]?.strumPattern
    ).toBeUndefined()
  })

  it('bumps a slot up an octave and still hydrates the high-fret tab', () => {
    const song = songWithSlots(['Em7'])
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    const before = hydrateSlot(song.sections[0].bars[0].slots[0]!)
    expect(before.fingering).not.toBeNull()

    const marked = toggleSlotHighlight(song, location, { string: 5, fret: 8 })
    const up = shiftSlotOctave(marked, location, 12)
    const shifted = up.sections[0].bars[0].slots[0]
    expect(shifted?.tab).not.toBe(song.sections[0].bars[0].slots[0]?.tab)
    expect(shifted?.highlightedNotes).toEqual([{ string: 5, fret: 20 }])
    expect(shifted?.tab.split('-').some((part) => Number(part) >= 12)).toBe(true)

    const hydrated = hydrateSlot(shifted!)
    expect(hydrated.fingering).not.toBeNull()
    expect(hydrated.fingering!.lowestFret).toBe(before.fingering!.lowestFret + 12)

    const back = shiftSlotOctave(up, location, -12)
    expect(back.sections[0].bars[0].slots[0]?.tab).toBe(
      song.sections[0].bars[0].slots[0]?.tab
    )
  })

  it('swaps a slot for another fingering of the same chord and group', () => {
    const result = generateGroup(parseChord('Em7'), V_GROUPS_BY_ID['V-2'], {
      includeVariants: true,
    })
    const first = result.inversions[0].voicings[0]
    expect(first).toBeDefined()
    const song = createSong('Dice')
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    const placed = placeSlot(
      song,
      location,
      slot({
        chordSymbol: 'Em7',
        groupId: 'V-2',
        inversion: 0,
        tab: tabLabel(first!.fingering),
        highlightedNotes: [{ string: 5, fret: 8 }],
      })
    )
    expect(canRandomizeSlotShape(placed.sections[0].bars[0].slots[0])).toBe(true)

    const rolled = randomizeSlotShape(placed, location, () => 0)
    const next = rolled.sections[0].bars[0].slots[0]
    expect(next?.chordSymbol).toBe('Em7')
    expect(next?.groupId).toBe('V-2')
    expect(next?.tab).not.toBe(tabLabel(first!.fingering))
    expect(next?.highlightedNotes).toBeUndefined()
    expect(hydrateSlot(next!).fingering).not.toBeNull()
    const workshop = voicingForSlot(next!)
    expect(workshop?.groupId).toBe('V-2')
    expect(workshop?.chordSymbol).toBe('E-7')
    expect(tabLabel(workshop!.fingering)).toBe(next!.tab)
  })

  it('leaves a line or a one-shape family alone', () => {
    const song = songWithSlots(['Em7'])
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    const lined = placeSlot(song, location, {
      id: 'line-1',
      chordSymbol: 'Line',
      groupId: 'Line',
      inversion: 0,
      tab: 'x-x-x-x-x-x',
      note: '',
      lineNotes: [{ string: 5, fret: 8 }],
    })
    expect(canRandomizeSlotShape(lined.sections[0].bars[0].slots[0])).toBe(false)
    expect(randomizeSlotShape(lined, location)).toBe(lined)

    const custom = placeSlot(
      song,
      location,
      slot({ chordSymbol: 'C', groupId: 'Custom', tab: 'x-3-2-0-1-0' })
    )
    expect(canRandomizeSlotShape(custom.sections[0].bars[0].slots[0])).toBe(false)
    expect(randomizeSlotShape(custom, location)).toBe(custom)
  })

  it('hydrates a hand-built fretboard chord from its tab', () => {
    const song = createSong('Custom')
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    const placed = placeSlot(
      song,
      location,
      slot({
        chordSymbol: 'C',
        groupId: 'Custom',
        tab: 'x-3-2-0-1-0',
      })
    )
    const hydrated = hydrateSlot(placed.sections[0].bars[0].slots[0]!)
    expect(hydrated.fingering?.notes).toHaveLength(5)
    expect(hydrated.shape?.group.id).toBe('Custom')
    expect(hydrated.shape?.voiceTones[0]?.degree).toBe('R')

    const up = shiftSlotOctave(placed, location, 12)
    expect(up.sections[0].bars[0].slots[0]?.tab).toBe('x-15-14-12-13-12')
  })

  it('hydrates a crossed V-System tab with the original voice labels', () => {
    const result = generateGroup(parseChord('Em7'), V_GROUPS_BY_ID['V-2'], {
      includeVariants: true,
    })
    const crossed = result.inversions[0].crossed?.[0]
    expect(crossed).toBeDefined()
    const song = createSong('Cross')
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    const placed = placeSlot(
      song,
      location,
      slot({
        chordSymbol: 'Em7',
        groupId: 'V-2',
        inversion: 0,
        tab: tabLabel(crossed!.fingering),
      })
    )
    const hydrated = hydrateSlot(placed.sections[0].bars[0].slots[0]!)
    expect(hydrated.fingering?.notes.map((n) => n.voice)).toEqual(
      crossed!.fingering.notes.map((n) => n.voice)
    )
    expect(hydrated.fingering?.notes).toHaveLength(4)
  })

  it('hydrates a crossed triad tab with the original voice labels', () => {
    const result = generateTriadGroup(
      parseChord('C'),
      TRIAD_GROUPS_BY_ID.Close,
      { includeVariants: true }
    )
    const crossed = result.inversions[0].crossed?.[0]
    expect(crossed).toBeDefined()
    const song = createSong('Cross triad')
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    const placed = placeSlot(
      song,
      location,
      slot({
        chordSymbol: 'C',
        groupId: 'Close',
        inversion: 0,
        tab: tabLabel(crossed!.fingering),
      })
    )
    const hydrated = hydrateSlot(placed.sections[0].bars[0].slots[0]!)
    expect(hydrated.fingering?.notes.map((n) => n.voice)).toEqual(
      crossed!.fingering.notes.map((n) => n.voice)
    )
    expect(hydrated.fingering?.notes).toHaveLength(3)
  })
})

describe('persistence and migration', () => {
  const store: Record<string, string> = {}

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key]
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        for (const key of Object.keys(store)) delete store[key]
      },
    })
  })

  it('migrates a v1 linear sequence into packed bars', () => {
    store[LEGACY_STORAGE_KEY] = JSON.stringify({
      activeSongId: 'song-1',
      songs: [
        {
          id: 'song-1',
          name: 'Old tune',
          createdAt: 1,
          updatedAt: 2,
          entries: [
            {
              id: 'a',
              chordSymbol: 'Em7',
              groupId: 'V-2',
              inversion: 0,
              tab: 'x-7-9-7-8-x',
            },
            {
              id: 'b',
              chordSymbol: 'A7',
              groupId: 'V-2',
              inversion: 0,
              tab: '5-x-6-6-5-x',
            },
            {
              id: 'c',
              chordSymbol: 'DΔ7',
              groupId: 'V-1',
              inversion: 1,
              tab: 'x-5-4-6-5-x',
            },
          ],
        },
      ],
    })

    const loaded = loadState()
    expect(loaded.songs).toHaveLength(1)
    const song = loaded.songs[0]
    expect(song.bpm).toBe(DEFAULT_BPM)
    expect(song.playback).toBe('strum')
    expect(countSlots(song)).toBe(3)
    expect(song.sections[0].bars[0].slots.map((s) => s?.chordSymbol ?? null)).toEqual([
      'Em7',
      'A7',
      'DΔ7',
      null,
    ])
  })

  it('round-trips a v2 song through localStorage', () => {
    const song = songWithSlots(['CΔ7'])
    saveState({ songs: [song], activeSongId: song.id })
    expect(store[STORAGE_KEY]).toBeTruthy()

    const loaded = loadState()
    expect(loaded.activeSongId).toBe(song.id)
    expect(loaded.songs[0].sections[0].bars[0].slots[0]?.chordSymbol).toBe('CΔ7')
    expect(loaded.songs[0].sections[0].bars[0].slots).toHaveLength(4)
  })

  it('keeps different step counts on each stored measure', () => {
    const song = createSong('Mixed')
    const first = setBarSteps(song, song.sections[0].bars[0].id, 3)
    const secondBar = {
      ...first.sections[0].bars[0],
      id: 'm2',
      slots: Array.from({ length: 7 }, () => null),
    }
    const mixed: Song = {
      ...first,
      sections: [
        {
          ...first.sections[0],
          bars: [first.sections[0].bars[0], secondBar],
        },
      ],
    }
    saveState({ songs: [mixed], activeSongId: mixed.id })
    const loaded = loadState()
    expect(loaded.songs[0].sections[0].bars[0].slots).toHaveLength(3)
    expect(loaded.songs[0].sections[0].bars[1].slots).toHaveLength(7)
  })

  it('clamps stored tempos and rejects unknown playback styles', () => {
    store[STORAGE_KEY] = JSON.stringify({
      activeSongId: 's',
      songs: [
        {
          id: 's',
          name: 'Wild',
          bpm: 999,
          playback: 'scramble',
          sections: [emptySection('A')],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    })
    const loaded = loadState()
    expect(loaded.songs[0].bpm).toBe(220)
    expect(loaded.songs[0].playback).toBe('strum')
  })

  it('keeps a song strum pattern and per-slot feel overrides', () => {
    const song = songWithSlots(['Em7'])
    const section = song.sections[0]
    const bar = section.bars[0]
    store[STORAGE_KEY] = JSON.stringify({
      activeSongId: song.id,
      songs: [
        {
          ...song,
          strumPattern: 'Dudu',
          sections: [
            {
              ...section,
              bars: [
                {
                  ...bar,
                  slots: bar.slots.map((item, index) =>
                    index === 0 && item
                      ? { ...item, playback: 'arp-up', strumPattern: 'dxdx' }
                      : item
                  ),
                },
              ],
            },
          ],
        },
      ],
    })
    const loaded = loadState()
    expect(loaded.songs[0].strumPattern).toBe('dudu')
    expect(loaded.songs[0].sections[0].bars[0].slots[0]?.playback).toBe('arp-up')
    expect(loaded.songs[0].sections[0].bars[0].slots[0]?.strumPattern).toBe(
      'dxdx'
    )
  })
})
