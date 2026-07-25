import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { splitVoskModel } from './vosk-model-parts.mjs'

test('writes ordered parts below the limit and a verifiable manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vosk-parts-'))
  const source = join(root, 'model.tar')
  const checksum = join(root, 'model.sha256')
  const output = join(root, 'dist', 'models')
  const bytes = Buffer.from('abcdefghijkl')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  await writeFile(source, bytes)
  await writeFile(checksum, `${sha256}  model.tar\n`)

  const manifest = await splitVoskModel({
    sourcePath: source,
    checksumPath: checksum,
    outputDirectory: output,
    partSizeBytes: 5,
  })

  assert.deepEqual(manifest.parts.map((part) => part.byteLength), [5, 5, 2])
  const rebuilt = Buffer.concat(
    await Promise.all(
      manifest.parts.map((part) => readFile(join(output, part.path))),
    ),
  )
  assert.deepEqual(rebuilt, bytes)
  assert.equal(manifest.sha256, sha256)
})

test('rejects a source whose checksum does not match', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vosk-bad-checksum-'))
  const source = join(root, 'model.tar')
  const checksum = join(root, 'model.sha256')
  await writeFile(source, Buffer.from('model bytes'))
  await writeFile(checksum, `${'0'.repeat(64)}  model.tar\n`)

  await assert.rejects(
    () =>
      splitVoskModel({
        sourcePath: source,
        checksumPath: checksum,
        outputDirectory: join(root, 'dist', 'models'),
        partSizeBytes: 5,
      }),
    /checksum mismatch/i,
  )
})
