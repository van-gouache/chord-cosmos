export interface AudioInput {
  id: string
  label: string
}

export async function listAudioInputs(): Promise<AudioInput[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((device) => device.kind === 'audioinput')
    .map((device, index) => ({
      id: device.deviceId,
      label: device.label.trim() || `Microphone ${index + 1}`,
    }))
}

export async function openAudioInput(deviceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser cannot record audio.')
  }
  const audio: MediaTrackConstraints = deviceId
    ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
    : { echoCancellation: true, noiseSuppression: true }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio })
  } catch (error) {
    if (!deviceId) throw error
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    })
  }
}

export async function requestAudioInputAccess(deviceId?: string): Promise<AudioInput[]> {
  const stream = await openAudioInput(deviceId)
  stream.getTracks().forEach((track) => track.stop())
  return listAudioInputs()
}

export function pickRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return ''
  }
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}
