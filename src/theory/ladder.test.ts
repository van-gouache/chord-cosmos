import { describe, expect, it } from 'vitest'

import { parseChord } from './chords'
import { buildLadderRungs } from './ladder'
import { triadTones } from './triads'
import { V_GROUPS_BY_ID } from './vsystem'

function sounding(tones: ReturnType<typeof parseChord>['tones'], gaps: readonly number[], inversion: number) {
  return buildLadderRungs(tones, gaps, inversion)
    .filter((rung) => rung.voice)
    .map((rung) => `${rung.tone.degree}:${rung.voice}`)
}

function skipped(tones: ReturnType<typeof parseChord>['tones'], gaps: readonly number[], inversion: number) {
  return buildLadderRungs(tones, gaps, inversion)
    .filter((rung) => !rung.voice)
    .map((rung) => rung.tone.degree)
}

describe('chord-tone ladder', () => {
  const em7 = parseChord('E-7').tones
  const v2 = V_GROUPS_BY_ID['V-2'].gaps
  const v1 = V_GROUPS_BY_ID['V-1'].gaps
  const v4 = V_GROUPS_BY_ID['V-4'].gaps

  it('marks V-2 root position as drop-2 skips on the Em7 cycle', () => {
    expect(sounding(em7, v2, 0)).toEqual([
      'R:bass',
      '5:tenor',
      '♭7:alto',
      '♭3:soprano',
    ])
    expect(skipped(em7, v2, 0)).toEqual(['♭3', 'R'])
  })

  it('keeps V-1 as four adjacent rungs', () => {
    expect(sounding(em7, v1, 0)).toEqual([
      'R:bass',
      '♭3:tenor',
      '5:alto',
      '♭7:soprano',
    ])
    expect(skipped(em7, v1, 0)).toEqual([])
  })

  it('starts the same V-2 walk on a different bass for first inversion', () => {
    expect(sounding(em7, v2, 1)).toEqual([
      '♭3:bass',
      '♭7:tenor',
      'R:alto',
      '5:soprano',
    ])
  })

  it('uses V-4 gaps (drop 3) for the selected group', () => {
    expect(sounding(em7, v4, 0)).toEqual([
      'R:bass',
      '♭7:tenor',
      '♭3:alto',
      '5:soprano',
    ])
  })

  it('walks a three-note close triad', () => {
    const triad = triadTones(parseChord('E-'))
    expect(triad).not.toBeNull()
    expect(sounding(triad!, [0, 0], 0)).toEqual([
      'R:bass',
      '♭3:middle',
      '5:top',
    ])
  })
})
