import { rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '..')

export async function prepareEdgeOneBuild(outputDirectory) {
  await rm(resolve(outputDirectory, '_headers'), { force: true })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareEdgeOneBuild(resolve(projectRoot, 'dist')).catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
