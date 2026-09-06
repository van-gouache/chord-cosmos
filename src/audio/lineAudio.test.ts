import { describe, expect, it } from 'vitest'

import { readLineAudio } from './lineAudio'

describe('line audio takes', () => {
  it('keeps a well-formed data-url take', () => {
    const take = readLineAudio({
      mimeType: 'audio/webm',
      duration: 2,
      data: `data:audio/webm;base64,${'A'.repeat(40)}`,
    })
    expect(take?.duration).toBe(2)
  })

  it('drops empty or oversized payloads', () => {
    expect(readLineAudio({ mimeType: 'audio/webm', duration: 1, data: 'x' })).toBeUndefined()
    expect(
      readLineAudio({
        mimeType: 'audio/webm',
        duration: 1,
        data: `data:audio/webm;base64,${'A'.repeat(40)}`.slice(0, 10),
      })
    ).toBeUndefined()
  })
})
