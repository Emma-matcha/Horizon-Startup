import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()

describe('Windows launcher contract', () => {
  it('provides a double-click batch entry without requiring administrator rights', () => {
    const batch = readFileSync(join(projectRoot, 'start-windows.bat'), 'utf8')

    expect(batch).toContain('powershell.exe')
    expect(batch).toContain('-NoProfile')
    expect(batch).toContain('scripts\\start-windows.ps1')
    expect(batch.toLowerCase()).not.toContain('runas')
  })

  it('checks Node, supports pnpm or npm, and opens the fixed local URL after readiness', () => {
    const launcher = readFileSync(
      join(projectRoot, 'scripts', 'start-windows.ps1'),
      'utf8',
    )

    expect(launcher).toContain('Get-Command node.exe')
    expect(launcher).toContain('20.19.0')
    expect(launcher).toContain('22.12.0')
    expect(launcher).toContain('pnpm.cmd')
    expect(launcher).toContain('npm.cmd')
    expect(launcher).toContain('vite.cmd')
    expect(launcher).toContain('vosk-model-small-cn-0.22.tar')
    expect(launcher).toContain('run build')
    expect(launcher).toContain('run start')
    expect(launcher).toContain('http://127.0.0.1:4173/')
    expect(launcher).toContain('Invoke-WebRequest')
  })
})
