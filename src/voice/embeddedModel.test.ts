import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  resetEmbeddedVoskModelForTests,
  resolveEmbeddedVoskModelPath,
} from './embeddedModel'

describe('embedded Vosk model', () => {
  afterEach(() => {
    resetEmbeddedVoskModelForTests()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('decodes the embedded model lazily and reuses its Blob URL', async () => {
    document.body.innerHTML = `
      <script id="embedded-vosk-model" type="application/octet-stream">
        aGVs bG8=
      </script>
    `
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:red-house-vosk')

    await expect(resolveEmbeddedVoskModelPath('/models/default.tar')).resolves.toBe(
      'blob:red-house-vosk',
    )
    await expect(resolveEmbeddedVoskModelPath('/models/default.tar')).resolves.toBe(
      'blob:red-house-vosk',
    )

    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0][0] as Blob
    await expect(blob.text()).resolves.toBe('hello')
  })

  it('keeps the normal model path when no embedded payload exists', async () => {
    await expect(resolveEmbeddedVoskModelPath('/models/default.tar')).resolves.toBe(
      '/models/default.tar',
    )
  })

  it('falls back safely when the embedded payload is invalid', async () => {
    document.body.innerHTML = `
      <script id="embedded-vosk-model" type="application/octet-stream">not-base64!</script>
    `

    await expect(resolveEmbeddedVoskModelPath('/models/default.tar')).resolves.toBe(
      '/models/default.tar',
    )
  })

  it('downloads, verifies, combines, and caches multipart models', async () => {
    const bytes = new TextEncoder().encode('hello world')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('.manifest.json')) {
        return new Response(JSON.stringify({
          version: 'test-model',
          byteLength: 11,
          sha256: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
          parts: [
            { path: 'test.part-01', byteLength: 6 },
            { path: 'test.part-02', byteLength: 5 },
          ],
        }))
      }
      return new Response(url.endsWith('01') ? bytes.slice(0, 6) : bytes.slice(6))
    })
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:multipart-vosk')

    await expect(
      resolveEmbeddedVoskModelPath('/models/test.manifest.json'),
    ).resolves.toBe('blob:multipart-vosk')
    await expect(
      resolveEmbeddedVoskModelPath('/models/test.manifest.json'),
    ).resolves.toBe('blob:multipart-vosk')

    const blob = createObjectURL.mock.calls[0][0] as Blob
    await expect(blob.text()).resolves.toBe('hello world')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('rejects a multipart model when the manifest request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }))

    await expect(
      resolveEmbeddedVoskModelPath('/models/test.manifest.json'),
    ).rejects.toThrow(/manifest request failed/i)
  })

  it('rejects a multipart model when a part length differs', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).endsWith('.manifest.json')) {
        return new Response(JSON.stringify({
          version: 'test-model',
          byteLength: 5,
          sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
          parts: [{ path: 'test.part-01', byteLength: 5 }],
        }))
      }
      return new Response('no')
    })

    await expect(
      resolveEmbeddedVoskModelPath('/models/test.manifest.json'),
    ).rejects.toThrow(/part length mismatch/i)
  })

  it('rejects a multipart model when the complete hash differs', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).endsWith('.manifest.json')) {
        return new Response(JSON.stringify({
          version: 'test-model',
          byteLength: 5,
          sha256: '0'.repeat(64),
          parts: [{ path: 'test.part-01', byteLength: 5 }],
        }))
      }
      return new Response('hello')
    })

    await expect(
      resolveEmbeddedVoskModelPath('/models/test.manifest.json'),
    ).rejects.toThrow(/checksum mismatch/i)
  })

  it('rejects a multipart model with an empty parts list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      version: 'test-model',
      byteLength: 5,
      sha256: '0'.repeat(64),
      parts: [],
    })))

    await expect(
      resolveEmbeddedVoskModelPath('/models/test.manifest.json'),
    ).rejects.toThrow(/invalid Vosk model manifest/i)
  })
})
