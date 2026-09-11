import { describe, expect, it } from 'vitest'

import { suggestKeyCenters, suggestionChipLabel } from './keySuggestions'

describe('key center suggestions', () => {
  it('places E-7 as ii of D first, then dorian i', () => {
    const keys = suggestKeyCenters(['E-7'])
    expect(keys[0]).toMatchObject({ keyRoot: 'D', mode: 'ionian', roman: 'II-7' })
    expect(keys.some((row) => row.keyRoot === 'E' && row.mode === 'dorian')).toBe(
      true,
    )
    expect(suggestionChipLabel(keys[0])).toBe('D · II-7')
  })

  it('places G7 as V of C', () => {
    const keys = suggestKeyCenters(['G7'])
    expect(keys[0]).toMatchObject({ keyRoot: 'C', mode: 'ionian', roman: 'V7' })
  })

  it('places CΔ7 as I of C', () => {
    const keys = suggestKeyCenters(['CΔ7'])
    expect(keys[0]).toMatchObject({ keyRoot: 'C', mode: 'ionian', roman: 'IΔ7' })
  })

  it('places Eø7 as iiø of D minor', () => {
    const keys = suggestKeyCenters(['Eø7'])
    expect(keys[0]).toMatchObject({
      keyRoot: 'D',
      mode: 'aeolian',
      roman: 'IIø7',
    })
  })

  it('prefers C when a group already has D-7 and G7', () => {
    const keys = suggestKeyCenters(['D-7', 'G7'])
    expect(keys[0].keyRoot).toBe('C')
    expect(keys[0].mode).toBe('ionian')
  })
})
