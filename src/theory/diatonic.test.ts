import { describe, expect, it } from 'vitest'

import {
  diatonicSteps,
  progressionFamilies,
  progressionStepHint,
  romanBadge,
  romanForChord,
} from './diatonic'
import { tryParseChord } from './chords'

describe('diatonic steps', () => {
  it('builds C ionian sevenths with jazz roman labels', () => {
    const steps = diatonicSteps('C', 'ionian')
    expect(steps.map((step) => `${step.roman} ${step.symbol}`)).toEqual([
      'IΔ7 CΔ7',
      'II-7 D-7',
      'III-7 E-7',
      'IVΔ7 FΔ7',
      'V7 G7',
      'VI-7 A-7',
      'VIIø7 Bø7',
    ])
    for (const step of steps) {
      expect(tryParseChord(step.symbol).chord).toBeTruthy()
      expect(step.kind).toBe('diatonic')
      expect(step.children).toEqual([])
    }
  })

  it('spells Bb ionian with flats', () => {
    const steps = diatonicSteps('Bb', 'ionian')
    expect(steps.map((step) => step.symbol)).toEqual([
      'BbΔ7',
      'C-7',
      'D-7',
      'EbΔ7',
      'F7',
      'G-7',
      'Aø7',
    ])
  })

  it('rotates qualities for D dorian', () => {
    const steps = diatonicSteps('D', 'dorian')
    expect(steps[0]).toMatchObject({ roman: 'I-7', symbol: 'D-7' })
    expect(steps[3]).toMatchObject({ roman: 'IV7', symbol: 'G7' })
  })

  it('builds C harmonic minor, melodic minor, and harmonic major sevenths', () => {
    expect(
      diatonicSteps('C', 'harmonic-minor').map(
        (step) => `${step.roman} ${step.symbol}`
      )
    ).toEqual([
      'I-Δ7 C-Δ7',
      'IIø7 Dø7',
      'IIIΔ7♯5 EbΔ7♯5',
      'IV-7 F-7',
      'V7 G7',
      'VIΔ7 AbΔ7',
      'VII°7 B°7',
    ])
    expect(
      diatonicSteps('C', 'melodic-minor').map(
        (step) => `${step.roman} ${step.symbol}`
      )
    ).toEqual([
      'I-Δ7 C-Δ7',
      'II-7 D-7',
      'IIIΔ7♯5 EbΔ7♯5',
      'IV7 F7',
      'V7 G7',
      'VIø7 Aø7',
      'VIIø7 Bø7',
    ])
    expect(
      diatonicSteps('C', 'harmonic-major').map(
        (step) => `${step.roman} ${step.symbol}`
      )
    ).toEqual([
      'IΔ7 CΔ7',
      'IIø7 Dø7',
      'III-7 E-7',
      'IV-Δ7 F-Δ7',
      'V7 G7',
      'VIΔ7♯5 AbΔ7♯5',
      'VII°7 B°7',
    ])
  })
})

describe('non-diatonic families', () => {
  it('adds secondary dominants, borrowed chords, tritone subs, and passing °7 in C ionian', () => {
    const families = Object.fromEntries(
      progressionFamilies('C', 'ionian').map((family) => [family.id, family])
    )
    const symbols = (id: string) =>
      families[id].steps.map((step) => `${step.roman} ${step.symbol}`)

    expect(symbols('sixths')).toEqual(['I6 C6', 'IV6 F6', 'iv6 F-6'])
    expect(symbols('secondary-dominant')).toEqual([
      'V7/II A7',
      'V7/III B7',
      'V7/IV C7',
      'V7/V D7',
      'V7/VI E7',
    ])
    expect(symbols('secondary-half-dim')).toEqual([
      'IIø7/III F#ø7',
      'IIø7/VI Bø7',
    ])
    expect(symbols('tritone')).toEqual([
      'subV7 Db7',
      'subV7/II Eb7',
      'subV7/III F7',
      'subV7/IV Gb7',
      'subV7/V Ab7',
      'subV7/VI Bb7',
    ])
    expect(symbols('chromatic')).toEqual([
      'I7 C7',
      'II7 D7',
      'bII6 Db6',
      'bIIΔ7 DbΔ7',
      'bII7 Db7',
      'bIIIΔ7 EbΔ7',
      'bIII7 Eb7',
      'III7 E7',
      'iv-7 F-7',
      'IV7 F7',
      '#ivø7 F#ø7',
      'VI7 A7',
      'bVIΔ7 AbΔ7',
      'bVI7 Ab7',
      'VII7 B7',
      'bVIIΔ7 BbΔ7',
      'bVII7 Bb7',
      'vii°7 B°7',
    ])
    expect(symbols('borrowed')).toContain('i-7 C-7')
    expect(symbols('borrowed')).toContain('iiø7 Dø7')
    expect(symbols('passing-dim')).toEqual([
      'I°7 C°7',
      '#I°7 C#°7',
      '#II°7 D#°7',
      '#IV°7 F#°7',
      '#V°7 G#°7',
    ])

    for (const family of Object.values(families)) {
      for (const step of family.steps) {
        expect(tryParseChord(step.symbol).chord, step.symbol).toBeTruthy()
      }
    }
  })

  it('keeps V7 in A aeolian because the diatonic fifth is minor', () => {
    const families = progressionFamilies('A', 'aeolian')
    const diatonic = families.find((family) => family.id === 'diatonic')
    const secondary = families.find(
      (family) => family.id === 'secondary-dominant'
    )
    expect(diatonic?.steps.map((step) => step.roman)).toContain('V-7')
    expect(secondary?.steps.map((step) => step.roman)).toContain('V7')
    expect(secondary?.steps.find((step) => step.roman === 'V7')?.symbol).toBe(
      'E7'
    )
  })

  it('keeps two names for the same chord', () => {
    const labeled = progressionFamilies('C', 'ionian').flatMap((family) =>
      family.steps.map((step) => `${step.roman} ${step.symbol}`)
    )
    expect(labeled).toEqual(expect.arrayContaining([
      'subV7 Db7',
      'bII7 Db7',
      'V7/IV C7',
      'I7 C7',
      'subV7/III F7',
      'IV7 F7',
      'IIø7/III F#ø7',
      '#ivø7 F#ø7',
      'VIIø7 Bø7',
      'IIø7/VI Bø7',
    ]))
    const keys = labeled
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('names any chord in a key, preferring secondary function over chromatic', () => {
    expect(romanForChord('D-7', 'C', 'ionian')).toBe('II-7')
    expect(romanForChord('Dm7', 'C', 'ionian')).toBe('II-7')
    expect(romanForChord('A7', 'C', 'ionian')).toBe('V7/II')
    expect(romanForChord('D7', 'C', 'ionian')).toBe('V7/V')
    expect(romanForChord('Db6', 'C', 'ionian')).toBe('bII6')
    expect(romanForChord('Db7', 'C', 'ionian')).toBe('subV7')
    expect(romanForChord('C#7', 'C', 'ionian')).toBe('subV7')
    expect(romanForChord('F-7', 'C', 'ionian')).toBe('iv-7')
    expect(romanForChord('G13', 'C', 'ionian')).toBe('V13')
    expect(romanForChord('D-7', 'Bb', 'ionian')).toBe('III-7')
    expect(romanForChord('E-7', null, 'ionian')).toBeUndefined()
  })

  it('treats GΔ7 as III in E dorian, including #11 / rootless colors', () => {
    expect(romanForChord('GΔ7', 'E', 'dorian')).toBe('IIIΔ7')
    expect(romanForChord('GMaj7', 'E', 'dorian')).toBe('IIIΔ7')
    expect(romanForChord('G[3,b5,5,7]', 'E', 'dorian')).toBe(
      'IIIΔ7♯11(add5)-R'
    )
    expect(romanBadge(romanForChord('G[3,b5,5,7]', 'E', 'dorian')!)).toBe(
      'IIIΔ7♯11'
    )
    expect(romanBadge('V7/II')).toBe('V7/II')
    expect(romanBadge('II-7')).toBe('II-7')
  })
})

describe('progression step hints', () => {
  it('describes typical jazz uses for C ionian chips', () => {
    const byRoman = Object.fromEntries(
      progressionFamilies('C', 'ionian').flatMap((family) =>
        family.steps.map((step) => [step.roman, progressionStepHint(step)])
      )
    )
    expect(byRoman['II-7']).toMatch(/II–V–I/)
    expect(byRoman['V7/II']).toMatch(/V7 of II/)
    expect(byRoman['II-7/III']).toMatch(/ii of III/)
    expect(byRoman['subV7']).toMatch(/tritone sub/)
    expect(byRoman['bII7']).toMatch(/subV7/)
    expect(byRoman['I6']).toMatch(/tonic sixth/)
    expect(byRoman['iv6']).toMatch(/iv6/)
    expect(byRoman['#ivø7']).toMatch(/IIø7\/III/)
    expect(byRoman['vii°7']).toMatch(/leading-tone/)
    expect(byRoman['I°7']).toMatch(/common-tone/)
    expect(byRoman['#V°7']).toMatch(/V and VI/)
    expect(byRoman['iv-7']).toMatch(/minor iv/)
    expect(byRoman['#IV°7']).toMatch(/IV and V/)
  })
})
