export const REFERENCE_WORDS = [
  'sky',
  'cloud',
  'hill',
  'tree',
  'grass',
  'field',
  'garden',
  'school',
  'class',
  'pencil',
  'desk',
  'board',
  'road',
  'light',
  'train',
  'sign',
  'door',
  'stair',
  'rain',
  'water',
  'cup',
  'friend',
  'street',
  'shop',
  'park',
  'river',
  'bridge',
  'bird',
  'kite',
  'bike',
  'bus',
  'home',
  'beach',
  'woods',
  'roof',
  'sun',
] as const

function secureRandomUnit(): number {
  if (globalThis.crypto?.getRandomValues) {
    const entropy = new Uint32Array(1)
    globalThis.crypto.getRandomValues(entropy)
    return entropy[0] / 0x1_0000_0000
  }
  return Math.random()
}
export function selectNextReferenceWord(
  history: readonly string[],
  random: () => number = secureRandomUnit,
): string {
  const unseen = REFERENCE_WORDS.filter((word) => !history.includes(word))
  const previous = history.at(-1)
  const nonRepeating = REFERENCE_WORDS.filter((word) => word !== previous)
  const candidates = unseen.length > 0 ? unseen : nonRepeating
  const draw = random()
  const normalizedDraw = Number.isFinite(draw)
    ? Math.min(Math.max(draw, 0), 1 - Number.EPSILON)
    : 0

  return candidates[Math.floor(normalizedDraw * candidates.length)]
}
