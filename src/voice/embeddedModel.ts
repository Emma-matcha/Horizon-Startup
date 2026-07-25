const EMBEDDED_MODEL_ID = 'embedded-vosk-model'
const BASE64_CHUNK_SIZE = 32_768

let cachedObjectUrl: string | null = null
let pageHideHandler: (() => void) | null = null

function releaseCachedModel(): void {
  if (cachedObjectUrl) {
    URL.revokeObjectURL(cachedObjectUrl)
    cachedObjectUrl = null
  }
  if (pageHideHandler) {
    window.removeEventListener('pagehide', pageHideHandler)
    pageHideHandler = null
  }
}

function isValidBase64(value: string): boolean {
  return value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value)
}

export async function resolveEmbeddedVoskModelPath(defaultPath: string): Promise<string> {
  if (cachedObjectUrl) return cachedObjectUrl

  const payload = document.getElementById(EMBEDDED_MODEL_ID)?.textContent?.replace(/\s/g, '')
  if (!payload || !isValidBase64(payload)) return defaultPath

  try {
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
    const bytes = new Uint8Array((payload.length / 4) * 3 - padding)
    let writeOffset = 0
    for (let offset = 0; offset < payload.length; offset += BASE64_CHUNK_SIZE) {
      const decoded = atob(payload.slice(offset, offset + BASE64_CHUNK_SIZE))
      for (let index = 0; index < decoded.length; index += 1) {
        bytes[writeOffset] = decoded.charCodeAt(index)
        writeOffset += 1
      }
      if (offset > 0 && offset % (BASE64_CHUNK_SIZE * 128) === 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
      }
    }
    cachedObjectUrl = URL.createObjectURL(
      new Blob([bytes.buffer as ArrayBuffer], { type: 'application/x-tar' }),
    )
    pageHideHandler = releaseCachedModel
    window.addEventListener('pagehide', pageHideHandler, { once: true })
    return cachedObjectUrl
  } catch {
    releaseCachedModel()
    return defaultPath
  }
}

export function resetEmbeddedVoskModelForTests(): void {
  releaseCachedModel()
}
