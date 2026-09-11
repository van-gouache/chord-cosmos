import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  libraryForJsonExport,
  songForJsonExport,
  songSummary,
  type Song,
} from '../state/songs'

const PAGE_SIZE = 8

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
  const [page, setPage] = useState(0)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importNotice, setImportNotice] = useState<string | null>(null)

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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageStart = currentPage * PAGE_SIZE
  const visible = filtered.slice(pageStart, pageStart + PAGE_SIZE)
  const rangeStart = filtered.length === 0 ? 0 : pageStart + 1
  const rangeEnd = Math.min(filtered.length, pageStart + visible.length)

  useEffect(() => {
    setPage(0)
  }, [query])

  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(0, pageCount - 1)))
  }, [pageCount])

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
        return
      }
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setPage((current) => Math.max(0, current - 1))
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setPage((current) => Math.min(pageCount - 1, current + 1))
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
  }, [onClose, open, pageCount])

  if (!open) return null

  const downloadJson = (song: Song) => {
    downloadBlob(
      JSON.stringify(songForJsonExport(song), null, 2),
      `${slug(song.name)}.json`,
    )
  }

  const downloadLibrary = () => {
    downloadBlob(
      JSON.stringify(libraryForJsonExport(songs), null, 2),
      `chord-cosmos-backup-${backupStamp()}.json`,
    )
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    setImportError(null)
    setImportNotice(null)
    try {
      const text = await file.text()
      const added = onImport(JSON.parse(text))
      if (added === 0) {
        setImportError('That file did not contain a sequence.')
        return
      }
      setImportNotice(
        added === 1
          ? 'Added 1 sequence beside the ones you already have.'
          : `Added ${added} sequences beside the ones you already have.`,
      )
    } catch {
      setImportError('Could not read that file as JSON.')
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-cosmos-950/80 p-3 backdrop-blur-sm sm:p-5 lg:p-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="song-manager-title"
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-nebula-500/40 bg-cosmos-900 shadow-[0_24px_80px_-24px_rgba(79,108,255,0.4)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-cosmos-700/70 px-5 py-4 sm:px-6">
          <div>
            <h2
              id="song-manager-title"
              className="text-lg font-semibold tracking-tight text-white sm:text-xl"
            >
              Sequences
            </h2>
            <p className="mt-0.5 text-sm text-cosmos-400">
              {songs.length} saved · switch, duplicate, or backup every sequence
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

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-cosmos-700/60 px-5 py-3 sm:px-6">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sequences…"
            aria-label="Search sequences"
            className="min-w-[160px] flex-1 rounded-lg border border-cosmos-700 bg-cosmos-850 px-3 py-2 text-sm text-white outline-none placeholder:text-cosmos-600 focus:border-nebula-500"
          />
          <button
            type="button"
            onClick={onNew}
            className="rounded-lg bg-nebula-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-nebula-500"
          >
            New
          </button>
          <button
            type="button"
            disabled={songs.length === 0}
            onClick={downloadLibrary}
            className="rounded-lg border border-cosmos-700 px-3 py-2 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white disabled:opacity-40"
          >
            Backup all
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Add sequences from a JSON file without replacing the ones you have"
            className="rounded-lg border border-cosmos-700 px-3 py-2 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
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

        {importNotice && (
          <p className="shrink-0 px-5 pt-3 text-sm text-emerald-400 sm:px-6">
            {importNotice}
          </p>
        )}
        {importError && (
          <p className="shrink-0 px-5 pt-3 text-sm text-red-400 sm:px-6">
            {importError}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-cosmos-700 px-4 py-16 text-center text-sm text-cosmos-400">
              {query.trim()
                ? 'No sequences match that search.'
                : 'No sequences yet.'}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {visible.map((song) => {
                const active = song.id === activeSongId
                const pending = pendingDeleteId === song.id
                return (
                  <li
                    key={song.id}
                    className={`flex flex-col rounded-xl border p-4 ${
                      active
                        ? 'border-nebula-500/70 bg-nebula-500/10'
                        : 'border-cosmos-700/80 bg-cosmos-850/50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        value={song.name}
                        onChange={(event) =>
                          onRename(song.id, event.target.value)
                        }
                        aria-label={`Name of ${song.name}`}
                        className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-base font-semibold text-white outline-none hover:bg-cosmos-900 focus:bg-cosmos-900 focus:ring-1 focus:ring-nebula-500"
                      />
                      {active && (
                        <span className="shrink-0 rounded-md bg-nebula-600 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                          Open
                        </span>
                      )}
                    </div>
                    <p className="mt-1 px-1 text-sm text-cosmos-400">
                      {songSummary(song)} · {formatUpdated(song.updatedAt)}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
                      {!active && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(song.id)
                            onClose()
                          }}
                          className="rounded-lg bg-nebula-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-nebula-500"
                        >
                          Open
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDuplicate(song.id)}
                        className="rounded-lg border border-cosmos-700 px-2.5 py-1.5 text-xs text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadJson(song)}
                        className="rounded-lg border border-cosmos-700 px-2.5 py-1.5 text-xs text-cosmos-300 transition hover:border-nebula-500 hover:text-white"
                      >
                        JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(song.id)}
                        className="rounded-lg border border-cosmos-700 px-2.5 py-1.5 text-xs text-cosmos-400 transition hover:border-red-500/60 hover:text-red-400"
                      >
                        Delete
                      </button>
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
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-cosmos-700/70 px-5 py-3 sm:px-6">
          <p className="text-sm text-cosmos-400">
            {filtered.length === 0
              ? 'No sequences on this page'
              : `${rangeStart}–${rangeEnd} of ${filtered.length}`}
          </p>
          <div
            className="flex items-center gap-2"
            role="navigation"
            aria-label="Sequence pages"
          >
            <button
              type="button"
              disabled={currentPage <= 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              className="rounded-lg border border-cosmos-700 px-3 py-1.5 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white disabled:opacity-40"
            >
              Previous
            </button>
            <p className="min-w-[7rem] text-center text-sm text-cosmos-300">
              Page {currentPage + 1} of {pageCount}
            </p>
            <button
              type="button"
              disabled={currentPage >= pageCount - 1}
              onClick={() =>
                setPage((current) => Math.min(pageCount - 1, current + 1))
              }
              className="rounded-lg border border-cosmos-700 px-3 py-1.5 text-sm text-cosmos-300 transition hover:border-nebula-500 hover:text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  )
}

function downloadBlob(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function backupStamp(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
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
