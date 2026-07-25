const EMBEDDED_MODEL_ID = 'embedded-vosk-model'
const BASE64_CHUNK_SIZE = 32_768
const MODEL_PARTS_TIMEOUT_MS = 60_000

interface VoskModelPart {
  path: string
  byteLength: number
}

interface VoskModelManifest {
  version: string
  byteLength: number
  sha256: string
  parts: VoskModelPart[]
}

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

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function validateManifest(value: unknown): VoskModelManifest {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid Vosk model manifest')
  }
  const manifest = value as Partial<VoskModelManifest>
  const validParts =
    Array.isArray(manifest.parts) &&
    manifest.parts.length > 0 &&
    manifest.parts.every(
      (part) =>
        part &&
        typeof part.path === 'string' &&
        part.path.length > 0 &&
        isPositiveInteger(part.byteLength),
    )
  if (
    typeof manifest.version !== 'string' ||
    manifest.version.length === 0 ||
    !isPositiveInteger(manifest.byteLength) ||
    typeof manifest.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(manifest.sha256) ||
    !validParts
  ) {
    throw new Error('Invalid Vosk model manifest')
  }
  return manifest as VoskModelManifest
}

function bytesToSha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is required to verify the Vosk model')
  }
  return globalThis.crypto.subtle.digest('SHA-256', bytes).then((digest) =>
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  )
}

function cacheModelBlob(bytes: Uint8Array): string {
  cachedObjectUrl = URL.createObjectURL(
    new Blob([bytes.buffer as ArrayBuffer], { type: 'application/x-tar' }),
  )
  pageHideHandler = releaseCachedModel
  window.addEventListener('pagehide', pageHideHandler, { once: true })
  return cachedObjectUrl
}

async function resolveMultipartModel(manifestPath: string): Promise<string> {
  const abortController = new AbortController()
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      abortController.abort()
      reject(new DOMException('Vosk model parts timed out', 'TimeoutError'))
    }, MODEL_PARTS_TIMEOUT_MS)
  })

  const loadPromise = (async () => {
    const requestedManifestUrl = new URL(manifestPath, window.location.href)
    const manifestResponse = await fetch(requestedManifestUrl, { signal: abortController.signal })
    if (!manifestResponse.ok) {
      throw new Error(`Vosk model manifest request failed: ${manifestResponse.status}`)
    }
    const manifest = validateManifest(await manifestResponse.json())
    const manifestUrl = new URL(manifestResponse.url || requestedManifestUrl)
    const partBytes = await Promise.all(
      manifest.parts.map(async (part) => {
        const partUrl = new URL(part.path, manifestUrl)
        if (partUrl.origin !== manifestUrl.origin) {
          throw new Error('Vosk model parts must use the manifest origin')
        }
        const response = await fetch(partUrl, { signal: abortController.signal })
        if (!response.ok) {
          throw new Error(`Vosk model part request failed: ${response.status}`)
        }
        const bytes = new Uint8Array(await response.arrayBuffer())
        if (bytes.byteLength !== part.byteLength) {
          throw new Error(
            `Vosk model part length mismatch: expected ${part.byteLength}, received ${bytes.byteLength}`,
          )
        }
        return bytes
      }),
    )
    const totalLength = partBytes.reduce((total, bytes) => total + bytes.byteLength, 0)
    if (totalLength !== manifest.byteLength) {
      throw new Error(
        `Vosk model total length mismatch: expected ${manifest.byteLength}, received ${totalLength}`,
      )
    }
    const model = new Uint8Array(totalLength)
    let offset = 0
    for (const bytes of partBytes) {
      model.set(bytes, offset)
      offset += bytes.byteLength
    }
    const sha256 = await bytesToSha256Hex(model)
    if (sha256 !== manifest.sha256.toLowerCase()) {
      throw new Error(`Vosk model checksum mismatch: expected ${manifest.sha256}, received ${sha256}`)
    }
    return cacheModelBlob(model)
  })()

  try {
    return await Promise.race([loadPromise, timeoutPromise])
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId)
  }
}

export async function resolveEmbeddedVoskModelPath(defaultPath: string): Promise<string> {
  if (cachedObjectUrl) return cachedObjectUrl

  const payload = document.getElementById(EMBEDDED_MODEL_ID)?.textContent?.replace(/\s/g, '')
  if (!payload) {
    return defaultPath.endsWith('.manifest.json')
      ? resolveMultipartModel(defaultPath)
      : defaultPath
  }
  if (!isValidBase64(payload)) return defaultPath

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
    return cacheModelBlob(bytes)
  } catch {
    releaseCachedModel()
    return defaultPath
  }
}

export function resetEmbeddedVoskModelForTests(): void {
  releaseCachedModel()
}
