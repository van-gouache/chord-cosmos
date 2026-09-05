/**
 * Songs are a grid: sections contain measures, and each measure is divided
 * into a configurable number of steps. A step holds one chord (or a rest).
 */

import { displayChordSymbol, tryParseChord } from '../theory/chords'
import {
  customShapeFromFingering,
  fingeringFromCustomTab,
  isCustomGroupId,
  rootFromCustomSymbol,
  shiftCustomFingering,
} from '../theory/customVoicing'
import {
  fingeringFromTab,
  MAX_PLAYABLE_FRET,
  shiftFingering,
  tabLabel,
  type Fingering,
} from '../theory/fretboard'
import {
  generateTriadGroup,
  isTriadGroupId,
  TRIAD_GROUPS_BY_ID,
} from '../theory/triads'
import { buildShape, V_GROUPS_BY_ID, type VoicingShape } from '../theory/vsystem'
import { generateGroup, voicingMatchingTab, type Voicing } from '../theory/voicings'

export const STORAGE_KEY = 'chord-cosmos.songs.v2'
export const LEGACY_STORAGE_KEY = 'chord-cosmos.songs.v1'

export const BEATS_PER_MEASURE = 4
export const DEFAULT_STEPS_PER_MEASURE = 4
export const MIN_STEPS_PER_MEASURE = 1
export const MAX_STEPS_PER_MEASURE = 32
/** @deprecated Use DEFAULT_STEPS_PER_MEASURE — kept for existing tests. */
export const BEATS_PER_BAR = DEFAULT_STEPS_PER_MEASURE
export const MIN_BPM = 40
export const MAX_BPM = 220
export const DEFAULT_BPM = 90

export type PlaybackStyle = 'strum' | 'arp-up' | 'arp-down'
export type StrumStroke = 'd' | 'u' | 'x'

export const DEFAULT_STRUM_PATTERN = 'd'

export const STRUM_PATTERNS: {
  id: string
  label: string
  hint: string
}[] = [
  { id: 'd', label: 'Down', hint: 'Single downstroke' },
  { id: 'du', label: 'D-U', hint: 'Down, then up' },
  { id: 'dudu', label: 'D-U-D-U', hint: 'Even eighths' },
  { id: 'ddu', label: 'D-D-U', hint: 'Two downs, then up' },
  { id: 'ddudud', label: 'D-D-U-U-D-U', hint: 'Folk / pop' },
  { id: 'dxdx', label: 'D-·-D-·', hint: 'Downs on the beat' },
  { id: 'dudx', label: 'D-U-D-·', hint: 'Three strums, then a rest' },
]

export interface SequenceSlot {
  id: string
  chordSymbol: string
  groupId: string
  inversion: number
  tab: string
  note: string
  /** When set, this step ignores the song-level feel. */
  playback?: PlaybackStyle
  /** Down/up/rest strokes for this step when it strums. */
  strumPattern?: string
  /** Extra outline markers on empty string/fret cells of the diagram. */
  highlightedNotes?: HighlightedNote[]
  /** Extra fret rows toward the nut, beyond the automatic box. */
  extendLow?: number
  /** Extra fret rows toward the body, beyond the automatic box. */
  extendHigh?: number
}

export interface HighlightedNote {
  /** 0 = low E, 5 = high E. */
  string: number
  /** 0 = open. */
  fret: number
}

export interface Bar {
  id: string
  slots: (SequenceSlot | null)[]
}

export interface Section {
  id: string
  name: string
  note: string
  bars: Bar[]
}

export interface Song {
  id: string
  name: string
  bpm: number
  playback: PlaybackStyle
  /** Default down/up pattern when a step strums. */
  strumPattern?: string
  sections: Section[]
  createdAt: number
  updatedAt: number
}

export interface SlotLocation {
  sectionId: string
  barId: string
  slotIndex: number
}

export interface HydratedSlot {
  slot: SequenceSlot
  location: SlotLocation
  shape: VoicingShape | null
  fingering: Fingering | null
}

export interface PlayEvent {
  slot: SequenceSlot | null
  location: SlotLocation | null
  /** Flattened playhead index, including rests. */
  index: number
  /** How long this step lasts so its measure still occupies four beats. */
  seconds: number
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function clampSteps(value: unknown): number {
  const n = typeof value === 'number' ? value : DEFAULT_STEPS_PER_MEASURE
  if (!Number.isFinite(n)) return DEFAULT_STEPS_PER_MEASURE
  return Math.min(
    MAX_STEPS_PER_MEASURE,
    Math.max(MIN_STEPS_PER_MEASURE, Math.round(n))
  )
}

export function barSteps(bar: Bar): number {
  return clampSteps(bar.slots.length)
}

export function lastBarSteps(song: Song, sectionId?: string): number {
  const section = sectionId
    ? song.sections.find((s) => s.id === sectionId)
    : song.sections[song.sections.length - 1]
  const last = section?.bars[section.bars.length - 1]
  return last ? barSteps(last) : DEFAULT_STEPS_PER_MEASURE
}

export function emptyBar(steps: number = DEFAULT_STEPS_PER_MEASURE): Bar {
  return {
    id: newId(),
    slots: Array.from({ length: clampSteps(steps) }, () => null),
  }
}

export function emptySection(
  name: string,
  steps: number = DEFAULT_STEPS_PER_MEASURE
): Section {
  return { id: newId(), name, note: '', bars: [emptyBar(steps)] }
}

export function createSong(name = 'Untitled sequence'): Song {
  const now = Date.now()
  return {
    id: newId(),
    name,
    bpm: DEFAULT_BPM,
    playback: 'strum',
    sections: [emptySection('A')],
    createdAt: now,
    updatedAt: now,
  }
}

/** Deep copy with fresh ids so the clone can live beside the original. */
export function cloneSong(song: Song, name = `${song.name} copy`): Song {
  const now = Date.now()
  return {
    ...song,
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    sections: song.sections.map((section) => ({
      ...section,
      id: newId(),
      bars: section.bars.map((bar) => ({
        ...bar,
        id: newId(),
        slots: bar.slots.map((slot) => (slot ? { ...slot, id: newId() } : null)),
      })),
    })),
  }
}

/** Seconds one step should last so a measure still occupies four beats. */
export function stepSeconds(bpm: number, steps: number): number {
  const width = clampSteps(steps)
  return (60 / Math.max(1, bpm)) * (BEATS_PER_MEASURE / width)
}

export function resizeBarSlots(
  slots: (SequenceSlot | null)[],
  steps: number
): (SequenceSlot | null)[] {
  const width = clampSteps(steps)
  return Array.from({ length: width }, (_, i) => slots[i] ?? null)
}

export function packSlots(
  slots: (SequenceSlot | null)[],
  steps: number
): Bar[] {
  const width = clampSteps(steps)
  const bars: Bar[] = []
  for (let i = 0; i < slots.length; i += width) {
    const chunk = slots.slice(i, i + width)
    bars.push({
      id: newId(),
      slots: resizeBarSlots(chunk, width),
    })
  }
  if (bars.length === 0) bars.push(emptyBar(width))
  return bars
}

export function setBarSteps(song: Song, barId: string, steps: number): Song {
  return mapBar(song, barId, (bar) => {
    const next = clampSteps(steps)
    if (next === bar.slots.length) return bar
    return { ...bar, slots: resizeBarSlots(bar.slots, next) }
  })
}

export function slotFromVoicing(voicing: Voicing, note = ''): SequenceSlot {
  return {
    id: newId(),
    chordSymbol: voicing.chordSymbol,
    groupId: voicing.groupId,
    inversion: voicing.inversion,
    tab: tabLabel(voicing.fingering),
    note,
  }
}

export const VOICING_DRAG_MIME = 'application/x-chord-voicing'

/** Compact payload so a workshop shape can be dropped onto the sequence. */
export function voicingPayload(voicing: Voicing): string {
  return JSON.stringify({
    chordSymbol: voicing.chordSymbol,
    groupId: voicing.groupId,
    inversion: voicing.inversion,
    tab: tabLabel(voicing.fingering),
  })
}

export function slotFromVoicingPayload(raw: string): SequenceSlot | null {
  try {
    const value = JSON.parse(raw) as Partial<SequenceSlot>
    if (typeof value.chordSymbol !== 'string' || typeof value.tab !== 'string') {
      return null
    }
    return {
      id: newId(),
      chordSymbol: value.chordSymbol,
      groupId: typeof value.groupId === 'string' ? value.groupId : 'V-2',
      inversion: typeof value.inversion === 'number' ? value.inversion : 0,
      tab: value.tab,
      note: '',
    }
  } catch {
    return null
  }
}

export function cloneSlot(slot: SequenceSlot): SequenceSlot {
  return {
    ...slot,
    id: newId(),
    highlightedNotes: slot.highlightedNotes?.map((note) => ({ ...note })),
  }
}

/** Deep copy of a measure with fresh ids so it can sit beside the original. */
export function cloneBar(bar: Bar): Bar {
  return {
    id: newId(),
    slots: bar.slots.map((slot) => (slot ? cloneSlot(slot) : null)),
  }
}

/** Swaps two measures, or moves one to the end of a section if `beforeBarId` is omitted. */
export function moveBar(
  song: Song,
  from: { sectionId: string; barId: string },
  to: { sectionId: string; beforeBarId?: string | null }
): Song {
  if (from.barId === to.beforeBarId) return song

  const fromSection = song.sections.find((section) => section.id === from.sectionId)
  const fromBar = fromSection?.bars.find((bar) => bar.id === from.barId)
  if (!fromSection || !fromBar) return song

  if (!to.beforeBarId) {
    const stripped = song.sections.map((section) => {
      if (section.id !== from.sectionId) return section
      const bars = section.bars.filter((bar) => bar.id !== from.barId)
      return {
        ...section,
        bars: bars.length > 0 ? bars : [emptyBar(barSteps(fromBar))],
      }
    })
    return {
      ...song,
      sections: stripped.map((section) => {
        if (section.id !== to.sectionId) return section
        const bars = section.bars.filter((bar) => bar.id !== fromBar.id)
        return { ...section, bars: [...bars, fromBar] }
      }),
    }
  }

  const toSection = song.sections.find((section) => section.id === to.sectionId)
  const toBar = toSection?.bars.find((bar) => bar.id === to.beforeBarId)
  if (!toSection || !toBar) return song

  return {
    ...song,
    sections: song.sections.map((section) => {
      if (section.id !== from.sectionId && section.id !== to.sectionId) {
        return section
      }
      return {
        ...section,
        bars: section.bars.map((bar) => {
          if (bar.id === from.barId) return toBar
          if (bar.id === to.beforeBarId) return fromBar
          return bar
        }),
      }
    }),
  }
}

/** Inserts a copy of the measure immediately after it. No-op if missing. */
export function duplicateBar(
  song: Song,
  sectionId: string,
  barId: string
): Song {
  return {
    ...song,
    sections: song.sections.map((section) => {
      if (section.id !== sectionId) return section
      const index = section.bars.findIndex((item) => item.id === barId)
      if (index < 0) return section
      const bars = [...section.bars]
      bars.splice(index + 1, 0, cloneBar(section.bars[index]))
      return { ...section, bars }
    }),
  }
}

export function hydrateSlot(slot: SequenceSlot): {
  shape: VoicingShape | null
  fingering: Fingering | null
} {
  if (isCustomGroupId(slot.groupId)) {
    const fingering = fingeringFromCustomTab(slot.tab)
    if (!fingering) return { shape: null, fingering: null }
    return {
      shape: customShapeFromFingering(
        fingering,
        rootFromCustomSymbol(slot.chordSymbol)
      ),
      fingering,
    }
  }

  const { chord } = tryParseChord(slot.chordSymbol)
  if (!chord) return { shape: null, fingering: null }

  if (isTriadGroupId(slot.groupId)) {
    const group = TRIAD_GROUPS_BY_ID[slot.groupId]
    const result = generateTriadGroup(chord, group, { includeVariants: true })
    const match = voicingMatchingTab(result.inversions[slot.inversion], slot.tab)
    return {
      shape: match?.shape ?? result.inversions[slot.inversion]?.shape ?? null,
      fingering: match?.fingering ?? fingeringFromTab(slot.tab),
    }
  }

  const group = V_GROUPS_BY_ID[slot.groupId]
  if (!group) return { shape: null, fingering: null }

  const shape = buildShape(chord.tones, group, slot.inversion)
  const result = generateGroup(chord, group, { includeVariants: true })
  const match = voicingMatchingTab(result.inversions[slot.inversion], slot.tab)

  return { shape, fingering: match?.fingering ?? fingeringFromTab(slot.tab) }
}

/** Moves a placed shape up or down an octave. No-op if it would leave the neck. */
export function shiftSlotOctave(
  song: Song,
  location: SlotLocation,
  deltaFrets: number
): Song {
  const section = song.sections.find((item) => item.id === location.sectionId)
  const bar = section?.bars.find((item) => item.id === location.barId)
  const slot = bar?.slots[location.slotIndex]
  if (!slot) return song
  const { fingering } = hydrateSlot(slot)
  if (!fingering) return song
  const next = isCustomGroupId(slot.groupId)
    ? shiftCustomFingering(fingering, deltaFrets)
    : shiftFingering(fingering, deltaFrets)
  if (!next) return song
  return patchSlot(song, location, {
    tab: tabLabel(next),
    highlightedNotes: shiftHighlightedNotes(slot.highlightedNotes, deltaFrets),
  })
}

export function countSlots(song: Song): number {
  let n = 0
  for (const section of song.sections) {
    for (const bar of section.bars) {
      for (const slot of bar.slots) if (slot) n++
    }
  }
  return n
}

export function countMeasures(song: Song): number {
  return song.sections.reduce((n, section) => n + section.bars.length, 0)
}

export function songSummary(song: Song): string {
  const chords = countSlots(song)
  const sections = song.sections.length
  const measures = countMeasures(song)
  return `${chords} chord${chords === 1 ? '' : 's'} · ${sections} section${
    sections === 1 ? '' : 's'
  } · ${measures} measure${measures === 1 ? '' : 's'} · ${song.bpm} bpm`
}

export function firstEmptyLocation(song: Song): SlotLocation | null {
  for (const section of song.sections) {
    for (const bar of section.bars) {
      const slotIndex = bar.slots.findIndex((s) => s === null)
      if (slotIndex >= 0) {
        return { sectionId: section.id, barId: bar.id, slotIndex }
      }
    }
  }
  return null
}

export function locationExists(song: Song, location: SlotLocation): boolean {
  const section = song.sections.find((item) => item.id === location.sectionId)
  const bar = section?.bars.find((item) => item.id === location.barId)
  return Boolean(
    bar && location.slotIndex >= 0 && location.slotIndex < bar.slots.length
  )
}

export function slotAt(
  song: Song,
  location: SlotLocation
): SequenceSlot | null {
  const section = song.sections.find((item) => item.id === location.sectionId)
  const bar = section?.bars.find((item) => item.id === location.barId)
  return bar?.slots[location.slotIndex] ?? null
}

/** Highlighted step if it still exists; otherwise the next empty / new bar. */
export function resolveAddLocation(
  song: Song,
  preferred?: SlotLocation | null
): { song: Song; location: SlotLocation } {
  if (preferred && locationExists(song, preferred)) {
    return { song, location: preferred }
  }
  return appendBarIfNeeded(song)
}

/** Next empty step after `after` in play order, or null if none remain. */
export function nextEmptyAfter(
  song: Song,
  after: SlotLocation
): SlotLocation | null {
  let passed = false
  for (const section of song.sections) {
    for (const bar of section.bars) {
      for (let slotIndex = 0; slotIndex < bar.slots.length; slotIndex++) {
        const location = { sectionId: section.id, barId: bar.id, slotIndex }
        if (!passed) {
          if (locationsEqual(location, after)) passed = true
          continue
        }
        if (bar.slots[slotIndex] === null) return location
      }
    }
  }
  return null
}

/** Walk the grid in play order, including empty steps as rests. */
export function playTimeline(song: Song): PlayEvent[] {
  const events: PlayEvent[] = []
  let index = 0
  for (const section of song.sections ?? []) {
    for (const bar of section.bars) {
      const seconds = stepSeconds(song.bpm, barSteps(bar))
      bar.slots.forEach((slot, slotIndex) => {
        events.push({
          slot,
          location: { sectionId: section.id, barId: bar.id, slotIndex },
          index,
          seconds,
        })
        index++
      })
    }
  }
  return events
}

export function placeSlot(
  song: Song,
  location: SlotLocation,
  slot: SequenceSlot | null
): Song {
  return mapBar(song, location.barId, (bar) => {
    if (location.slotIndex < 0 || location.slotIndex >= bar.slots.length) {
      return bar
    }
    const slots = [...bar.slots]
    slots[location.slotIndex] = slot
    return { ...bar, slots }
  })
}

export function parseStrumPattern(value: string | undefined): StrumStroke[] {
  const strokes = [...(value ?? '')]
    .map((ch) => ch.toLowerCase())
    .filter((ch): ch is StrumStroke => ch === 'd' || ch === 'u' || ch === 'x')
  return strokes.length > 0 ? strokes : [DEFAULT_STRUM_PATTERN]
}

export function normalizeStrumPattern(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = parseStrumPattern(value).join('')
  return cleaned === DEFAULT_STRUM_PATTERN && value.trim() === ''
    ? undefined
    : cleaned
}

export function formatStrumPattern(value: string | undefined): string {
  const known = STRUM_PATTERNS.find((pattern) => pattern.id === value)
  if (known) return known.label
  return parseStrumPattern(value)
    .map((stroke) => (stroke === 'd' ? 'D' : stroke === 'u' ? 'U' : '·'))
    .join('-')
}

export function slotPlayback(
  slot: SequenceSlot | null | undefined,
  songPlayback: PlaybackStyle
): PlaybackStyle {
  return slot?.playback ?? songPlayback
}

export function slotStrumPattern(
  slot: SequenceSlot | null | undefined,
  songPattern: string | undefined
): string {
  return slot?.strumPattern ?? songPattern ?? DEFAULT_STRUM_PATTERN
}

export function patchSlot(
  song: Song,
  location: SlotLocation,
  patch: Partial<SequenceSlot>
): Song {
  const section = song.sections.find((item) => item.id === location.sectionId)
  const bar = section?.bars.find((item) => item.id === location.barId)
  const slot = bar?.slots[location.slotIndex]
  if (!slot) return song
  const next = { ...slot, ...patch }
  if ('playback' in patch && patch.playback === undefined) delete next.playback
  if ('strumPattern' in patch && patch.strumPattern === undefined) {
    delete next.strumPattern
  }
  if ('highlightedNotes' in patch && patch.highlightedNotes === undefined) {
    delete next.highlightedNotes
  }
  if ('extendLow' in patch && patch.extendLow === undefined) delete next.extendLow
  if ('extendHigh' in patch && patch.extendHigh === undefined) {
    delete next.extendHigh
  }
  return placeSlot(song, location, next)
}

export type FretExtendEdge = 'low' | 'high'

export function adjustSlotFretExtend(
  song: Song,
  location: SlotLocation,
  edge: FretExtendEdge,
  delta: number
): Song {
  const section = song.sections.find((item) => item.id === location.sectionId)
  const bar = section?.bars.find((item) => item.id === location.barId)
  const slot = bar?.slots[location.slotIndex]
  if (!slot || !Number.isInteger(delta) || delta === 0) return song
  const field = edge === 'low' ? 'extendLow' : 'extendHigh'
  const next = (slot[field] ?? 0) + delta
  if (next < 0 || next > MAX_PLAYABLE_FRET) return song
  return patchSlot(song, location, {
    [field]: next === 0 ? undefined : next,
  })
}

export function toggleHighlightedNote(
  highlighted: HighlightedNote[] | undefined,
  note: HighlightedNote
): HighlightedNote[] | undefined {
  if (!isHighlightNote(note)) return highlighted
  const current = highlighted ?? []
  const exists = current.some((item) => sameHighlight(item, note))
  const next = exists
    ? current.filter((item) => !sameHighlight(item, note))
    : [...current, note].sort(compareHighlights)
  return next.length === 0 ? undefined : next
}

export function toggleSlotHighlight(
  song: Song,
  location: SlotLocation,
  note: HighlightedNote
): Song {
  const section = song.sections.find((item) => item.id === location.sectionId)
  const bar = section?.bars.find((item) => item.id === location.barId)
  const slot = bar?.slots[location.slotIndex]
  if (!slot) return song
  return patchSlot(song, location, {
    highlightedNotes: toggleHighlightedNote(slot.highlightedNotes, note),
  })
}

export function locationsEqual(a: SlotLocation, b: SlotLocation): boolean {
  return (
    a.sectionId === b.sectionId &&
    a.barId === b.barId &&
    a.slotIndex === b.slotIndex
  )
}

export function locationKey(location: SlotLocation): string {
  return `${location.sectionId}:${location.barId}:${location.slotIndex}`
}

export function moveSlot(song: Song, from: SlotLocation, to: SlotLocation): Song {
  if (locationsEqual(from, to)) {
    return song
  }

  const fromBar = findBar(song, from.barId)
  const toBar = findBar(song, to.barId)
  if (!fromBar || !toBar) return song

  const moving = fromBar.slots[from.slotIndex]
  if (!moving) return song

  const dest = toBar.slots[to.slotIndex] ?? null
  let next = placeSlot(song, from, dest)
  next = placeSlot(next, to, moving)
  return next
}

export function appendBarIfNeeded(song: Song): { song: Song; location: SlotLocation } {
  const empty = firstEmptyLocation(song)
  if (empty) return { song, location: empty }

  const lastSection = song.sections[song.sections.length - 1]
  if (!lastSection) {
    const section = emptySection('A')
    return {
      song: { ...song, sections: [section] },
      location: {
        sectionId: section.id,
        barId: section.bars[0].id,
        slotIndex: 0,
      },
    }
  }

  const bar = emptyBar(lastBarSteps(song))
  const sections = song.sections.map((section) =>
    section.id === lastSection.id
      ? { ...section, bars: [...section.bars, bar] }
      : section
  )
  return {
    song: { ...song, sections },
    location: { sectionId: lastSection.id, barId: bar.id, slotIndex: 0 },
  }
}

function findBar(song: Song, barId: string): Bar | null {
  for (const section of song.sections) {
    const bar = section.bars.find((b) => b.id === barId)
    if (bar) return bar
  }
  return null
}

function mapBar(song: Song, barId: string, change: (bar: Bar) => Bar): Song {
  return {
    ...song,
    sections: song.sections.map((section) => ({
      ...section,
      bars: section.bars.map((bar) => (bar.id === barId ? change(bar) : bar)),
    })),
  }
}

export function packEntriesIntoSection(
  entries: Array<Omit<SequenceSlot, 'note'> & { note?: string }>,
  name = 'A',
  steps: number = DEFAULT_STEPS_PER_MEASURE
): Section {
  const slots: (SequenceSlot | null)[] = entries.map((entry) => ({
    id: entry.id || newId(),
    chordSymbol: entry.chordSymbol,
    groupId: entry.groupId,
    inversion: entry.inversion,
    tab: entry.tab,
    note: entry.note ?? '',
  }))
  return {
    id: newId(),
    name,
    note: '',
    bars: packSlots(slots, steps),
  }
}

// --- Persistence -----------------------------------------------------------

interface StoredState {
  songs: Song[]
  activeSongId: string | null
}

function isPlayback(value: unknown): value is PlaybackStyle {
  return value === 'strum' || value === 'arp-up' || value === 'arp-down'
}

function clampBpm(value: unknown): number {
  const n = typeof value === 'number' ? value : DEFAULT_BPM
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(n)))
}

function readSlot(value: unknown): SequenceSlot | null {
  if (!value || typeof value !== 'object') return null
  const s = value as Partial<SequenceSlot>
  if (typeof s.chordSymbol !== 'string' || typeof s.tab !== 'string') return null
  return {
    id: typeof s.id === 'string' ? s.id : newId(),
    chordSymbol: s.chordSymbol,
    groupId: typeof s.groupId === 'string' ? s.groupId : 'V-2',
    inversion: typeof s.inversion === 'number' ? s.inversion : 0,
    tab: s.tab,
    note: typeof s.note === 'string' ? s.note : '',
    playback: isPlayback(s.playback) ? s.playback : undefined,
    strumPattern: normalizeStrumPattern(s.strumPattern),
    highlightedNotes: readHighlightedNotes(s.highlightedNotes),
    extendLow: readExtraCount(s.extendLow),
    extendHigh: readExtraCount(s.extendHigh),
  }
}

function readExtraCount(value: unknown): number | undefined {
  if (!Number.isInteger(value) || (value as number) < 1) return undefined
  return Math.min(MAX_PLAYABLE_FRET, value as number)
}

function readHighlightedNotes(value: unknown): HighlightedNote[] | undefined {
  if (!Array.isArray(value)) return undefined
  const notes = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const note = item as Partial<HighlightedNote>
      const next = { string: note.string, fret: note.fret }
      return isHighlightNote(next) ? next : null
    })
    .filter((item): item is HighlightedNote => item !== null)
  const unique = notes.filter(
    (note, index) => notes.findIndex((other) => sameHighlight(other, note)) === index
  )
  unique.sort(compareHighlights)
  return unique.length > 0 ? unique : undefined
}

function isHighlightNote(note: Partial<HighlightedNote> | null): note is HighlightedNote {
  if (!note) return false
  const string = note.string
  const fret = note.fret
  return (
    Number.isInteger(string) &&
    Number.isInteger(fret) &&
    string !== undefined &&
    fret !== undefined &&
    string >= 0 &&
    string <= 5 &&
    fret >= 0 &&
    fret <= MAX_PLAYABLE_FRET
  )
}

function sameHighlight(a: HighlightedNote, b: HighlightedNote): boolean {
  return a.string === b.string && a.fret === b.fret
}

function compareHighlights(a: HighlightedNote, b: HighlightedNote): number {
  return a.string - b.string || a.fret - b.fret
}

function shiftHighlightedNotes(
  highlighted: HighlightedNote[] | undefined,
  deltaFrets: number
): HighlightedNote[] | undefined {
  if (!highlighted?.length) return highlighted
  const next = highlighted
    .map((note) => {
      if (note.fret === 0) return note
      const fret = note.fret + deltaFrets
      if (fret < 1 || fret > MAX_PLAYABLE_FRET) return null
      return { string: note.string, fret }
    })
    .filter((note): note is HighlightedNote => note !== null)
  return next.length > 0 ? next : undefined
}

function readBarSlots(value: unknown): (SequenceSlot | null)[] {
  if (typeof value !== 'object' || value === null) return []
  const raw = value as Partial<Bar>
  const slots = Array.isArray(raw.slots) ? raw.slots : []
  return slots.map((slot) => readSlot(slot))
}

function normalizeBar(value: unknown, fallbackSteps: number): Bar | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<Bar> & { steps?: unknown }
  const slots = readBarSlots(raw)
  const fromLength = slots.length > 0 ? slots.length : fallbackSteps
  const steps = clampSteps(
    typeof raw.steps === 'number' ? raw.steps : fromLength
  )
  return {
    id: typeof raw.id === 'string' ? raw.id : newId(),
    slots: resizeBarSlots(slots, steps),
  }
}

function normalizeSection(value: unknown, fallbackSteps: number): Section | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<Section> & { measures?: unknown }
  const source = Array.isArray(raw.bars)
    ? raw.bars
    : Array.isArray(raw.measures)
      ? raw.measures
      : []
  const bars = source
    .map((bar) => normalizeBar(bar, fallbackSteps))
    .filter((bar): bar is Bar => bar !== null)
  return {
    id: typeof raw.id === 'string' ? raw.id : newId(),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'A',
    note: typeof raw.note === 'string' ? raw.note : '',
    bars: bars.length > 0 ? bars : [emptyBar(fallbackSteps)],
  }
}

export function normalizeSong(value: unknown): Song | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<Song> & {
    entries?: unknown
    stepsPerMeasure?: unknown
  }
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null

  const fallbackSteps = clampSteps(
    typeof raw.stepsPerMeasure === 'number'
      ? raw.stepsPerMeasure
      : DEFAULT_STEPS_PER_MEASURE
  )

  let sections: Section[]
  if (Array.isArray(raw.sections) && raw.sections.length > 0) {
    sections = raw.sections
      .map((section) => normalizeSection(section, fallbackSteps))
      .filter((s): s is Section => s !== null)
  } else if (Array.isArray(raw.entries)) {
    const entries = raw.entries.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) return []
      const e = entry as Partial<SequenceSlot>
      if (typeof e.chordSymbol !== 'string' || typeof e.tab !== 'string') {
        return []
      }
      return [
        {
          id: typeof e.id === 'string' ? e.id : newId(),
          chordSymbol: e.chordSymbol,
          groupId: typeof e.groupId === 'string' ? e.groupId : 'V-2',
          inversion: typeof e.inversion === 'number' ? e.inversion : 0,
          tab: e.tab,
          note: typeof e.note === 'string' ? e.note : '',
          playback: isPlayback(e.playback) ? e.playback : undefined,
          strumPattern: normalizeStrumPattern(e.strumPattern),
        },
      ]
    })
    sections = [packEntriesIntoSection(entries, 'A', fallbackSteps)]
  } else {
    sections = [emptySection('A', fallbackSteps)]
  }

  if (sections.length === 0) sections = [emptySection('A', fallbackSteps)]

  return {
    id: raw.id,
    name: raw.name,
    bpm: clampBpm(raw.bpm),
    playback: isPlayback(raw.playback) ? raw.playback : 'strum',
    strumPattern: normalizeStrumPattern(raw.strumPattern),
    sections,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  }
}

/** Accepts one song, an array, or `{ songs: [...] }` from a JSON export. */
export function readImportedSongs(value: unknown): Song[] {
  const candidates = Array.isArray(value)
    ? value
    : value &&
        typeof value === 'object' &&
        Array.isArray((value as { songs?: unknown }).songs)
      ? (value as { songs: unknown[] }).songs
      : [value]

  return candidates.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const raw = item as Partial<Song>
    const prepared = {
      ...raw,
      id: typeof raw.id === 'string' ? raw.id : newId(),
      name:
        typeof raw.name === 'string' && raw.name.trim()
          ? raw.name
          : 'Imported sequence',
    }
    const song = normalizeSong(prepared)
    return song ? [song] : []
  })
}

function readJson(key: string): unknown | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function loadState(): StoredState {
  const current = readJson(STORAGE_KEY) as Partial<StoredState> | null
  const legacy = current ? null : (readJson(LEGACY_STORAGE_KEY) as Partial<StoredState> | null)
  const source = current ?? legacy
  if (!source) return { songs: [], activeSongId: null }

  const songs = Array.isArray(source.songs)
    ? source.songs.map(normalizeSong).filter((s): s is Song => s !== null)
    : []
  const activeSongId =
    typeof source.activeSongId === 'string' &&
    songs.some((s) => s.id === source.activeSongId)
      ? source.activeSongId
      : (songs[0]?.id ?? null)
  return { songs, activeSongId }
}

export function saveState(state: StoredState): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked; the session still works in memory.
  }
}

export function exportSong(song: Song): string {
  const header = [
    song.name,
    '='.repeat(song.name.length),
    `${song.bpm} bpm · ${song.playback}${
      song.playback === 'strum' && song.strumPattern
        ? ` ${formatStrumPattern(song.strumPattern)}`
        : ''
    } · ${countSlots(song)} chords`,
    '',
  ]
  const body = song.sections.flatMap((section) => {
    const lines = [`[${section.name}]`]
    if (section.note) lines.push(`  ${section.note}`)
    section.bars.forEach((bar, barIndex) => {
      const cells = bar.slots.map((slot) =>
        slot ? `${displayChordSymbol(slot.chordSymbol)} ${slot.tab}` : '—'
      )
      lines.push(
        `  m${barIndex + 1} (${bar.slots.length}). ${cells.join('  |  ')}`
      )
      bar.slots.forEach((slot) => {
        if (slot?.note) lines.push(`      ${displayChordSymbol(slot.chordSymbol)}: ${slot.note}`)
      })
    })
    return [...lines, '']
  })
  return [...header, ...body].join('\n').trim()
}
