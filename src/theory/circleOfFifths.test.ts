import { describe, expect, it } from 'vitest'

import {
  circleCaption,
  circleNameForPc,
  fifthsDegreeAtSlot,
  fifthsFromC,
  fifthsFromKey,
} from './circleOfFifths'

describe('circle of fifths', () => {
  it('counts fifths clockwise from C', () => {
    expect(fifthsFromC(0)).toBe(0)
    expect(fifthsFromC(7)).toBe(1)
    expect(fifthsFromC(2)).toBe(2)
    expect(fifthsFromC(5)).toBe(11)
  })

  it('places G as V of C and F as IV', () => {
    expect(fifthsFromKey(0, 7)).toBe(1)
    expect(fifthsFromKey(0, 5)).toBe(11)
    expect(circleCaption('C', 'G', 1)).toMatch(/V of C/)
    expect(circleCaption('C', 'F', 11)).toMatch(/IV of C/)
  })

  it('places E as III of C (four fifths sharp)', () => {
    expect(fifthsFromKey(0, 4)).toBe(4)
    expect(circleNameForPc(4)).toBe('E')
  })

  it('labels C-top slots from the key without rotating the wheel', () => {
    expect(fifthsDegreeAtSlot(0, 0)).toBe('I')
    expect(fifthsDegreeAtSlot(0, 1)).toBe('V')
    expect(fifthsDegreeAtSlot(7, 0)).toBe('IV')
    expect(fifthsDegreeAtSlot(7, 1)).toBe('I')
  })
})
