/**
 * Songs are a grid: sections contain groups, and each group is divided
 * into a configurable number of steps. A step holds one chord (or a rest).
 */

import {
  displayChordSymbol,
  tryParseChord,
  type ParsedChord,
} from '../theory/chords'
import {
  customShapeFromFingering,
  fingeringFromCustomTab,
  isCustomGroupId,
  rootFromCustomSymbol,
  shiftCustomFingering,
} from '../theory/customVoicing'
import { readLineAudio, type LineAudio } from '../audio/lineAudio'
import {
  EMPTY_LINE_TAB,
  LINE_GROUP_ID,
  emptyLineFingering,
  isLineGroupId,
  lineShape,
  lineSlotLabel,
  readLineNotes,
  toggleLineNote,
} from '../theory/lineOutline'
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
import {
  DEFAULT_MODE,
  isKeyCenter,
  isModeId,
  type KeyCenter,
  type ModeId,
} from '../theory/diatonic'

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
export const DEFAULT_SLOT_BEATS = 4
export const MIN_SLOT_BEATS = 1
export const MAX_SLOT_BEATS = 32

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
  /** How many beats this chord lasts. Omitted means `DEFAULT_SLOT_BEATS`. */
  beats?: number
  /** How this chord is played. Omitted means strum. */
  playback?: PlaybackStyle
  /** Down/up/rest strokes for this step when it strums. */
  strumPattern?: string
  /** Extra outline markers on empty string/fret cells of the diagram. */
  highlightedNotes?: HighlightedNote[]
  /** Roman numeral from the progression builder when this chord was placed. */
  roman?: string
  /** Ordered frets of a single-note line (`groupId` is Line). */
  lineNotes?: HighlightedNote[]
  /** Extra fret rows toward the nut, beyond the automatic box. */
  extendLow?: number
  /** Extra fret rows toward the body, beyond the automatic box. */
  extendHigh?: number
  /** Recorded microphone take for a Line box. */
  lineAudio?: LineAudio
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
  /** Optional label; blank falls back to "Group N". */
  name?: string
  /** Tonic of this group's progression builder. */
  keyRoot?: KeyCenter
  /** Mode of this group's progression builder. */
  mode?: ModeId
  collapsed?: boolean
}

export interface Section {
  id: string
  name: string
  note: string
  bars: Bar[]
  collapsed?: boolean
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
  /** Flattened playhead index, including empty steps. */
  index: number
  /** How long this step lasts at the song tempo. */
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

/** Custom group title, or "Group N" when unnamed. */
export function barLabel(bar: Pick<Bar, 'name'>, index: number): string {
  const name = bar.name?.trim()
  return name ? name : `Group ${index + 1}`
}

export function lastBarSteps(song: Song, sectionId?: string): number {
  const section = sectionId
    ? song.sections.find((s) => s.id === sectionId)
    : song.sections[song.sections.length - 1]
  const last = section?.bars[section.bars.length - 1]
  return last ? barSteps(last) : DEFAULT_STEPS_PER_MEASURE
}

export function emptyBar(
  steps: number = DEFAULT_STEPS_PER_MEASURE,
  harmony?: { keyRoot?: KeyCenter; mode?: ModeId }
): Bar {
  return {
    id: newId(),
    slots: Array.from({ length: clampSteps(steps) }, () => null),
    keyRoot: harmony?.keyRoot,
    mode: harmony?.mode,
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

export function clampBeats(value: unknown): number {
  const n = typeof value === 'number' ? value : DEFAULT_SLOT_BEATS
  if (!Number.isFinite(n)) return DEFAULT_SLOT_BEATS
  return Math.min(MAX_SLOT_BEATS, Math.max(MIN_SLOT_BEATS, Math.round(n)))
}

export function slotBeats(slot: SequenceSlot | null | undefined): number {
  if (!slot) return 0
  return slot.beats == null ? DEFAULT_SLOT_BEATS : clampBeats(slot.beats)
}

/** Seconds for one beat at the given tempo. */
export function beatSeconds(bpm: number): number {
  return 60 / Math.max(1, bpm)
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

export function slotFromVoicing(
  voicing: Voicing,
  note = '',
  extras?: { roman?: string }
): SequenceSlot {
  const roman = extras?.roman?.trim()
  return {
    id: newId(),
    chordSymbol: voicing.chordSymbol,
    groupId: voicing.groupId,
    inversion: voicing.inversion,
    tab: tabLabel(voicing.fingering),
    note,
    ...(roman ? { roman } : {}),
  }
}

export function slotFromLineNotes(
  notes: HighlightedNote[]
): SequenceSlot | null {
  const lineNotes = readLineNotes(notes)
  if (!lineNotes) return null
  return {
    id: newId(),
    chordSymbol: lineSlotLabel(),
    groupId: LINE_GROUP_ID,
    inversion: 0,
    tab: EMPTY_LINE_TAB,
    note: '',
    lineNotes,
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

export function linePayload(slot: SequenceSlot): string {
  return JSON.stringify({
    chordSymbol: slot.chordSymbol,
    groupId: slot.groupId,
    inversion: slot.inversion,
    tab: slot.tab,
    lineNotes: slot.lineNotes,
    lineAudio: slot.lineAudio,
  })
}

export function slotFromVoicingPayload(raw: string): SequenceSlot | null {
  try {
    const value = JSON.parse(raw) as Partial<SequenceSlot>
    if (typeof value.chordSymbol !== 'string' || typeof value.tab !== 'string') {
      return null
    }
    const lineNotes = readLineNotes(value.lineNotes)
    const lineAudio = readLineAudio(value.lineAudio)
    return {
      id: newId(),
      chordSymbol: value.chordSymbol,
      groupId: typeof value.groupId === 'string' ? value.groupId : 'V-2',
      inversion: typeof value.inversion === 'number' ? value.inversion : 0,
      tab: value.tab,
      note: '',
      playback: isPlayback(value.playback) ? value.playback : undefined,
      lineNotes,
      lineAudio,
      roman: readRoman(value.roman),
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
    lineNotes: slot.lineNotes?.map((note) => ({ ...note })),
    lineAudio: slot.lineAudio ? { ...slot.lineAudio } : undefined,
  }
}

/** Deep copy of a measure with fresh ids so it can sit beside the original. */
export function cloneBar(bar: Bar): Bar {
  return {
    id: newId(),
    slots: bar.slots.map((slot) => (slot ? cloneSlot(slot) : null)),
    name: bar.name,
    keyRoot: bar.keyRoot,
    mode: bar.mode,
    collapsed: bar.collapsed,
  }
}

/** Deep copy of a section with fresh ids so it can sit beside the original. */
export function cloneSection(section: Section): Section {
  return {
    id: newId(),
    name: section.name,
    note: section.note,
    collapsed: section.collapsed,
    bars: section.bars.map((bar) => cloneBar(bar)),
  }
}

export function duplicateSection(song: Song, sectionId: string): Song {
  const index = song.sections.findIndex((section) => section.id === sectionId)
  if (index < 0) return song
  const source = song.sections[index]
  const copy = cloneSection(source)
  copy.name = copiedSectionName(
    source.name,
    song.sections.map((section) => section.name)
  )
  copy.collapsed = undefined
  const sections = [...song.sections]
  sections.splice(index + 1, 0, copy)
  return { ...song, sections }
}

export function setSectionCollapsed(
  song: Song,
  sectionId: string,
  collapsed: boolean
): Song {
  return {
    ...song,
    sections: song.sections.map((section) =>
      section.id === sectionId
        ? { ...section, collapsed: collapsed || undefined }
        : section
    ),
  }
}

export function setBarCollapsed(
  song: Song,
  barId: string,
  collapsed: boolean
): Song {
  return mapBar(song, barId, (bar) => ({
    ...bar,
    collapsed: collapsed || undefined,
  }))
}

export function setBarName(song: Song, barId: string, name: string): Song {
  return mapBar(song, barId, (bar) => {
    const next = name.length > 0 ? name : undefined
    if (bar.name === next) return bar
    return { ...bar, name: next }
  })
}

function copiedSectionName(name: string, existing: string[]): string {
  const base = name.trim() || 'Section'
  const taken = new Set(existing)
  if (!taken.has(`${base} copy`)) return `${base} copy`
  let n = 2
  while (taken.has(`${base} copy ${n}`)) n++
  return `${base} copy ${n}`
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
      const copy = cloneBar(section.bars[index])
      copy.collapsed = undefined
      bars.splice(index + 1, 0, copy)
      return { ...section, bars }
    }),
  }
}

export function hydrateSlot(slot: SequenceSlot): {
  shape: VoicingShape | null
  fingering: Fingering | null
} {
  if (isLineGroupId(slot.groupId)) {
    return { shape: lineShape(), fingering: emptyLineFingering() }
  }

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
  if (isLineGroupId(slot.groupId)) {
    const shifted = shiftHighlightedNotes(slot.lineNotes, deltaFrets)
    if (!shifted || shifted.length !== (slot.lineNotes?.length ?? 0)) {
      return song
    }
    return patchSlot(song, location, { lineNotes: shifted })
  }
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
  const groups = countMeasures(song)
  return `${chords} chord${chords === 1 ? '' : 's'} · ${sections} section${
    sections === 1 ? '' : 's'
  } · ${groups} group${groups === 1 ? '' : 's'} · ${song.bpm} bpm`
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

export function firstEmptyInBar(
  song: Song,
  sectionId: string,
  barId: string
): SlotLocation | null {
  const section = song.sections.find((item) => item.id === sectionId)
  const bar = section?.bars.find((item) => item.id === barId)
  if (!bar) return null
  const slotIndex = bar.slots.findIndex((slot) => slot === null)
  if (slotIndex < 0) return null
  return { sectionId, barId, slotIndex }
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

/** Walk the grid in play order. Empty steps take no time; chords last their beat count. */
export function playTimeline(song: Song): PlayEvent[] {
  const events: PlayEvent[] = []
  let index = 0
  const secondsPerBeat = beatSeconds(song.bpm)
  for (const section of song.sections ?? []) {
    for (const bar of section.bars) {
      bar.slots.forEach((slot, slotIndex) => {
        events.push({
          slot,
          location: { sectionId: section.id, barId: bar.id, slotIndex },
          index,
          seconds: slotBeats(slot) * secondsPerBeat,
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

/**
 * Opens an empty step beside an existing one, pushing later chords along.
 * Reuses a trailing empty step when there is one so the group only widens
 * when it has to. Null when the group is already at its step limit.
 */
export function insertSlotAt(
  song: Song,
  location: SlotLocation,
  side: 'before' | 'after'
): { song: Song; location: SlotLocation } | null {
  const bar = findBar(song, location.barId)
  if (!bar) return null
  const at = side === 'after' ? location.slotIndex + 1 : location.slotIndex
  if (at < 0 || at > bar.slots.length) return null

  const slots = [...bar.slots]
  slots.splice(at, 0, null)
  if (slots[slots.length - 1] === null) slots.pop()
  else if (slots.length > MAX_STEPS_PER_MEASURE) return null

  return {
    song: mapBar(song, location.barId, (current) => ({ ...current, slots })),
    location: { ...location, slotIndex: at },
  }
}

/**
 * Drops a step out of its group, pulling the later chords back one place.
 * Clears the chord in place when the group is down to its last step.
 */
export function removeStepAt(song: Song, location: SlotLocation): Song {
  const bar = findBar(song, location.barId)
  if (!bar) return song
  if (location.slotIndex < 0 || location.slotIndex >= bar.slots.length) {
    return song
  }
  if (bar.slots.length <= MIN_STEPS_PER_MEASURE) {
    return bar.slots[location.slotIndex] === null
      ? song
      : placeSlot(song, location, null)
  }
  const slots = bar.slots.filter((_, index) => index !== location.slotIndex)
  return mapBar(song, location.barId, (current) => ({ ...current, slots }))
}

/** Whether `insertSlotAt` would succeed for this step. */
export function canInsertSlotAt(song: Song, location: SlotLocation): boolean {
  const bar = findBar(song, location.barId)
  if (!bar) return false
  return (
    bar.slots[bar.slots.length - 1] === null ||
    bar.slots.length < MAX_STEPS_PER_MEASURE
  )
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
  slot: SequenceSlot | null | undefined
): PlaybackStyle {
  return slot?.playback === 'arp-up' || slot?.playback === 'arp-down'
    ? slot.playback
    : 'strum'
}

export function slotStrumPattern(
  slot: SequenceSlot | null | undefined
): string {
  return slot?.strumPattern ?? DEFAULT_STRUM_PATTERN
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
  if ('beats' in patch) {
    if (patch.beats == null || clampBeats(patch.beats) === DEFAULT_SLOT_BEATS) {
      delete next.beats
    } else {
      next.beats = clampBeats(patch.beats)
    }
  }
  if ('playback' in patch) {
    if (!patch.playback || patch.playback === 'strum') delete next.playback
    else next.playback = patch.playback
  }
  if ('strumPattern' in patch) {
    const normalized = normalizeStrumPattern(patch.strumPattern)
    if (!normalized || normalized === DEFAULT_STRUM_PATTERN) {
      delete next.strumPattern
    } else {
      next.strumPattern = normalized
    }
  }
  if ('highlightedNotes' in patch && patch.highlightedNotes === undefined) {
    delete next.highlightedNotes
  }
  if ('lineNotes' in patch && patch.lineNotes === undefined) {
    delete next.lineNotes
  }
  if ('lineAudio' in patch && patch.lineAudio === undefined) {
    delete next.lineAudio
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
  if (isLineGroupId(slot.groupId)) {
    return patchSlot(song, location, {
      lineNotes: toggleLineNote(slot.lineNotes, note),
    })
  }
  return patchSlot(song, location, {
    highlightedNotes: toggleHighlightedNote(slot.highlightedNotes, note),
  })
}

export function slotMidiNotes(
  slot: SequenceSlot,
  fingering: Fingering | null
): number[] | null {
  if (isLineGroupId(slot.groupId)) return null
  return fingering?.midiNotes ?? null
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

/** Filled steps in play order, with each stored symbol parsed. */
export function filledChordTimeline(
  song: Song
): { location: SlotLocation; chord: ParsedChord; slot: SequenceSlot }[] {
  const filled: { location: SlotLocation; chord: ParsedChord; slot: SequenceSlot }[] =
    []
  for (const event of playTimeline(song)) {
    if (!event.slot || !event.location) continue
    if (isLineGroupId(event.slot.groupId)) continue
    const { chord } = tryParseChord(event.slot.chordSymbol)
    if (chord) filled.push({ location: event.location, chord, slot: event.slot })
  }
  return filled
}

/** Next filled chord after each filled location. Does not wrap. */
export function nextFilledChordMap(song: Song): Map<string, ParsedChord> {
  const filled = filledChordTimeline(song)
  const map = new Map<string, ParsedChord>()
  for (let i = 0; i < filled.length - 1; i++) {
    map.set(locationKey(filled[i].location), filled[i + 1].chord)
  }
  return map
}

/**
 * Next filled chord after the workshop's current symbol. Prefers the
 * selected slot when it matches; otherwise the first matching filled slot.
 */
export function nextChordForWorkshop(
  song: Song,
  workshop: ParsedChord,
  selected: SlotLocation | null
): ParsedChord | null {
  const filled = filledChordTimeline(song)
  let start = -1
  if (selected) {
    const i = filled.findIndex((item) => locationsEqual(item.location, selected))
    if (i >= 0 && filled[i].chord.symbol === workshop.symbol) start = i
  }
  if (start < 0) {
    start = filled.findIndex((item) => item.chord.symbol === workshop.symbol)
  }
  if (start < 0 || start >= filled.length - 1) return null
  return filled[start + 1].chord
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

  const lastBar = lastSection.bars[lastSection.bars.length - 1]
  const bar = emptyBar(1, {
    keyRoot: lastBar?.keyRoot,
    mode: lastBar?.mode,
  })
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

export function barAt(song: Song, barId: string): Bar | null {
  return findBar(song, barId)
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

export function setBarHarmony(
  song: Song,
  barId: string,
  harmony: { keyRoot: KeyCenter | null; mode?: ModeId }
): Song {
  return mapBar(song, barId, (bar) => ({
    ...bar,
    keyRoot: harmony.keyRoot ?? undefined,
    mode:
      harmony.keyRoot == null
        ? bar.mode
        : (harmony.mode ?? bar.mode ?? DEFAULT_MODE),
  }))
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

function readSlotBeats(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const beats = clampBeats(value)
  return beats === DEFAULT_SLOT_BEATS ? undefined : beats
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
    beats: readSlotBeats(s.beats),
    playback: isPlayback(s.playback) ? s.playback : undefined,
    strumPattern: normalizeStrumPattern(s.strumPattern),
    highlightedNotes: readHighlightedNotes(s.highlightedNotes),
    lineNotes: readLineNotes(s.lineNotes),
    lineAudio: readLineAudio(s.lineAudio),
    extendLow: readExtraCount(s.extendLow),
    extendHigh: readExtraCount(s.extendHigh),
    roman: readRoman(s.roman),
  }
}

function readRoman(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const roman = value.trim()
  return roman || undefined
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
    name:
      typeof raw.name === 'string' && raw.name.trim() ? raw.name : undefined,
    keyRoot: isKeyCenter(raw.keyRoot) ? raw.keyRoot : undefined,
    mode: isModeId(raw.mode) ? raw.mode : undefined,
    collapsed: raw.collapsed === true ? true : undefined,
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
    collapsed: raw.collapsed === true ? true : undefined,
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

/** JSON download of a sequence: chords and line outlines, not microphone takes. */
export function songForJsonExport(song: Song): Song {
  return {
    ...song,
    sections: song.sections.map((section) => ({
      ...section,
      bars: section.bars.map((bar) => ({
        ...bar,
        slots: bar.slots.map((slot) => {
          if (!slot?.lineAudio) return slot
          const { lineAudio: _dropped, ...rest } = slot
          return rest
        }),
      })),
    })),
  }
}

/** Library JSON: every sequence, chords and outlines, not microphone takes. */
export function libraryForJsonExport(songs: Song[]): {
  format: 'chord-cosmos.library.v1'
  songs: Song[]
} {
  return {
    format: 'chord-cosmos.library.v1',
    songs: songs.map(songForJsonExport),
  }
}

export function exportSong(song: Song): string {
  const header = [
    song.name,
    '='.repeat(song.name.length),
    `${song.bpm} bpm · ${countSlots(song)} chords`,
    '',
  ]
  const body = song.sections.flatMap((section) => {
    const lines = [`[${section.name}]`]
    if (section.note) lines.push(`  ${section.note}`)
    section.bars.forEach((bar, barIndex) => {
      const cells = bar.slots.map((slot) =>
        slot ? `${displayChordSymbol(slot.chordSymbol)} ${slot.tab}` : '—'
      )
      const groupName = bar.name?.trim()
      lines.push(
        groupName
          ? `  m${barIndex + 1} ${groupName} (${bar.slots.length}). ${cells.join('  |  ')}`
          : `  m${barIndex + 1} (${bar.slots.length}). ${cells.join('  |  ')}`
      )
      bar.slots.forEach((slot) => {
        if (slot?.note) lines.push(`      ${displayChordSymbol(slot.chordSymbol)}: ${slot.note}`)
      })
    })
    return [...lines, '']
  })
  return [...header, ...body].join('\n').trim()
}
