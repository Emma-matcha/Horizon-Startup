import assert from 'node:assert/strict'
import { access, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { prepareEdgeOneBuild } from './prepare-edgeone-build.mjs'

test('removes the legacy _headers file from an EdgeOne upload root', async () => {
  const dist = await mkdtemp(join(tmpdir(), 'edgeone-prepare-'))
  const headersPath = join(dist, '_headers')
  await writeFile(headersPath, '/*\n  X-Content-Type-Options: nosniff\n')

  await prepareEdgeOneBuild(dist)

  await assert.rejects(() => access(headersPath), { code: 'ENOENT' })
})
