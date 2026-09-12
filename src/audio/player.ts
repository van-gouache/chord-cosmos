/**
 * Plucked-string playback via Karplus-Strong synthesis.
 *
 * A short burst of noise is fed through a delay line with a gentle low-pass in
 * the feedback path. It costs almost nothing and sounds far more like a guitar
 * than a plain oscillator, including the way high notes decay faster than low
 * ones.
 */

import { lineNoteBeats } from '../theory/lineNotation'
import { DEFAULT_BPM } from '../state/songs'
import { STANDARD_TUNING } from '../theory/fretboard'
import { lineNotePitches, type LineNote } from '../theory/lineOutline'
import { midiToFrequency } from '../theory/pitch'

let context: AudioContext | null = null
let masterGain: GainNode | null = null
/** Voices currently sounding, so a new chord can cut off the previous one. */
let activeVoices: { source: AudioBufferSourceNode; gain: GainNode }[] = []

/** Full scale would clip a six-string strum, so "100%" stops short of 1. */
export const MAX_MASTER_GAIN = 0.9
export const DEFAULT_VOLUME = 0.67

let volume = DEFAULT_VOLUME

/** Playback level, 0 to 1. */
export function setMasterVolume(next: number): void {
  volume = Math.min(1, Math.max(0, Number.isFinite(next) ? next : DEFAULT_VOLUME))
  if (!masterGain || !context) return
  masterGain.gain.setTargetAtTime(
    volume * MAX_MASTER_GAIN,
    context.currentTime,
    0.02
  )
}

export function masterVolume(): number {
  return volume
}

function getContext(): AudioContext {
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    context = new Ctor()
    masterGain = context.createGain()
    masterGain.gain.value = volume * MAX_MASTER_GAIN
    masterGain.connect(context.destination)
  }
  return context
}

/** Renders one plucked note into an audio buffer. */
function renderPluck(
  ctx: BaseAudioContext,
  frequency: number,
  duration: number
): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const length = Math.max(1, Math.floor(sampleRate * duration))
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const out = buffer.getChannelData(0)

  const delayLength = Math.max(2, Math.round(sampleRate / frequency))
  const delay = new Float32Array(delayLength)

  // Excite the string with noise, slightly smoothed so the attack isn't harsh.
  let smooth = 0
  for (let i = 0; i < delayLength; i++) {
    const noise = Math.random() * 2 - 1
    smooth = 0.6 * smooth + 0.4 * noise
    delay[i] = smooth
  }

  // Damping just under 1 gives a long, natural decay. Scaling it by frequency
  // keeps low notes ringing longer than high ones, as on a real instrument.
  const damping = 0.996 - Math.min(0.004, frequency / 400000)

  let index = 0
  let previous = 0
  for (let i = 0; i < length; i++) {
    const current = delay[index]
    out[i] = current
    delay[index] = (current + previous) * 0.5 * damping
    previous = current
    index = (index + 1) % delayLength
  }

  // Fade the tail so the note doesn't click when it stops.
  const fade = Math.min(length, Math.floor(sampleRate * 0.25))
  for (let i = 0; i < fade; i++) {
    out[length - fade + i] *= 1 - i / fade
  }

  return buffer
}

export function stopAll(): void {
  const now = context?.currentTime ?? 0
  for (const voice of activeVoices) {
    try {
      voice.gain.gain.cancelScheduledValues(now)
      voice.gain.gain.setTargetAtTime(0, now, 0.03)
      voice.source.stop(now + 0.2)
    } catch {
      // The voice already ended; nothing to stop.
    }
  }
  activeVoices = []
}

export interface PlayOptions {
  /** Seconds between successive strings, giving the chord a strummed feel. */
  strumDelay?: number
  duration?: number
  velocity?: number
  /** When false, new notes layer on top of whatever is already ringing. */
  interrupt?: boolean
  /** Seconds to wait before the first string, relative to now. */
  startOffset?: number
}

export type ArrangementStyle = 'strum' | 'arp-up' | 'arp-down'

/** Plays a set of MIDI notes as a strummed chord. */
export function playNotes(midiNotes: number[], options: PlayOptions = {}): void {
  const {
    strumDelay = 0.035,
    duration = 2.6,
    velocity = 1,
    interrupt = true,
    startOffset = 0,
  } = options

  const ctx = getContext()
  if (ctx.state === 'suspended') void ctx.resume()
  if (interrupt) stopAll()

  const start = ctx.currentTime + 0.02 + Math.max(0, startOffset)

  midiNotes.forEach((midi, index) => {
    const frequency = midiToFrequency(midi)
    const buffer = renderPluck(ctx, frequency, duration)

    const source = ctx.createBufferSource()
    source.buffer = buffer

    // Roll a little of the brightness off the lowest strings.
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 2600 + index * 400

    const gain = ctx.createGain()
    // Lower strings a touch quieter keeps the voicing's top note audible.
    gain.gain.value = velocity * (0.5 + index * 0.08)

    source.connect(tone)
    tone.connect(gain)
    gain.connect(masterGain!)

    source.start(start + index * strumDelay)
    activeVoices.push({ source, gain })
    source.onended = () => {
      activeVoices = activeVoices.filter((v) => v.source !== source)
    }
  })
}

/** Plays notes one at a time, low to high. */
export function playArpeggio(midiNotes: number[], noteGap = 0.16): void {
  playNotes(midiNotes, { strumDelay: noteGap, duration: 2.2 })
}

/** Plays a written line in click order, using each note's duration. */
export function playLineMelody(notes: readonly LineNote[], bpm = DEFAULT_BPM): void {
  if (notes.length === 0) return
  const beat = 60 / Math.max(40, bpm)
  let offset = 0
  notes.forEach((note, index) => {
    const midi = lineNotePitches(note).map(
      (pitch) => STANDARD_TUNING[pitch.string] + pitch.fret
    )
    const seconds = lineNoteBeats(note) * beat
    playNotes(midi, {
      interrupt: index === 0,
      startOffset: offset,
      duration: Math.max(0.4, seconds + 0.2),
      velocity: 1,
      strumDelay: 0,
    })
    offset += seconds
  })
}

export interface BeatPlayOptions {
  style?: ArrangementStyle
  seconds?: number
  strumPattern?: string
  interrupt?: boolean
}

/** One sequencer step: a strum, a strum pattern, or an arpeggio. */
export function playBeat(
  midiNotes: number[],
  options: BeatPlayOptions = {}
): void {
  const style = options.style ?? 'strum'
  const seconds = options.seconds ?? 1.4
  const interrupt = options.interrupt ?? true

  if (style !== 'strum') {
    const ordered = style === 'arp-down' ? [...midiNotes].reverse() : midiNotes
    playNotes(ordered, {
      interrupt,
      strumDelay: seconds / Math.max(ordered.length, 1),
      duration: seconds + 1.2,
    })
    return
  }

  const strokes = [...(options.strumPattern ?? '')]
    .map((ch) => ch.toLowerCase())
    .filter((ch): ch is 'd' | 'u' | 'x' => ch === 'd' || ch === 'u' || ch === 'x')
  const pattern = strokes.length > 0 ? strokes : (['d'] as const)
  const slice = seconds / pattern.length
  pattern.forEach((stroke, index) => {
    if (stroke === 'x') return
    const ordered = stroke === 'u' ? [...midiNotes].reverse() : midiNotes
    playNotes(ordered, {
      interrupt: interrupt && index === 0,
      startOffset: index * slice,
      strumDelay: stroke === 'u' ? 0.018 : 0.028,
      duration: Math.max(0.9, seconds - index * slice + 0.8),
      velocity: stroke === 'u' ? 0.72 : 1,
    })
  })
}

/** Plays a series of chords in time, returning a function to cancel playback. */
export function playSequence(
  chords: number[][],
  beatSeconds = 1.4,
  onChordStart?: (index: number) => void
): () => void {
  return playArrangement(
    chords.map((midiNotes) => ({ midiNotes })),
    {
      beatSeconds,
      style: 'strum',
      onBeat: onChordStart,
    }
  )
}

export interface ArrangementBeat {
  midiNotes: number[] | null
  /** Override the shared beat length for this step. */
  seconds?: number
  style?: ArrangementStyle
  strumPattern?: string
}

export interface ArrangementOptions {
  bpm?: number
  beatSeconds?: number
  style?: ArrangementStyle
  onBeat?: (index: number) => void
  onDone?: () => void
}

/**
 * Plays a grid timeline at a given tempo. Empty beats are rests; arpeggio
 * styles split each beat across the chord's notes instead of strumming them.
 */
export function playArrangement(
  beats: ArrangementBeat[],
  options: ArrangementOptions = {}
): () => void {
  const {
    style = 'strum',
    onBeat,
    onDone,
  } = options
  const defaultSeconds =
    options.beatSeconds ?? 60 / Math.max(1, options.bpm ?? 90)

  const timers: number[] = []
  let cancelled = false
  let offset = 0

  stopAll()

  beats.forEach((beat, index) => {
    const seconds = beat.seconds ?? defaultSeconds
    const startAt = offset
    offset += seconds
    const timer = window.setTimeout(() => {
      if (cancelled) return
      onBeat?.(index)

      const notes = beat.midiNotes
      if (!notes || notes.length === 0) return

      playBeat(notes, {
        style: beat.style ?? style,
        seconds,
        strumPattern: beat.strumPattern,
        interrupt: false,
      })
    }, startAt * 1000)
    timers.push(timer)
  })

  const doneAt = offset * 1000 + 250
  timers.push(
    window.setTimeout(() => {
      if (!cancelled) onDone?.()
    }, doneAt)
  )

  return () => {
    cancelled = true
    for (const timer of timers) window.clearTimeout(timer)
    stopAll()
  }
}

/** Browsers require a user gesture before audio can start. */
export function unlockAudio(): void {
  const ctx = getContext()
  if (ctx.state === 'suspended') void ctx.resume()
}
