import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const EDGEONE_MAX_FILE_BYTES = 25_000_000
export const DEFAULT_PART_SIZE_BYTES = 20 * 1024 * 1024
export const MODEL_VERSION = 'vosk-model-small-cn-0.22'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '..')

function readExpectedSha256(checksumText) {
  const match = checksumText.trim().match(/^([a-fA-F0-9]{64})(?:\s|$)/)
  if (!match) throw new Error('Vosk checksum file does not contain a SHA-256 value')
  return match[1].toLowerCase()
}

export async function splitVoskModel({
  sourcePath,
  checksumPath,
  outputDirectory,
  partSizeBytes = DEFAULT_PART_SIZE_BYTES,
}) {
  if (!Number.isInteger(partSizeBytes) || partSizeBytes <= 0) {
    throw new Error('Vosk part size must be a positive integer')
  }
  if (partSizeBytes >= EDGEONE_MAX_FILE_BYTES) {
    throw new Error(
      `Vosk part size must be smaller than ${EDGEONE_MAX_FILE_BYTES.toLocaleString('en-US')} bytes`,
    )
  }

  const [model, checksumText] = await Promise.all([
    readFile(sourcePath),
    readFile(checksumPath, 'utf8'),
  ])
  const expectedSha256 = readExpectedSha256(checksumText)
  const sha256 = createHash('sha256').update(model).digest('hex')
  if (sha256 !== expectedSha256) {
    throw new Error(`Vosk checksum mismatch: expected ${expectedSha256}, received ${sha256}`)
  }

  await mkdir(outputDirectory, { recursive: true })
  const existingEntries = await readdir(outputDirectory, { withFileTypes: true })
  await Promise.all(
    existingEntries
      .filter(
        (entry) =>
          entry.isFile() &&
          (entry.name.startsWith(`${MODEL_VERSION}.part-`) ||
            entry.name === `${MODEL_VERSION}.manifest.json`),
      )
      .map((entry) => rm(resolve(outputDirectory, entry.name))),
  )

  const parts = []
  for (let offset = 0, index = 1; offset < model.byteLength; offset += partSizeBytes, index += 1) {
    const bytes = model.subarray(offset, Math.min(offset + partSizeBytes, model.byteLength))
    if (bytes.byteLength >= EDGEONE_MAX_FILE_BYTES) {
      throw new Error(
        `Generated Vosk part exceeds EdgeOne's ${EDGEONE_MAX_FILE_BYTES.toLocaleString('en-US')}-byte limit`,
      )
    }
    const path = `${MODEL_VERSION}.part-${String(index).padStart(2, '0')}`
    await writeFile(resolve(outputDirectory, path), bytes)
    parts.push({ path, byteLength: bytes.byteLength })
  }

  const manifest = {
    version: MODEL_VERSION,
    byteLength: model.byteLength,
    sha256,
    parts,
  }
  await writeFile(
    resolve(outputDirectory, `${MODEL_VERSION}.manifest.json`),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  return manifest
}

async function main() {
  const manifest = await splitVoskModel({
    sourcePath: resolve(projectRoot, 'models', `${MODEL_VERSION}.tar`),
    checksumPath: resolve(projectRoot, 'models', `${MODEL_VERSION}.sha256`),
    outputDirectory: resolve(projectRoot, 'dist', 'models'),
  })
  console.log(
    `Created ${manifest.parts.length} Vosk model parts (${manifest.byteLength.toLocaleString('en-US')} bytes)`,
  )
  console.log(`Vosk SHA-256: ${manifest.sha256}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
