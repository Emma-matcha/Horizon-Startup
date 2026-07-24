export interface LocalProfile {
  nickname: string
  consentAcceptedAt: string | null
}

export interface ScreeningSession {
  id: string
  completedAt: string
  rightEye: number
  leftEye: number
  distanceMm: number
  mode: 'voice' | 'keyboard'
}

export interface AppData {
  version: 1
  profile: LocalProfile
  sessions: ScreeningSession[]
}

export const STORAGE_KEY = 'red-house-vision:v1'

const demoScores = [
  [4.8, 4.9],
  [4.9, 4.9],
  [4.9, 5.0],
  [5.0, 4.9],
  [5.0, 5.0],
  [4.9, 5.0],
  [5.0, 4.9],
] as const

export function createDemoSessions(): ScreeningSession[] {
  return demoScores
    .map(([rightEye, leftEye], index) => ({
      id: `demo-${index + 1}`,
      completedAt: new Date(
        Date.UTC(2026, 6, 18 + index, 10, 30),
      ).toISOString(),
      rightEye,
      leftEye,
      distanceMm: 2000,
      mode: 'keyboard' as const,
    }))
    .reverse()
}

function createDefaultData(): AppData {
  return {
    version: 1,
    profile: { nickname: '体验者', consentAcceptedAt: null },
    sessions: createDemoSessions(),
  }
}

function isSession(value: unknown): value is ScreeningSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<ScreeningSession>
  return (
    typeof session.id === 'string' &&
    typeof session.completedAt === 'string' &&
    typeof session.rightEye === 'number' &&
    typeof session.leftEye === 'number' &&
    session.distanceMm === 2000 &&
    (session.mode === 'voice' || session.mode === 'keyboard')
  )
}

function sanitizeNickname(value: string): string {
  const sanitized = value
    .replace(/[<>/\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24)
  return sanitized || '体验者'
}

function persist(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const defaults = createDefaultData()
      persist(defaults)
      return defaults
    }
    const parsed = JSON.parse(raw) as Partial<AppData>
    if (
      parsed.version !== 1 ||
      !parsed.profile ||
      typeof parsed.profile.nickname !== 'string' ||
      !Array.isArray(parsed.sessions) ||
      !parsed.sessions.every(isSession)
    ) {
      throw new Error('Unsupported local data')
    }
    return {
      version: 1,
      profile: {
        nickname: sanitizeNickname(parsed.profile.nickname),
        consentAcceptedAt:
          typeof parsed.profile.consentAcceptedAt === 'string'
            ? parsed.profile.consentAcceptedAt
            : null,
      },
      sessions: parsed.sessions.slice(0, 120),
    }
  } catch {
    const defaults = createDefaultData()
    persist(defaults)
    return defaults
  }
}

export function updateProfile(update: Partial<LocalProfile>): AppData {
  const data = loadAppData()
  const next: AppData = {
    ...data,
    profile: {
      nickname:
        update.nickname === undefined
          ? data.profile.nickname
          : sanitizeNickname(update.nickname),
      consentAcceptedAt:
        update.consentAcceptedAt === undefined
          ? data.profile.consentAcceptedAt
          : update.consentAcceptedAt,
    },
  }
  persist(next)
  return next
}

export function saveSession(session: ScreeningSession): AppData {
  if (!isSession(session)) throw new Error('Invalid screening session')
  const data = loadAppData()
  const next: AppData = {
    ...data,
    sessions: [session, ...data.sessions.filter(({ id }) => id !== session.id)].slice(
      0,
      120,
    ),
  }
  persist(next)
  return next
}
