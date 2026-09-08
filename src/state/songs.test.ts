import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BEATS_PER_BAR,
  DEFAULT_BPM,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  appendBarIfNeeded,
  cloneSlot,
  duplicateBar,
  duplicateSection,
  setSectionCollapsed,
  moveBar,
  cloneSong,
  countSlots,
  createSong,
  emptySection,
  songForJsonExport,
  exportSong,
  firstEmptyLocation,
  nextEmptyAfter,
  resolveAddLocation,
  loadState,
  locationKey,
  locationsEqual,
  formatStrumPattern,
  moveSlot,
  normalizeStrumPattern,
  packEntriesIntoSection,
  parseStrumPattern,
  hydrateSlot,
  patchSlot,
  placeSlot,
  toggleHighlightedNote,
  toggleSlotHighlight,
  adjustSlotFretExtend,
  shiftSlotOctave,
  playTimeline,
  readImportedSongs,
  saveState,
  slotFromVoicingPayload,
  slotFromLineNotes,
  slotMidiNotes,
  setBarSteps,
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
      { string: 4, fret: 8 },
      { string: 5, fret: 7 },
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
      { string: 3, fret: 9 },
      { string: 4, fret: 8 },
      { string: 5, fret: 7 },
      { string: 5, fret: 10 },
    ])

    const up = shiftSlotOctave(placed, location, 12)
    expect(up.sections[0].bars[0].slots[0]?.lineNotes).toEqual([
      { string: 4, fret: 20 },
      { string: 5, fret: 19 },
      { string: 5, fret: 22 },
    ])

    const withTake = patchSlot(placed, location, {
      lineAudio: {
        mimeType: 'audio/webm',
        duration: 1.25,
        data: `data:audio/webm;base64,${'A'.repeat(40)}`,
      },
    })
    expect(withTake.sections[0].bars[0].slots[0]?.lineAudio?.duration).toBe(1.25)
    const cloned = cloneSlot(withTake.sections[0].bars[0].slots[0]!)
    expect(cloned.lineAudio?.data).toBe(
      withTake.sections[0].bars[0].slots[0]?.lineAudio?.data
    )
    const cleared = patchSlot(withTake, location, { lineAudio: undefined })
    expect(cleared.sections[0].bars[0].slots[0]?.lineAudio).toBeUndefined()
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
    expect(text).toContain('m1 (4).')
    expect(text).toContain('[Verse]')
    expect(text).toContain('keep it sparse')
    expect(text).toContain('E-7')
    expect(text).toContain('E-7: bass on 1')
  })

  it('omits microphone takes from JSON export', () => {
    const song = songWithSlots(['Em7'])
    const location = {
      sectionId: song.sections[0].id,
      barId: song.sections[0].bars[0].id,
      slotIndex: 0,
    }
    const withTake = patchSlot(song, location, {
      lineAudio: {
        mimeType: 'audio/webm',
        duration: 1,
        data: `data:audio/webm;base64,${'A'.repeat(40)}`,
      },
    })
    expect(JSON.stringify(songForJsonExport(withTake))).not.toContain('lineAudio')
    expect(withTake.sections[0].bars[0].slots[0]?.lineAudio).toBeDefined()
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
