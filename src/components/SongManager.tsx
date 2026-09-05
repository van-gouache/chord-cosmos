import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  countSlots,
  exportSong,
  songSummary,
  type Song,
} from '../state/songs'

interface Props {
  open: boolean
  songs: Song[]
  activeSongId: string | null
  onClose: () => void
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onImport: (value: unknown) => number
}

export function SongManager({
  open,
  songs,
  activeSongId,
  onClose,
  onSelect,
  onNew,
  onRename,
  onDuplicate,
  onDelete,
  onImport,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = [...songs].sort((a, b) => {
      if (a.id === activeSongId) return -1
      if (b.id === activeSongId) return 1
      return b.updatedAt - a.updatedAt
    })
    if (!needle) return list
    return list.filter((song) => song.name.toLowerCase().includes(needle))
  }, [activeSongId, query, songs])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
    })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [onClose, open])

  if (!open) return null

  const copyText = async (song: Song) => {
    try {
      await navigator.clipboard.writeText(exportSong(song))
      setCopiedId(song.id)
      window.setTimeout(() => setCopiedId(null), 1400)
    } catch {
      setImportError('Clipboard is blocked in this browser.')
    }
  }

  const downloadJson = (song: Song) => {
    const blob = new Blob([JSON.stringify(song, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${slug(song.name)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    setImportError(null)
    try {
      const text = await file.text()
      const added = onImport(JSON.parse(text))
      if (added === 0) {
        setImportError('That file did not contain a sequence.')
      }
    } catch {
      setImportError('Could not read that file as JSON.')
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-cosmos-950/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="song-manager-title"
        className="flex max-h-[min(720px,90vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-nebula-500/40 bg-cosmos-900 shadow-[0_24px_80px_-24px_rgba(139,92,246,0.55)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-cosmos-700/70 px-5 py-4">
          <div>
            <h2
              id="song-manager-title"
              className="text-lg font-semibold tracking-tight text-white"
            >
              Sequences
            </h2>
            <p className="mt-0.5 text-sm text-cosmos-400">
              {songs.length} saved · switch, duplicate, or import a backup
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-cosmos-700 px-2.5 py-1 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
          >
            Close
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-cosmos-700/60 px-5 py-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sequences…"
            aria-label="Search sequences"
            className="min-w-[160px] flex-1 rounded-lg border border-cosmos-700 bg-cosmos-850 px-3 py-1.5 text-sm text-white outline-none placeholder:text-cosmos-600 focus:border-nebula-500"
          />
          <button
            type="button"
            onClick={onNew}
            className="rounded-lg bg-nebula-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-nebula-500"
          >
            New
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-cosmos-700 px-3 py-1.5 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
          >
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              void handleImport(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </div>

        {importError && (
          <p className="shrink-0 px-5 pt-3 text-sm text-red-400">{importError}</p>
        )}

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {filtered.length === 0 && (
            <li className="rounded-xl border border-dashed border-cosmos-700 px-4 py-8 text-center text-sm text-cosmos-400">
              {query.trim()
                ? 'No sequences match that search.'
                : 'No sequences yet.'}
            </li>
          )}
          {filtered.map((song) => {
            const active = song.id === activeSongId
            const pending = pendingDeleteId === song.id
            return (
              <li
                key={song.id}
                className={`rounded-xl border p-3 ${
                  active
                    ? 'border-nebula-500/70 bg-nebula-500/10'
                    : 'border-cosmos-700/80 bg-cosmos-850/50'
                }`}
              >
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-[180px] flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        value={song.name}
                        onChange={(event) => onRename(song.id, event.target.value)}
                        aria-label={`Name of ${song.name}`}
                        className="w-full rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold text-white outline-none hover:bg-cosmos-900 focus:bg-cosmos-900 focus:ring-1 focus:ring-nebula-500"
                      />
                      {active && (
                        <span className="shrink-0 rounded-md bg-nebula-600 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                          Open
                        </span>
                      )}
                    </div>
                    <p className="mt-1 px-1 text-xs text-cosmos-400">
                      {songSummary(song)} · {formatUpdated(song.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!active && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(song.id)
                          onClose()
                        }}
                        className="rounded-lg bg-nebula-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-nebula-500"
                      >
                        Open
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDuplicate(song.id)}
                      className="rounded-lg border border-cosmos-700 px-2.5 py-1 text-xs text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyText(song)}
                      disabled={countSlots(song) === 0}
                      className="rounded-lg border border-cosmos-700 px-2.5 py-1 text-xs text-cosmos-300 transition hover:border-star-400 hover:text-star-300 disabled:opacity-40"
                    >
                      {copiedId === song.id ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadJson(song)}
                      className="rounded-lg border border-cosmos-700 px-2.5 py-1 text-xs text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
                    >
                      JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(song.id)}
                      className="rounded-lg border border-cosmos-700 px-2.5 py-1 text-xs text-cosmos-400 transition hover:border-red-500/60 hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {pending && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                    <p className="text-xs text-red-200">
                      Delete “{song.name}”? This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        className="rounded-md px-2 py-1 text-xs text-cosmos-300 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(song.id)
                          setPendingDeleteId(null)
                        }}
                        className="rounded-md bg-red-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>,
    document.body
  )
}

function slug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned || 'sequence'
}

function formatUpdated(stamp: number): string {
  try {
    return new Date(stamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}
