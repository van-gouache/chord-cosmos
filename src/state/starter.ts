import autumnLeafs from '../data/autumn-leafs.json'
import { createSong, readImportedSongs, type Song } from './songs'

/** Sequence shown the first time the library is empty. */
export function defaultStarterSongs(): Song[] {
  const songs = readImportedSongs(autumnLeafs)
  return songs.length > 0 ? songs : [createSong('My sequence')]
}
