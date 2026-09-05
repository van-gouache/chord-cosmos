import {
  VOICING_DRAG_MIME,
  slotFromVoicingPayload,
  voicingPayload,
  type SequenceSlot,
} from '../state/songs'
import type { Voicing } from '../theory/voicings'

export function beginVoicingDrag(
  event: { dataTransfer: DataTransfer | null; stopPropagation: () => void },
  voicing: Voicing
): void {
  if (!event.dataTransfer) return
  event.stopPropagation()
  const payload = voicingPayload(voicing)
  event.dataTransfer.setData(VOICING_DRAG_MIME, payload)
  // Same JSON on text/plain so the drop still reads if a browser strips custom types.
  event.dataTransfer.setData('text/plain', payload)
  event.dataTransfer.effectAllowed = 'copy'
}

export function isVoicingDrag(types: readonly string[]): boolean {
  return types.some(
    (type) => type === VOICING_DRAG_MIME || type.toLowerCase() === VOICING_DRAG_MIME
  )
}

export function incomingVoicingFrom(
  dataTransfer: DataTransfer
): SequenceSlot | null {
  return (
    slotFromVoicingPayload(dataTransfer.getData(VOICING_DRAG_MIME)) ??
    slotFromVoicingPayload(dataTransfer.getData('text/plain'))
  )
}
