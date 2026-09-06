import { openAudioInput, pickRecorderMime } from './devices'

export const MAX_LINE_RECORD_SECONDS = 12
const MAX_LINE_AUDIO_CHARS = 1_200_000

export interface LineAudio {
  mimeType: string
  duration: number
  data: string
}

const players = new Set<HTMLAudioElement>()

export function readLineAudio(value: unknown): LineAudio | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Partial<LineAudio>
  if (
    typeof raw.mimeType !== 'string' ||
    typeof raw.data !== 'string' ||
    typeof raw.duration !== 'number' ||
    !Number.isFinite(raw.duration) ||
    raw.duration <= 0 ||
    raw.data.length < 32 ||
    raw.data.length > MAX_LINE_AUDIO_CHARS
  ) {
    return undefined
  }
  return {
    mimeType: raw.mimeType,
    duration: raw.duration,
    data: raw.data,
  }
}

export function stopLineAudio(): void {
  for (const player of players) {
    player.pause()
    player.removeAttribute('src')
    player.load()
  }
  players.clear()
}

export function playLineAudio(clip: LineAudio): void {
  stopLineAudio()
  const player = new Audio(clip.data)
  players.add(player)
  player.onended = () => {
    players.delete(player)
  }
  void player.play().catch(() => {
    players.delete(player)
  })
}

export interface LineRecorder {
  stop: () => Promise<LineAudio>
  cancel: () => void
}

export async function startLineRecording(deviceId?: string): Promise<LineRecorder> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('This browser cannot record audio.')
  }
  const stream = await openAudioInput(deviceId)
  const mimeType = pickRecorderMime()
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream)
  const chunks: Blob[] = []
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  const started = performance.now()
  recorder.start()

  const release = () => {
    stream.getTracks().forEach((track) => track.stop())
  }

  return {
    cancel: () => {
      if (recorder.state !== 'inactive') recorder.stop()
      release()
    },
    stop: () =>
      new Promise((resolve, reject) => {
        const finish = async () => {
          release()
          const duration = (performance.now() - started) / 1000
          if (chunks.length === 0) {
            reject(new Error('Nothing was recorded.'))
            return
          }
          const blob = new Blob(chunks, {
            type: recorder.mimeType || mimeType || 'audio/webm',
          })
          const data = await blobToDataUrl(blob)
          if (data.length > MAX_LINE_AUDIO_CHARS) {
            reject(new Error('That take is too long to keep on this device.'))
            return
          }
          resolve({
            mimeType: blob.type || 'audio/webm',
            duration: Math.max(0.05, duration),
            data,
          })
        }
        recorder.addEventListener('error', () => {
          release()
          reject(new Error('Recording failed.'))
        })
        recorder.addEventListener('stop', () => {
          void finish().catch(reject)
        })
        if (recorder.state === 'inactive') {
          void finish().catch(reject)
          return
        }
        recorder.stop()
      }),
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Could not save take.'))
    reader.readAsDataURL(blob)
  })
}
