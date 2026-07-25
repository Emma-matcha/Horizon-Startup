export const REFERENCE_WORDS = [
  '天空',
  '白云',
  '远山',
  '绿树',
  '草地',
  '花园',
  '校门',
  '教室',
  '书本',
  '铅笔',
  '课桌',
  '黑板',
  '操场',
  '路灯',
  '车站',
  '路牌',
  '窗户',
  '楼梯',
  '雨伞',
  '水杯',
  '朋友',
  '街道',
  '商店',
  '公园',
  '河流',
  '小桥',
  '飞鸟',
  '风筝',
  '单车',
  '巴士',
  '火车',
  '灯塔',
  '海边',
  '森林',
  '屋顶',
  '阳光',
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
