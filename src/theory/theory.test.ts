import { describe, expect, it } from 'vitest'

import { displayChordSymbol, parseChord, tryParseChord } from './chords'
import {
  findFingerings,
  fingeringFromTab,
  listOctaveShifts,
  ordinal,
  positionLabel,
  shiftFingering,
  STANDARD_TUNING,
  stringsCrossPitch,
  tabLabel,
  type Fingering,
} from './fretboard'
import { mod12 } from './pitch'
import {
  buildShape,
  classifyVoicing,
  V_GROUPS,
  V_GROUPS_BY_ID,
} from './vsystem'
import {
  buildTriadShape,
  generateAllTriads,
  generateTriadGroup,
  TRIAD_GROUPS_BY_ID,
  triadTones,
} from './triads'
import { generateAllGroups, generateGroup, voicingMatchingTab } from './voicings'
import {
  ALL_QUALITY_CHIPS,
  TRIAD_QUALITY_CHIPS,
  jazzSuffixFromSemitones,
  triadSuffixFromSemitones,
} from './qualities'

const degrees = (symbol: string) =>
  parseChord(symbol).tones.map((t) => t.degree)

const noteNames = (symbol: string) => parseChord(symbol).tones.map((t) => t.name)

describe('chord symbol parsing', () => {
  it('reads the jazz shorthand from the brief', () => {
    expect(degrees('E-7')).toEqual(['R', '♭3', '5', '♭7'])
    expect(noteNames('E-7')).toEqual(['E', 'G', 'B', 'D'])

    expect(degrees('EΔ7')).toEqual(['R', '3', '5', '7'])
    expect(noteNames('EΔ7')).toEqual(['E', 'G♯', 'B', 'D♯'])

    expect(degrees('Eø7')).toEqual(['R', '♭3', '♭5', '♭7'])
    expect(noteNames('Eø7')).toEqual(['E', 'G', 'B♭', 'D'])
  })

  it('spells each tone by its degree, not the nearest enharmonic', () => {
    // The ♭5 of a half-diminished chord is a flatted B, never a sharp A.
    expect(noteNames('Eø7')).toEqual(['E', 'G', 'B♭', 'D'])
    // A diminished 7th needs a double flat to keep one letter per degree.
    expect(noteNames('C°7')).toEqual(['C', 'E♭', 'G♭', 'B♭♭'])
    expect(noteNames('F#7')).toEqual(['F♯', 'A♯', 'C♯', 'E'])
    expect(noteNames('Ab-7')).toEqual(['A♭', 'C♭', 'E♭', 'G♭'])
    // Every chord uses four different letters.
    for (const symbol of ['Eø7', 'C°7', 'F#7', 'Ab-7', 'BbΔ7', 'D-6']) {
      const letters = new Set(noteNames(symbol).map((n) => n[0]))
      expect(letters.size, symbol).toBe(4)
    }
  })

  it('accepts the many ways people spell the same quality', () => {
    for (const symbol of ['Em7', 'E-7', 'Emin7', 'Emi7']) {
      expect(degrees(symbol)).toEqual(['R', '♭3', '5', '♭7'])
    }
    for (const symbol of ['EM7', 'Emaj7', 'Ema7', 'EΔ7', 'E^7']) {
      expect(degrees(symbol)).toEqual(['R', '3', '5', '7'])
    }
    for (const symbol of ['Eø7', 'Em7b5', 'E-7b5', 'Emin7b5']) {
      expect(degrees(symbol)).toEqual(['R', '♭3', '♭5', '♭7'])
    }
    for (const symbol of ['E°7', 'Edim7', 'Eo7']) {
      expect(degrees(symbol)).toEqual(['R', '♭3', '♭5', '♭♭7'])
    }
  })

  it('distinguishes minor-major from minor and major', () => {
    expect(degrees('EmMaj7')).toEqual(['R', '♭3', '5', '7'])
    expect(degrees('E-Δ7')).toEqual(['R', '♭3', '5', '7'])
    expect(degrees('Em6')).toEqual(['R', '♭3', '5', '6'])
    expect(degrees('E6')).toEqual(['R', '3', '5', '6'])
  })

  it('handles altered dominants and sus chords', () => {
    expect(degrees('E7#5')).toEqual(['R', '3', '♯5', '♭7'])
    expect(degrees('E7b5')).toEqual(['R', '3', '♭5', '♭7'])
    expect(degrees('E7sus4')).toEqual(['R', '4', '5', '♭7'])
    // A 9th chord has five tones, so the perfect 5th is dropped.
    expect(degrees('E9')).toEqual(['R', '9', '3', '♭7'])
    expect(degrees('E7b9')).toEqual(['R', '♭9', '3', '♭7'])
    expect(degrees('E7#9')).toEqual(['R', '♯9', '3', '♭7'])
    expect(degrees('E7#11')).toEqual(['R', '3', '♯11', '♭7'])
    expect(degrees('Emaj7#11')).toEqual(['R', '3', '♯11', '7'])
    expect(degrees('Emaj7#5')).toEqual(['R', '3', '♯5', '7'])
  })

  it('keeps the namesake extension when trimming to four voices', () => {
    expect(degrees('E13')).toEqual(['R', '3', '13', '♭7'])
    expect(degrees('Em11')).toEqual(['R', '♭3', '11', '♭7'])
    expect(degrees('Emaj13')).toEqual(['R', '3', '13', '7'])
  })

  it('completes sus triads without adding a third', () => {
    expect(degrees('Esus2')).toEqual(['R', '2', '4', '5'])
    expect(degrees('Esus4')).toEqual(['R', '4', '5', '♭7'])
    expect(degrees('E7sus2')).toEqual(['R', '2', '5', '♭7'])
    expect(degrees('E7sus4')).toEqual(['R', '4', '5', '♭7'])
  })

  it('reads a custom four-interval symbol', () => {
    expect(degrees('E[R,2,5,7]')).toEqual(['R', '9', '5', '7'])
    expect(degrees('C[3,5,b7,9]')).toEqual(['9', '3', '5', '♭7'])
    expect(() => parseChord('E[R,3,5]')).toThrow(/exactly four/)
    expect(() => parseChord('E[R,foo,5,7]')).toThrow(/Unknown interval/)
  })

  it('names interval sets with jazz symbols', () => {
    expect(parseChord('E[R,4,5,6]').symbol).toBe('E6sus4')
    expect(parseChord('E[R,3,5,b7]').symbol).toBe('E7')
    expect(parseChord('C[R,b3,5,b7]').symbol).toBe('C-7')
    expect(parseChord('E[R,3,5,7]').symbol).toBe('EΔ7')
    expect(jazzSuffixFromSemitones([0, 5, 7, 9])).toBe('6sus4')
    expect(displayChordSymbol('Em7')).toBe('E-7')
    expect(displayChordSymbol('DMaj7')).toBe('DΔ7')
    expect(displayChordSymbol('Em7b5')).toBe('Eø7')
    expect(displayChordSymbol('Bbmaj7')).toBe('B♭Δ7')
  })

  it('names a rootless GΔ7♯11 that still has a 5', () => {
    const chord = parseChord('G[3,b5,5,7]')
    expect(chord.symbol).toBe('GΔ7♯11(add5)-R')
    expect(chord.tones.map((tone) => tone.degree).sort()).toEqual(
      ['3', '5', '7', '♭5'].sort()
    )
    expect(chord.tones.some((tone) => tone.semitones === 0)).toBe(false)
    const again = parseChord(chord.symbol)
    expect(again.symbol).toBe('GΔ7♯11(add5)-R')
    expect(new Set(again.tones.map((tone) => tone.semitones))).toEqual(
      new Set(chord.tones.map((tone) => tone.semitones))
    )
    expect(parseChord('C[3,5,b7,9]').symbol).toBe('C9(add5)-R')
  })

  it('canonicalizes typed symbols to jazz shorthand', () => {
    expect(parseChord('Em7').symbol).toBe('E-7')
    expect(parseChord('Emaj7').symbol).toBe('EΔ7')
    expect(parseChord('Emin7b5').symbol).toBe('Eø7')
    expect(parseChord('EmMaj7').symbol).toBe('E-Δ7')
    expect(parseChord('E6sus4').symbol).toBe('E6sus4')
    expect(parseChord('EΔ7sus4').symbol).toBe('EΔ7sus4')
  })

  it('reads minor six-nine and diminished-major 7th', () => {
    expect(degrees('Em6/9')).toEqual(['R', '9', '♭3', '6'])
    expect(degrees('E-6/9')).toEqual(['R', '9', '♭3', '6'])
    expect(degrees('E°Δ7')).toEqual(['R', '♭3', '♭5', '7'])
    expect(degrees('EdimMaj7')).toEqual(['R', '♭3', '♭5', '7'])
  })

  it('spells flat-side roots with flats', () => {
    expect(noteNames('Eb7')).toEqual(['E♭', 'G', 'B♭', 'D♭'])
    expect(noteNames('Bbmaj7')).toEqual(['B♭', 'D', 'F', 'A'])
  })

  it('extends triads to four tones and says so', () => {
    const c = parseChord('E')
    expect(c.tones).toHaveLength(4)
    expect(c.adjustments.join(' ')).toContain('6th')

    const m = parseChord('Em')
    expect(m.tones.map((t) => t.degree)).toEqual(['R', '♭3', '5', '♭7'])
    expect(m.adjustments).not.toHaveLength(0)
  })

  it('keeps the root on altered dominants', () => {
    for (const symbol of [
      'C7alt',
      'C7b9b5',
      'C7b9#5',
      'C7#9b5',
      'C7#9#5',
      'C7b9#11',
      'C7#9#11',
    ]) {
      const chord = parseChord(symbol)
      expect(chord.tones.map((t) => t.degree), symbol).toContain('R')
      expect(new Set(chord.tones.map((t) => t.pc)).size).toBe(4)
    }
    expect(degrees('C7alt')).toEqual(['R', '♭9', '3', '♯5'])
    expect(degrees('C7b9#5')).toEqual(['R', '♭9', '3', '♯5'])
  })

  it('parses every quality chip to four distinct tones', () => {
    const suffixes = ALL_QUALITY_CHIPS.map((c) => c.suffix)
    expect(new Set(suffixes).size).toBe(suffixes.length)

    for (const chip of ALL_QUALITY_CHIPS) {
      const chord = parseChord(`C${chip.suffix}`)
      const pcs = new Set(chord.tones.map((t) => t.pc))
      expect(pcs.size, `${chip.label} (${chip.suffix})`).toBe(4)
    }
  })

  it('always yields exactly four distinct pitch classes', () => {
    const symbols = [
      'C',
      'Cmaj7',
      'C7',
      'Cm7',
      'Cm7b5',
      'Cdim7',
      'C6',
      'Cm6',
      'CmMaj7',
      'C7sus4',
      'C7#5',
      'C7b9',
      'C13',
      'C6/9',
      'Cmaj7#11',
      'C7alt',
      'C7#9',
      'C7#11',
      'Cmaj7#5',
      'Cm6/9',
      'CdimMaj7',
      'Cm11',
      'Caug',
      'Csus2',
    ]
    for (const symbol of symbols) {
      const chord = parseChord(symbol)
      const pcs = new Set(chord.tones.map((t) => t.pc))
      expect(pcs.size, `${symbol} should have four distinct tones`).toBe(4)
    }
  })

  /**
   * `buildShape` throws on anything that isn't four tones, so a symbol that
   * parses but yields three would white-screen the app. Chords thinned by
   * `no3`/`no5` used to do exactly that.
   */
  it('never parses to something that cannot be voiced', () => {
    const symbols = [
      'C7no3',
      'Cno5',
      'Cno3',
      'C7no5',
      'Cm7no5',
      'Cmaj7no3',
      'C7no3no5',
      'Csus4no5',
      'Cdim7no5',
      'Cmaj7no5',
      'C13no3',
      'Cm',
      'C',
      'Caug',
      'Cdim',
      'Csus2',
      'Csus4',
    ]
    for (const symbol of symbols) {
      const { chord } = tryParseChord(symbol)
      if (!chord) continue
      expect(chord.tones, `${symbol} tone count`).toHaveLength(4)
      expect(new Set(chord.tones.map((t) => t.pc)).size).toBe(4)
      // The real guard: voicing generation must not throw.
      expect(() => generateAllGroups(chord), symbol).not.toThrow()
    }
  })

  it('completes thinned chords with a tone that fits', () => {
    // Adding a ♭7 to a maj7 would clash; it should reach for the 9th instead.
    expect(degrees('Cmaj7no3')).toEqual(['R', '9', '5', '7'])
    expect(degrees('C7no3')).toEqual(['R', '9', '5', '♭7'])
    expect(degrees('Cno5')).toEqual(['R', '9', '3', '6'])
  })

  it('rejects nonsense instead of guessing', () => {
    expect(() => parseChord('H7')).toThrow()
    expect(() => parseChord('Cwobble')).toThrow()
    expect(() => parseChord('')).toThrow()
  })
})

describe('the V-System gap table', () => {
  it('has all fourteen groups with three gaps each', () => {
    expect(V_GROUPS).toHaveLength(14)
    for (const group of V_GROUPS) {
      expect(group.gaps).toHaveLength(3)
    }
  })

  it('matches the gaps Ted Greene published', () => {
    const published: Record<string, [number, number, number]> = {
      'V-1': [0, 0, 0],
      'V-2': [1, 0, 1],
      'V-3': [0, 1, 2],
      'V-4': [2, 1, 0],
      'V-5': [1, 2, 1],
      'V-6': [4, 0, 0],
      'V-7': [5, 0, 1],
      'V-8': [2, 2, 2],
      'V-9': [1, 0, 5],
      'V-10': [1, 4, 1],
      'V-11': [2, 1, 4],
      'V-12': [4, 1, 2],
      'V-13': [0, 4, 0],
      'V-14': [0, 0, 4],
    }
    for (const [id, gaps] of Object.entries(published)) {
      expect(V_GROUPS_BY_ID[id].gaps, id).toEqual(gaps)
    }
  })

  it('produces four distinct pitch classes for every group and inversion', () => {
    const tones = parseChord('C7').tones
    for (const group of V_GROUPS) {
      for (let inv = 0; inv < 4; inv++) {
        const shape = buildShape(tones, group, inv)
        const pcs = new Set(
          shape.intervals.map((i) => mod12(i + tones[inv].semitones))
        )
        expect(pcs.size, `${group.id} inv ${inv}`).toBe(4)
        // Voices must ascend strictly.
        for (let v = 1; v < 4; v++) {
          expect(shape.intervals[v]).toBeGreaterThan(shape.intervals[v - 1])
        }
      }
    }
  })

  it('round-trips: a shape classifies back to the group that built it', () => {
    for (const symbol of ['C7', 'Am7', 'EbMaj7', 'Bø7', 'F#dim7']) {
      const tones = parseChord(symbol).tones
      for (const group of V_GROUPS) {
        for (let inv = 0; inv < 4; inv++) {
          const shape = buildShape(tones, group, inv)
          const pitches = shape.intervals.map(
            (i) => 48 + tones[inv].semitones + i
          )
          expect(classifyVoicing(pitches)?.id, `${symbol} ${group.id}/${inv}`).toBe(
            group.id
          )
        }
      }
    }
  })
})

/**
 * Independent check of the gap table against the arrangers' "drop" language:
 * take a close-position voicing and lower the given voices (counted from the
 * top) by an octave, then classify the result.
 */
function dropVoicing(closePitches: number[], dropsFromTop: number[]): number[] {
  return closePitches
    .map((pitch, index) => {
      const fromTop = closePitches.length - index
      return dropsFromTop.includes(fromTop) ? pitch - 12 : pitch
    })
    .sort((a, b) => a - b)
}

describe('cross-check against drop-voicing terminology', () => {
  // C7 in close root position: C4 E4 G4 Bb4.
  const close = [60, 64, 67, 70]

  it.each([
    ['V-1', [] as number[]],
    ['V-2', [2]],
    ['V-3', [2, 3]],
    ['V-4', [3]],
    ['V-5', [2, 4]],
    ['V-6', [4]],
  ])('%s is the "%s" drop voicing', (expectedGroup, drops) => {
    expect(classifyVoicing(dropVoicing(close, drops))?.id).toBe(expectedGroup)
  })
})

/**
 * The other independent check: Ted's "Method 1" describes the wide groups as
 * octave displacements of the narrow ones. Those descriptions must agree with
 * the gap table.
 */
describe('cross-check against octave-displacement descriptions', () => {
  const tones = parseChord('C7').tones

  const displace = (
    groupId: string,
    inversion: number,
    voices: number[]
  ): number[] => {
    const shape = buildShape(tones, V_GROUPS_BY_ID[groupId], inversion)
    return shape.intervals
      .map((i, v) => {
        const shift = voices.includes(v) ? (v <= 1 ? -12 : 12) : 0
        return 60 + i + shift
      })
      .sort((a, b) => a - b)
  }

  it.each([
    ['V-6', 'V-1', [0]], // V-1 with the bass an octave lower
    ['V-7', 'V-2', [0]], // V-2 with the bass an octave lower
    ['V-9', 'V-2', [3]], // V-2 with the soprano an octave higher
    ['V-10', 'V-2', [2, 3]], // V-2 with alto and soprano an octave higher
    ['V-11', 'V-4', [3]], // V-4 with the soprano an octave higher
    ['V-12', 'V-3', [0]], // V-3 with the bass an octave lower
    ['V-13', 'V-1', [2, 3]], // V-1 with alto and soprano an octave higher
    ['V-14', 'V-1', [3]], // V-1 with the soprano an octave higher
  ])('%s is %s displaced at voices %j', (expected, source, voices) => {
    for (let inv = 0; inv < 4; inv++) {
      expect(classifyVoicing(displace(source, inv, voices))?.id).toBe(expected)
    }
  })
})

describe('fretboard search', () => {
  const chord = parseChord('C7')

  it('only returns fingerings whose notes are actually the chord', () => {
    for (const group of V_GROUPS) {
      for (let inv = 0; inv < 4; inv++) {
        const shape = buildShape(chord.tones, group, inv)
        for (const f of findFingerings(shape, chord.rootPc)) {
          // Every note lands where the tuning says it should.
          for (const note of f.notes) {
            expect(note.midi).toBe(STANDARD_TUNING[note.string] + note.fret)
          }
          // Strings ascend with the voices, and pitches ascend with them.
          for (let v = 1; v < 4; v++) {
            expect(f.notes[v].string).toBeGreaterThan(f.notes[v - 1].string)
            expect(f.notes[v].midi).toBeGreaterThan(f.notes[v - 1].midi)
          }
          // The intervals match the shape exactly.
          const bass = f.notes[0].midi
          expect(f.notes.map((n) => n.midi - bass)).toEqual(shape.intervals)
        }
      }
    }
  })

  it('never returns a shape needing more than four fingers or a huge stretch', () => {
    for (const group of V_GROUPS) {
      for (let inv = 0; inv < 4; inv++) {
        const shape = buildShape(chord.tones, group, inv)
        for (const f of findFingerings(shape, chord.rootPc)) {
          expect(f.fingersNeeded).toBeLessThanOrEqual(4)
          expect(f.span).toBeLessThanOrEqual(5)
        }
      }
    }
  })

  it('finds the classic drop-3 G7 on the 6-4-3-2 string set', () => {
    const g7 = parseChord('G7')
    const result = generateGroup(g7, V_GROUPS_BY_ID['V-4'])
    const all = result.inversions.flatMap((i) => i.voicings)
    // 3-x-3-4-3-x — root on the 6th string, the Freddie Green shape.
    const match = all.find(
      (v) =>
        v.fingering.strings.join(',') === '3,,3,4,3,'.replace(/,,/g, ',null,')
    )
    // Compare structurally rather than by string formatting.
    const target = [3, null, 3, 4, 3, null]
    const found = all.some(
      (v) =>
        v.fingering.strings.length === 6 &&
        v.fingering.strings.every((f, i) => f === target[i])
    )
    expect(found || match !== undefined).toBe(true)
  })

  it('finds the classic drop-2 Cmaj7 on the middle four strings', () => {
    const cmaj7 = parseChord('Cmaj7')
    const result = generateGroup(cmaj7, V_GROUPS_BY_ID['V-2'])
    const all = result.inversions.flatMap((i) => i.voicings)
    // x-3-5-4-5-x : G C E B, root position drop 2.
    const target = [null, 3, 5, 4, 5, null]
    expect(
      all.some((v) => v.fingering.strings.every((f, i) => f === target[i]))
    ).toBe(true)
  })

  it('makes the commonly played groups reachable for a typical chord', () => {
    const groups = generateAllGroups(parseChord('E-7'))
    const byId = Object.fromEntries(groups.map((g) => [g.group.id, g]))
    for (const id of ['V-1', 'V-2', 'V-3', 'V-4', 'V-5', 'V-6']) {
      expect(byId[id].voicingCount, `${id} should be playable`).toBeGreaterThan(0)
    }
  })

  it('offers every inversion of the workhorse group', () => {
    const result = generateGroup(parseChord('E-7'), V_GROUPS_BY_ID['V-2'])
    for (const inv of result.inversions) {
      expect(inv.voicings.length, `inversion ${inv.inversion}`).toBeGreaterThan(0)
    }
  })
})

describe('grid previews', () => {
  /**
   * The V-System sorts chords by spacing, so the 14 preview diagrams are only
   * comparable if they all show the same inversion.
   */
  it('shows root position whenever root position is playable', () => {
    for (const symbol of ['E-7', 'CΔ7', 'A7', 'Bø7', 'Eb6']) {
      const chord = parseChord(symbol)
      for (const result of generateAllGroups(chord)) {
        if (!result.preview) continue
        const rootPositionPlayable = result.inversions[0].voicings.length > 0
        if (rootPositionPlayable) {
          expect(
            result.preview.inversion,
            `${symbol} ${result.group.id} preview should be root position`
          ).toBe(0)
          expect(result.preview.shape.voiceTones[0].degree).toBe('R')
        }
      }
    }
  })

  it('falls back to another inversion rather than showing nothing', () => {
    for (const symbol of ['E-7', 'CΔ7', 'A7', 'Bø7', 'Eb6']) {
      for (const result of generateAllGroups(parseChord(symbol))) {
        // A group with any playable voicing must have a preview.
        expect(result.preview !== null).toBe(result.voicingCount > 0)
      }
    }
  })

  it('prefers a movable shape over an all-open one', () => {
    // Em7 drop-2 can be played as four open strings, which is the easiest
    // fingering but a useless illustration of a drop-2.
    const result = generateGroup(parseChord('E-7'), V_GROUPS_BY_ID['V-2'])
    const openStrings = result.preview!.fingering.notes.filter(
      (n) => n.fret === 0
    ).length
    expect(openStrings).toBeLessThan(3)
    expect(result.preview!.fingering.lowestFret).toBeGreaterThan(0)
  })
})

describe('position labelling', () => {
  it('uses real ordinals', () => {
    expect(ordinal(1)).toBe('1st')
    expect(ordinal(2)).toBe('2nd')
    expect(ordinal(3)).toBe('3rd')
    expect(ordinal(4)).toBe('4th')
    expect(ordinal(11)).toBe('11th')
    expect(ordinal(12)).toBe('12th')
    expect(ordinal(13)).toBe('13th')
    expect(ordinal(21)).toBe('21st')
  })

  const fingeringWithFrets = (frets: (number | null)[]): Fingering => {
    const notes = frets
      .map((fret, string) =>
        fret === null
          ? null
          : { string, fret, midi: STANDARD_TUNING[string] + fret, voice: 0 }
      )
      .filter((n): n is NonNullable<typeof n> => n !== null)
    const fretted = notes.filter((n) => n.fret > 0).map((n) => n.fret)
    return {
      notes,
      strings: frets,
      lowestFret: fretted.length ? Math.min(...fretted) : 0,
      highestFret: fretted.length ? Math.max(...fretted) : 0,
      span: 0,
      barreFret: null,
      fingersNeeded: fretted.length,
      innerMutes: [],
      position: 0,
      difficulty: 0,
      midiNotes: notes.map((n) => n.midi),
    }
  }

  it('calls shapes that lean on open strings "open"', () => {
    // x-0-x-0-2-0 — mostly open, one fretted note at the 2nd fret.
    expect(positionLabel(fingeringWithFrets([null, 0, null, 0, 2, 0]))).toBe(
      'open pos.'
    )
    // All open strings.
    expect(positionLabel(fingeringWithFrets([0, null, 0, 0, 0, null]))).toBe(
      'open'
    )
  })

  it('names the position for shapes up the neck', () => {
    expect(positionLabel(fingeringWithFrets([null, 7, 9, 7, 8, null]))).toBe(
      '7th pos.'
    )
    expect(positionLabel(fingeringWithFrets([null, null, 2, 4, 3, 3]))).toBe(
      '2nd pos.'
    )
    expect(
      positionLabel(fingeringWithFrets([12, 14, 12, 12, null, null]))
    ).toBe('12th pos.')
  })
})

describe('triad voicings', () => {
  it('pulls the 1–3–5 triad out of a seventh chord', () => {
    const tones = triadTones(parseChord('Em7'))
    expect(tones?.map((t) => t.degree)).toEqual(['R', '♭3', '5'])
    expect(triadTones(parseChord('A7'))?.map((t) => t.degree)).toEqual([
      'R',
      '3',
      '5',
    ])
    expect(triadTones(parseChord('DMaj7'))?.map((t) => t.degree)).toEqual([
      'R',
      '3',
      '5',
    ])
  })

  it('keeps sus, dim, and aug thirds and fifths', () => {
    expect(triadTones(parseChord('Asus4'))?.map((t) => t.degree)).toEqual([
      'R',
      '4',
      '5',
    ])
    expect(triadTones(parseChord('E°7'))?.map((t) => t.degree)).toEqual([
      'R',
      '♭3',
      '♭5',
    ])
    expect(triadTones(parseChord('C+'))?.map((t) => t.degree)).toEqual([
      'R',
      '3',
      '♯5',
    ])
  })

  it('builds close and spread stacks with three distinct tones', () => {
    const tones = triadTones(parseChord('C'))
    expect(tones).not.toBeNull()
    const close = buildTriadShape(tones!, TRIAD_GROUPS_BY_ID.Close, 0)
    expect(close.voiceTones.map((t) => t.degree)).toEqual(['R', '3', '5'])
    expect(close.span).toBeLessThan(12)

    const spread = buildTriadShape(tones!, TRIAD_GROUPS_BY_ID.Spread, 0)
    expect(new Set(spread.voiceTones.map((t) => t.semitones)).size).toBe(3)
    expect(spread.span).toBeGreaterThan(close.span)

    const first = buildTriadShape(tones!, TRIAD_GROUPS_BY_ID.Close, 1)
    expect(first.voiceTones[0].degree).toBe('3')
  })

  it('maps triad interval sets onto named suffixes', () => {
    expect(triadSuffixFromSemitones([0, 4, 7])).toBe('')
    expect(triadSuffixFromSemitones([0, 3, 7])).toBe('-')
    expect(triadSuffixFromSemitones([0, 4, 8])).toBe('+')
    expect(triadSuffixFromSemitones([0, 3, 6])).toBe('°')
    expect(triadSuffixFromSemitones([0, 2, 7])).toBe('sus2')
    expect(triadSuffixFromSemitones([0, 5, 7])).toBe('sus4')
    expect(triadSuffixFromSemitones([0, 3, 8])).toBeNull()
  })

  it('parses every triad quality chip to a three-tone triad', () => {
    for (const chip of TRIAD_QUALITY_CHIPS) {
      const tones = triadTones(parseChord(`C${chip.suffix}`))
      expect(tones, chip.label).not.toBeNull()
      expect(tones, chip.label).toHaveLength(3)
    }
  })

  it('finds playable close and spread shapes for C and Em7', () => {
    for (const symbol of ['C', 'Em7']) {
      const chord = parseChord(symbol)
      const result = generateAllTriads(chord)
      expect(result).toHaveLength(3)
      const close = result.find((g) => g.group.id === 'Close')
      const spread = result.find((g) => g.group.id === 'Spread')
      expect(close?.unreachable, symbol).toBe(false)
      expect(spread?.unreachable, symbol).toBe(false)
      expect(close?.inversions).toHaveLength(3)
    }
  })
})

describe('cross-string grips', () => {
  it('lists crossed fingerings that are not in the standard set', () => {
    const result = generateGroup(parseChord('Em7'), V_GROUPS_BY_ID['V-2'], {
      includeVariants: true,
    })
    const root = result.inversions[0]
    expect(root.crossed?.length).toBeGreaterThan(0)
    const standardTabs = new Set(
      root.voicings.map((v) => tabLabel(v.fingering))
    )
    for (const voicing of root.crossed ?? []) {
      expect(standardTabs.has(tabLabel(voicing.fingering))).toBe(false)
      expect(stringsCrossPitch(voicing.fingering.notes)).toBe(true)
      expect(voicing.variant).toBe('cross')
      expect(voicing.fingering.notes).toHaveLength(4)
    }
  })

  it('can look a crossed tab back up on the inversion', () => {
    const result = generateGroup(parseChord('Em7'), V_GROUPS_BY_ID['V-2'], {
      includeVariants: true,
    })
    const crossed = result.inversions[0].crossed?.[0]
    expect(crossed).toBeDefined()
    const tab = tabLabel(crossed!.fingering)
    const match = voicingMatchingTab(result.inversions[0], tab)
    expect(match?.id).toBe(crossed!.id)
    expect(match?.fingering.notes.map((n) => n.voice)).toEqual(
      crossed!.fingering.notes.map((n) => n.voice)
    )
  })

  it('skips variants on the 14-group grid', () => {
    const result = generateGroup(parseChord('Em7'), V_GROUPS_BY_ID['V-2'])
    expect(result.inversions[0].crossed).toEqual([])
  })

  it('lists crossed triad fingerings that are not in the standard set', () => {
    const result = generateTriadGroup(
      parseChord('C'),
      TRIAD_GROUPS_BY_ID.Close,
      { includeVariants: true }
    )
    const root = result.inversions[0]
    expect(root.crossed?.length).toBeGreaterThan(0)
    const standardTabs = new Set(
      root.voicings.map((v) => tabLabel(v.fingering))
    )
    for (const voicing of root.crossed ?? []) {
      expect(standardTabs.has(tabLabel(voicing.fingering))).toBe(false)
      expect(stringsCrossPitch(voicing.fingering.notes)).toBe(true)
      expect(voicing.variant).toBe('cross')
      expect(voicing.fingering.notes).toHaveLength(3)
    }
  })

  it('skips triad variants on the family grid', () => {
    const result = generateTriadGroup(parseChord('C'), TRIAD_GROUPS_BY_ID.Close)
    expect(result.inversions[0].crossed).toEqual([])
  })
})

describe('octave fret shift', () => {
  it('moves a mid-neck shape up and back down twelve frets', () => {
    const result = generateGroup(parseChord('Em7'), V_GROUPS_BY_ID['V-2'])
    const mid = result.inversions[0].voicings.find(
      (v) => v.fingering.lowestFret >= 5 && v.fingering.highestFret <= 10
    )
    expect(mid).toBeDefined()
    const up = shiftFingering(mid!.fingering, 12)
    expect(up).not.toBeNull()
    expect(up!.lowestFret).toBe(mid!.fingering.lowestFret + 12)
    expect(up!.notes.map((n) => n.midi)).toEqual(
      mid!.fingering.notes.map((n) => n.midi + 12)
    )
    const down = shiftFingering(up!, -12)
    expect(down?.strings).toEqual(mid!.fingering.strings)
  })

  it('turns open strings into twelfth-fret notes on the way up', () => {
    const result = generateGroup(parseChord('Em7'), V_GROUPS_BY_ID['V-2'])
    const openish = result.inversions[0].voicings.find((v) =>
      v.fingering.notes.some((n) => n.fret === 0)
    )
    expect(openish).toBeDefined()
    const up = shiftFingering(openish!.fingering, 12)
    expect(up).not.toBeNull()
    expect(up!.notes.every((n) => n.fret >= 12)).toBe(true)
    expect(shiftFingering(openish!.fingering, -12)).toBeNull()
  })

  it('lists low and high octave choices for a mid-neck shape', () => {
    const result = generateGroup(parseChord('Em7'), V_GROUPS_BY_ID['V-2'])
    const mid = result.inversions[0].voicings.find(
      (v) => v.fingering.lowestFret >= 5 && v.fingering.highestFret <= 10
    )
    expect(mid).toBeDefined()
    const choices = listOctaveShifts(mid!.fingering)
    expect(choices.map((c) => c.label)).toEqual(['Low', 'High'])
    expect(choices.find((c) => c.deltaFrets === 0)?.label).toBe('Low')
  })

  it('rebuilds a high-fret tab without searching the neck', () => {
    const rebuilt = fingeringFromTab('12-14-12-12-x-x')
    expect(rebuilt).not.toBeNull()
    expect(tabLabel(rebuilt!)).toBe('12-14-12-12-x-x')
    expect(rebuilt!.lowestFret).toBe(12)
  })
})
