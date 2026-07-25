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
})
