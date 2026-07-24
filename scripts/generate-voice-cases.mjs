import { writeFile } from 'node:fs/promises'

const commands = ['上', '右', '下', '左']
const conditions = [
  ['安静', '正常'],
  ['安静', '轻声'],
  ['日常室内噪声', '正常'],
  ['键盘风扇噪声', '正常'],
  ['安静', '较快'],
]
const rows = ['case_id,speaker_id,age_group,spoken,expected,distance_m,condition,delivery,repetition']
let caseId = 1

for (let speaker = 1; speaker <= 10; speaker += 1) {
  for (const command of commands) {
    for (let repetition = 1; repetition <= 25; repetition += 1) {
      const [condition, delivery] = conditions[(repetition - 1) % conditions.length]
      rows.push([
        `P${String(caseId).padStart(4, '0')}`,
        `S${String(speaker).padStart(2, '0')}`,
        speaker <= 6 ? '青少年' : '成人',
        command,
        command,
        '2.0',
        condition,
        delivery,
        repetition,
      ].join(','))
      caseId += 1
    }
  }
}

const negativeWords = ['确认', '开始', '停止', '一二三', '今天']
for (let speaker = 1; speaker <= 10; speaker += 1) {
  for (const spoken of negativeWords) {
    for (let repetition = 1; repetition <= 4; repetition += 1) {
      rows.push([
        `N${String(caseId).padStart(4, '0')}`,
        `S${String(speaker).padStart(2, '0')}`,
        speaker <= 6 ? '青少年' : '成人',
        spoken,
        'REJECT_DIRECTION',
        '2.0',
        repetition % 2 ? '安静' : '日常室内噪声',
        '正常',
        repetition,
      ].join(','))
      caseId += 1
    }
  }
}

await writeFile(
  new URL('../docs/voice/mandarin-command-test-cases.csv', import.meta.url),
  `${rows.join('\n')}\n`,
  'utf8',
)
