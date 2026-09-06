import { useCallback, useEffect, useState } from 'react'

import {
  listAudioInputs,
  requestAudioInputAccess,
  type AudioInput,
} from '../audio/devices'

interface Props {
  value: string
  onChange: (deviceId: string) => void
  compact?: boolean
}

export function AudioInputSelect({ value, onChange, compact = false }: Props) {
  const [inputs, setInputs] = useState<AudioInput[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setInputs(await listAudioInputs())
    } catch {
      setInputs([])
    }
  }, [])

  useEffect(() => {
    void refresh()
    const media = navigator.mediaDevices
    if (!media?.addEventListener) return
    media.addEventListener('devicechange', refresh)
    return () => media.removeEventListener('devicechange', refresh)
  }, [refresh])

  const enable = async () => {
    setBusy(true)
    setError(null)
    try {
      const next = await requestAudioInputAccess(value || undefined)
      setInputs(next)
    } catch {
      setError('Could not reach the microphone. Check browser permissions.')
    } finally {
      setBusy(false)
    }
  }

  const unlabeled = inputs.length > 0 && inputs.every((input) =>
    input.label.startsWith('Microphone ')
  )

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {!compact && (
        <>
          <p className="text-sm font-medium text-cosmos-100">Audio input</p>
          <p className="text-[11px] leading-relaxed text-cosmos-400">
            Microphone used when you record a take on a Line box. Stays on this
            device.
          </p>
        </>
      )}
      <select
        aria-label="Audio input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={
          compact
            ? 'h-7 w-full rounded-md border border-cosmos-700 bg-cosmos-900 px-1.5 text-[11px] text-cosmos-100 outline-none focus:border-nebula-500'
            : 'h-8 w-full rounded-md border border-cosmos-700 bg-cosmos-900 px-2 text-sm text-cosmos-100 outline-none focus:border-nebula-500'
        }
      >
        <option value="">System default</option>
        {inputs.map((input) => (
          <option key={input.id || input.label} value={input.id}>
            {input.label}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void enable()}
          disabled={busy}
          className="rounded-md border border-cosmos-700 px-2 py-1 text-[11px] text-cosmos-300 transition hover:border-nebula-500 hover:text-white disabled:opacity-40"
        >
          {unlabeled || inputs.length === 0 ? 'Allow microphone' : 'Refresh'}
        </button>
        {error ? (
          <p className="text-[11px] text-rose-300">{error}</p>
        ) : null}
      </div>
    </div>
  )
}
