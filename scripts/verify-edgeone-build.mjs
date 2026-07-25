import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const EDGEONE_MAX_FILE_BYTES = 25_000_000
const MODEL_MANIFEST = 'vosk-model-small-cn-0.22.manifest.json'
const REQUIRED_HEADERS = [
  ['Cross-Origin-Opener-Policy', 'same-origin'],
  ['Cross-Origin-Embedder-Policy', 'require-corp'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'no-referrer'],
  ['Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)'],
]

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '..')

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await listFiles(path)))
    if (entry.isFile()) files.push(path)
  }
  return files
}

function assertRequiredHeaders(config) {
  const globalRule = config.headers?.find((rule) => rule.source === '/*')
  if (!globalRule || !Array.isArray(globalRule.headers)) {
    throw new Error('edgeone.json is missing the global /* header rule')
  }
  for (const [key, value] of REQUIRED_HEADERS) {
    const match = globalRule.headers.find((header) => header.key === key)
    if (!match || match.value !== value) {
      throw new Error(`edgeone.json is missing ${key}: ${value}`)
    }
  }
}

export async function verifyEdgeOneBuild(distDirectory) {
  const root = resolve(distDirectory)
  const indexPath = resolve(root, 'index.html')
  const configPath = resolve(root, 'edgeone.json')
  const modelsDirectory = resolve(root, 'models')
  const manifestPath = resolve(modelsDirectory, MODEL_MANIFEST)

  await stat(indexPath).catch(() => {
    throw new Error('EdgeOne upload root is missing index.html')
  })
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  assertRequiredHeaders(config)

  const files = await listFiles(root)
  let largestFileBytes = 0
  let largestFile = ''
  for (const path of files) {
    const fileStat = await stat(path)
    if (fileStat.size >= EDGEONE_MAX_FILE_BYTES) {
      throw new Error(
        `${relative(root, path)} is ${fileStat.size.toLocaleString('en-US')} bytes; every EdgeOne asset must be smaller than ${EDGEONE_MAX_FILE_BYTES.toLocaleString('en-US')} bytes`,
      )
    }
    if (path.startsWith(`${modelsDirectory}/`) && path.endsWith('.tar')) {
      throw new Error(`Raw Vosk tar leaked into deployment: ${relative(root, path)}`)
    }
    if (fileStat.size > largestFileBytes) {
      largestFileBytes = fileStat.size
      largestFile = relative(root, path)
    }
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (!Array.isArray(manifest.parts) || manifest.parts.length === 0) {
    throw new Error('Vosk model manifest has no parts')
  }
  const rebuiltHash = createHash('sha256')
  let rebuiltLength = 0
  for (const part of manifest.parts) {
    const partPath = resolve(modelsDirectory, part.path)
    const partBytes = await readFile(partPath)
    if (partBytes.byteLength !== part.byteLength) {
      throw new Error(
        `Vosk part ${part.path} declares ${part.byteLength} bytes but contains ${partBytes.byteLength}`,
      )
    }
    rebuiltHash.update(partBytes)
    rebuiltLength += partBytes.byteLength
  }
  if (rebuiltLength !== manifest.byteLength) {
    throw new Error(
      `Vosk manifest declares ${manifest.byteLength} bytes but parts contain ${rebuiltLength}`,
    )
  }
  const sha256 = rebuiltHash.digest('hex')
  if (sha256 !== manifest.sha256) {
    throw new Error(`Vosk part checksum mismatch: expected ${manifest.sha256}, received ${sha256}`)
  }

  return { fileCount: files.length, largestFile, largestFileBytes, modelSha256: sha256 }
}

async function main() {
  const result = await verifyEdgeOneBuild(resolve(projectRoot, 'dist'))
  console.log(
    `EdgeOne build verified: ${result.fileCount} files; largest ${result.largestFile} (${result.largestFileBytes.toLocaleString('en-US')} bytes)`,
  )
  console.log(`Verified Vosk SHA-256: ${result.modelSha256}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
