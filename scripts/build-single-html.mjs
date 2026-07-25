import { createHash } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '..')
const temporaryDirectory = resolve(projectRoot, '.single-html-build')
const temporaryHtmlPath = resolve(temporaryDirectory, 'index.html')
const outputPath = resolve(projectRoot, 'red-house-vision.html')
const heroPath = resolve(projectRoot, 'public/assets/church-meadow-hero.jpg')
const modelPath = resolve(projectRoot, 'public/models/vosk-model-small-cn-0.22.tar')

function assertStandalone(html) {
  const forbiddenPatterns = [
    [/<script\b[^>]*\bsrc\s*=/i, 'external script tag'],
    [/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/i, 'external stylesheet'],
    [/url\(["']?(?:\.\/|\/)?assets\/church-meadow-hero\.jpg["']?\)/i, 'external hero image'],
  ]

  for (const [pattern, label] of forbiddenPatterns) {
    if (pattern.test(html)) throw new Error(`Single HTML still contains an ${label}`)
  }
  if (!html.includes('id="embedded-vosk-model"')) {
    throw new Error('Single HTML does not contain the embedded Vosk model')
  }
  if (!html.includes('data:image/jpeg;base64,')) {
    throw new Error('Single HTML does not contain the embedded hero image')
  }
}

async function main() {
  await build({ configFile: resolve(projectRoot, 'vite.single.config.ts') })

  const [builtHtml, hero, model] = await Promise.all([
    readFile(temporaryHtmlPath, 'utf8'),
    readFile(heroPath),
    readFile(modelPath),
  ])
  const heroDataUrl = `data:image/jpeg;base64,${hero.toString('base64')}`
  const modelBase64 = model.toString('base64')
  const modelSha256 = createHash('sha256').update(model).digest('hex')

  let standaloneHtml = builtHtml
    .replaceAll('/assets/church-meadow-hero.jpg', heroDataUrl)
    .replaceAll('./assets/church-meadow-hero.jpg', heroDataUrl)

  const embeddedModel = [
    '<script',
    '  id="embedded-vosk-model"',
    '  type="application/octet-stream"',
    '  data-filename="vosk-model-small-cn-0.22.tar"',
    `  data-byte-length="${model.byteLength}"`,
    `  data-sha256="${modelSha256}"`,
    '>',
    modelBase64,
    '</script>',
  ].join('\n')

  standaloneHtml = standaloneHtml.replace('</body>', `${embeddedModel}\n</body>`)
  assertStandalone(standaloneHtml)

  await writeFile(outputPath, standaloneHtml)
  await rm(temporaryDirectory, { recursive: true, force: true })

  const outputSize = Buffer.byteLength(standaloneHtml)
  console.log(`Created red-house-vision.html (${(outputSize / 1024 / 1024).toFixed(1)} MiB)`)
  console.log(`Embedded Vosk SHA-256: ${modelSha256}`)
}

main().catch(async (error) => {
  await rm(temporaryDirectory, { recursive: true, force: true })
  console.error(error)
  process.exitCode = 1
})
