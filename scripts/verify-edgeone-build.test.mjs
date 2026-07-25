import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { verifyEdgeOneBuild } from './verify-edgeone-build.mjs'

const globalHeaders = [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
]

async function createValidDist() {
  const dist = await mkdtemp(join(tmpdir(), 'edgeone-dist-'))
  const models = join(dist, 'models')
  await mkdir(models)
  await writeFile(join(dist, 'index.html'), '<!doctype html><title>Red House</title>')
  await writeFile(join(dist, 'edgeone.json'), JSON.stringify({
    headers: [{ source: '/*', headers: globalHeaders }],
  }))
  await writeFile(join(models, 'test.part-01'), 'hello ')
  await writeFile(join(models, 'test.part-02'), 'world')
  await writeFile(join(models, 'vosk-model-small-cn-0.22.manifest.json'), JSON.stringify({
    version: 'vosk-model-small-cn-0.22',
    byteLength: 11,
    sha256: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    parts: [
      { path: 'test.part-01', byteLength: 6 },
      { path: 'test.part-02', byteLength: 5 },
    ],
  }))
  return dist
}

test('accepts a complete EdgeOne direct-upload directory', async () => {
  const dist = await createValidDist()
  const result = await verifyEdgeOneBuild(dist)

  assert.ok(result.fileCount >= 5)
  assert.ok(result.largestFileBytes > 0)
})

test('rejects a file at the conservative EdgeOne size boundary', async () => {
  const dist = await createValidDist()
  const oversizedPath = join(dist, 'oversized.bin')
  await writeFile(oversizedPath, '')
  const handle = await import('node:fs/promises').then(({ open }) => open(oversizedPath, 'r+'))
  await handle.truncate(25_000_000)
  await handle.close()

  await assert.rejects(() => verifyEdgeOneBuild(dist), /25,000,000/)
})

test('rejects an unsplit Vosk tar in the public model directory', async () => {
  const dist = await createValidDist()
  await writeFile(join(dist, 'models', 'leaked-model.tar'), 'raw model')

  await assert.rejects(() => verifyEdgeOneBuild(dist), /raw Vosk tar/i)
})

test('rejects a direct-upload directory without its root entry', async () => {
  const dist = await createValidDist()
  await import('node:fs/promises').then(({ rm }) => rm(join(dist, 'index.html')))

  await assert.rejects(() => verifyEdgeOneBuild(dist), /index\.html/)
})

test('rejects EdgeOne configuration without cross-origin isolation', async () => {
  const dist = await createValidDist()
  await writeFile(join(dist, 'edgeone.json'), JSON.stringify({
    headers: [{
      source: '/*',
      headers: globalHeaders.filter(({ key }) => key !== 'Cross-Origin-Embedder-Policy'),
    }],
  }))

  await assert.rejects(
    () => verifyEdgeOneBuild(dist),
    /Cross-Origin-Embedder-Policy/,
  )
})
