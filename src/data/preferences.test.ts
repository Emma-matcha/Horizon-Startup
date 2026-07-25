import { beforeEach, describe, expect, it } from 'vitest'

import {
  PREFERENCES_STORAGE_KEY,
  loadPreferences,
  saveReferenceWordsEnabled,
} from './preferences'

describe('local display preferences', () => {
  beforeEach(() => localStorage.clear())

  it('shows reference words by default', () => {
    expect(loadPreferences()).toEqual({ version: 1, referenceWordsEnabled: true })
  })

  it('persists the reference-word switch locally', () => {
    saveReferenceWordsEnabled(false)

    expect(loadPreferences().referenceWordsEnabled).toBe(false)
  })

  it('recovers safely from damaged or incompatible settings', () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, '{broken')
    expect(loadPreferences().referenceWordsEnabled).toBe(true)

    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ version: 99, referenceWordsEnabled: false }),
    )
    expect(loadPreferences().referenceWordsEnabled).toBe(true)
  })
})
