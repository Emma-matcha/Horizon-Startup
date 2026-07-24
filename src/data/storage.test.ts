import { beforeEach, describe, expect, it } from 'vitest'

import {
  createDemoSessions,
  loadAppData,
  saveSession,
  updateProfile,
} from './storage'

describe('local screening storage', () => {
  beforeEach(() => localStorage.clear())

  it('starts with a safe demo profile and a week of deterministic history', () => {
    const data = loadAppData()

    expect(data.version).toBe(1)
    expect(data.profile.nickname).toBe('体验者')
    expect(data.sessions).toHaveLength(7)
    expect(data.sessions).toEqual(createDemoSessions())
  })

  it('persists a sanitized nickname locally', () => {
    updateProfile({ nickname: '  小红屋 <script>  ' })

    expect(loadAppData().profile.nickname).toBe('小红屋 script')
  })

  it('keeps newly saved results newest-first', () => {
    const session = {
      id: 'session-test',
      completedAt: '2026-07-25T08:00:00.000Z',
      rightEye: 5.0,
      leftEye: 4.9,
      distanceMm: 2000,
      mode: 'keyboard' as const,
    }

    saveSession(session)

    expect(loadAppData().sessions[0]).toEqual(session)
  })

  it('recovers from malformed or incompatible local data', () => {
    localStorage.setItem('red-house-vision:v1', '{broken')
    expect(loadAppData().sessions).toHaveLength(7)

    localStorage.setItem(
      'red-house-vision:v1',
      JSON.stringify({ version: 99, profile: {}, sessions: [] }),
    )
    expect(loadAppData().version).toBe(1)
  })
})
