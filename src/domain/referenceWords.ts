export interface ReferenceWord {
  readonly en: string
  readonly zh: string
}

export const REFERENCE_WORDS: readonly ReferenceWord[] = [
  { en: 'sky', zh: '天空' },
  { en: 'cloud', zh: '云' },
  { en: 'hill', zh: '小山' },
  { en: 'tree', zh: '树' },
  { en: 'grass', zh: '草地' },
  { en: 'field', zh: '田野' },
  { en: 'garden', zh: '花园' },
  { en: 'school', zh: '学校' },
  { en: 'class', zh: '课堂' },
  { en: 'pencil', zh: '铅笔' },
  { en: 'desk', zh: '书桌' },
  { en: 'board', zh: '黑板' },
  { en: 'road', zh: '道路' },
  { en: 'light', zh: '灯光' },
  { en: 'train', zh: '火车' },
  { en: 'sign', zh: '标志' },
  { en: 'door', zh: '门' },
  { en: 'stair', zh: '楼梯' },
  { en: 'rain', zh: '雨' },
  { en: 'water', zh: '水' },
  { en: 'cup', zh: '杯子' },
  { en: 'friend', zh: '朋友' },
  { en: 'street', zh: '街道' },
  { en: 'shop', zh: '商店' },
  { en: 'park', zh: '公园' },
  { en: 'river', zh: '河流' },
  { en: 'bridge', zh: '桥' },
  { en: 'bird', zh: '鸟' },
  { en: 'kite', zh: '风筝' },
  { en: 'bike', zh: '自行车' },
  { en: 'bus', zh: '公交车' },
  { en: 'home', zh: '家' },
  { en: 'beach', zh: '海滩' },
  { en: 'woods', zh: '树林' },
  { en: 'roof', zh: '屋顶' },
  { en: 'sun', zh: '太阳' },
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
): ReferenceWord {
  const unseen = REFERENCE_WORDS.filter(({ en }) => !history.includes(en))
  const previous = history.at(-1)
  const nonRepeating = REFERENCE_WORDS.filter(({ en }) => en !== previous)
  const candidates = unseen.length > 0 ? unseen : nonRepeating
  const draw = random()
  const normalizedDraw = Number.isFinite(draw)
    ? Math.min(Math.max(draw, 0), 1 - Number.EPSILON)
    : 0

  return candidates[Math.floor(normalizedDraw * candidates.length)]
}
