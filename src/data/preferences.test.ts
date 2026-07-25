import { beforeEach, describe, expect, it } from 'vitest'

import {
  PREFERENCES_STORAGE_KEY,
  loadPreferences,
  saveFeedbackSoundsEnabled,
  saveReferenceWordsEnabled,
} from './preferences'

describe('local display preferences', () => {
  beforeEach(() => localStorage.clear())

  it('enables reference words and answer sounds by default', () => {
    expect(loadPreferences()).toEqual({
      version: 1,
      referenceWordsEnabled: true,
      feedbackSoundsEnabled: true,
    })
  })

  it('persists the reference-word switch locally', () => {
    saveReferenceWordsEnabled(false)

    expect(loadPreferences().referenceWordsEnabled).toBe(false)
    expect(loadPreferences().feedbackSoundsEnabled).toBe(true)
  })

  it('persists the answer-sound switch without changing the word setting', () => {
    saveReferenceWordsEnabled(false)
    saveFeedbackSoundsEnabled(false)

    expect(loadPreferences()).toEqual({
      version: 1,
      referenceWordsEnabled: false,
      feedbackSoundsEnabled: false,
    })
  })

  it('upgrades existing version-one settings with answer sounds enabled', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ version: 1, referenceWordsEnabled: false }),
    )

    expect(loadPreferences()).toEqual({
      version: 1,
      referenceWordsEnabled: false,
      feedbackSoundsEnabled: true,
    })
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
