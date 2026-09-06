import { describe, expect, it } from 'vitest'

import { defaultStarterSongs } from './starter'

describe('starter sequence', () => {
  it('loads Autumn Leafs as the empty-library default', () => {
    const songs = defaultStarterSongs()
    expect(songs).toHaveLength(1)
    expect(songs[0].name).toContain('Autumn Leafs')
    expect(songs[0].bpm).toBe(111)
    expect(songs[0].sections.map((section) => section.name)).toEqual([
      'A1',
      'A2',
      'B1',
    ])
  })
})
