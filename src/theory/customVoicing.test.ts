import { describe, expect, it } from 'vitest'

import {
  customChordSymbol,
  CUSTOM_GROUP_ID,
  fingeringFromCustomStrings,
  fingeringFromCustomTab,
  shiftCustomFingering,
  voicingFromCustom,
} from './customVoicing'

describe('custom fretboard voicings', () => {
  it('builds an open C shape from clicked frets', () => {
    const voicing = voicingFromCustom([null, 3, 2, 0, 1, 0], 'C')
    expect(voicing).not.toBeNull()
    expect(voicing!.groupId).toBe(CUSTOM_GROUP_ID)
    expect(voicing!.chordSymbol).toBe('C')
    expect(voicing!.fingering.notes).toHaveLength(5)
    expect(voicing!.shape.voiceTones.map((tone) => tone.degree)).toEqual([
      'R',
      '3',
      '5',
      'R',
      '3',
    ])
  })

  it('names a four-note custom set with interval tokens', () => {
    const fingering = fingeringFromCustomStrings([null, 3, 5, 3, 5, null])
    expect(fingering).not.toBeNull()
    expect(customChordSymbol('C', fingering!)).toBe('C7')
  })

  it('round-trips a wide shape through tab', () => {
    const built = fingeringFromCustomStrings([3, null, null, null, null, 15])
    expect(built?.span).toBe(12)
    const again = fingeringFromCustomTab('3-x-x-x-x-15')
    expect(again?.midiNotes).toEqual(built?.midiNotes)
  })

  it('shifts a custom shape up an octave', () => {
    const open = fingeringFromCustomStrings([0, 2, 2, 1, 0, 0])
    const high = shiftCustomFingering(open!, 12)
    expect(high?.strings).toEqual([12, 14, 14, 13, 12, 12])
    expect(shiftCustomFingering(high!, 12)).toBeNull()
  })
})
