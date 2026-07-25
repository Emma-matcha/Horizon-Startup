export interface DisplayPreferences {
  version: 1
  referenceWordsEnabled: boolean
  feedbackSoundsEnabled: boolean
}
export const PREFERENCES_STORAGE_KEY = 'red-house-vision:preferences:v1'

const defaultPreferences = (): DisplayPreferences => ({
  version: 1,
  referenceWordsEnabled: true,
  feedbackSoundsEnabled: true,
})

function persist(preferences: DisplayPreferences): void {
  localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
}

export function loadPreferences(): DisplayPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY)
    if (!raw) {
      const defaults = defaultPreferences()
      persist(defaults)
      return defaults
    }
    const parsed = JSON.parse(raw) as Partial<DisplayPreferences>
    if (parsed.version !== 1 || typeof parsed.referenceWordsEnabled !== 'boolean') {
      throw new Error('Unsupported display preferences')
    }
    const feedbackSoundsEnabled = parsed.feedbackSoundsEnabled ?? true
    if (typeof feedbackSoundsEnabled !== 'boolean') {
      throw new Error('Unsupported feedback sound preference')
    }
    const preferences = {
      version: 1 as const,
      referenceWordsEnabled: parsed.referenceWordsEnabled,
      feedbackSoundsEnabled,
    }
    persist(preferences)
    return preferences
  } catch {
    const defaults = defaultPreferences()
    persist(defaults)
    return defaults
  }
}

export function saveReferenceWordsEnabled(enabled: boolean): DisplayPreferences {
  const next: DisplayPreferences = { ...loadPreferences(), referenceWordsEnabled: enabled }
  persist(next)
  return next
}

export function saveFeedbackSoundsEnabled(enabled: boolean): DisplayPreferences {
  const next: DisplayPreferences = { ...loadPreferences(), feedbackSoundsEnabled: enabled }
  persist(next)
  return next
}
