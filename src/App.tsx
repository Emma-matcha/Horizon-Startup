import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { BrandMark } from './components/BrandMark'
import { Optotype } from './components/Optotype'
import { TrendChart } from './components/TrendChart'
import {
  feedbackKindForAnswer,
  playFeedbackSound,
  primeFeedbackAudio,
} from './audio/feedback'
import {
  loadAppData,
  saveSession,
  updateProfile,
  type AppData,
  type ScreeningSession,
} from './data/storage'
import {
  loadPreferences,
  saveFeedbackSoundsEnabled,
  saveReferenceWordsEnabled,
} from './data/preferences'
import { analyzeTrend, type TrendStatus } from './domain/risk'
import {
  DEFAULT_CALIBRATION_CSS_PX,
  getCalibratedOptotypeCssPx,
} from './domain/calibration'
import {
  applyEyeAnswer,
  createEyeTestState,
  selectNextDirection,
  type EyeTestState,
} from './domain/testMachine'
import type { Direction } from './domain/optotype'
import { selectNextReferenceWord, type ReferenceWord } from './domain/referenceWords'
import {
  getReferenceWordFontCssPx,
  REFERENCE_WORD_FONT_FAMILY,
  REFERENCE_WORD_FONT_WEIGHT,
} from './domain/referenceWordSizing'
import type { VoiceCommand, VoiceEnginePreference, VoiceScope, VoiceState } from './voice/contracts'
import { speakInstruction, stopInstruction } from './voice/prompts'
import { useVoiceInput } from './voice/useVoiceInput'

type View =
  | 'home'
  | 'setup'
  | 'eyeGuide'
  | 'countdown'
  | 'test'
  | 'analysis'
  | 'report'
  | 'history'

type Eye = 'right' | 'left'

interface AnswerRecord {
  eye: Eye
  level: number
  shown: Direction
  answered: Direction
  correct: boolean
}

const directionName: Record<Direction, string> = {
  up: '上',
  right: '右',
  down: '下',
  left: '左',
}

const directionKey: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowLeft: 'left',
}

const DISTANCE_PROMPT = '请站到两米外。准备好后，请作答。'
const RIGHT_EYE_PROMPT = '请遮住左眼，接下来测试右眼。准备好后，请作答。'
const LEFT_EYE_PROMPT = '请遮住右眼，接下来测试左眼。准备好后，请作答。'

const riskCopy: Record<TrendStatus, { title: string; copy: string }> = {
  insufficient: {
    title: '继续积累记录',
    copy: '至少需要三次历史结果，才能判断变化趋势。',
  },
  stable: {
    title: '近期保持稳定',
    copy: '本次结果与近期中位水平接近，建议按相同条件持续记录。',
  },
  observe: {
    title: '出现轻微波动',
    copy: '建议休息后在相同光线、距离和设备条件下再次筛查。',
  },
  retest: {
    title: '建议尽快复测',
    copy: '结果较近期基线下降 0.2 或更多；若复测仍下降，请咨询专业眼科。',
  },
}

const isTestMode = () =>
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('test')

function voicePreferenceFromUrl(): VoiceEnginePreference | undefined {
  if (typeof window === 'undefined') return undefined
  const preference = new URLSearchParams(window.location.search).get('voice')
  return preference === 'vosk' ||
    preference === 'web-speech' ||
    preference === 'rhino' ||
    preference === 'keyboard'
    ? preference
    : undefined
}

function createSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? `screening-${Date.now()}`
}

function usePageMotion(view: View) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = ref.current
    if (
      !element ||
      view === 'home' ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) return
    let active = true
    void import('gsap').then(({ gsap }) => {
      if (!active) return
      gsap.fromTo(
        element,
        {
          opacity: 0,
          y: 28,
          scale: 0.985,
          filter: 'blur(14px)',
          clipPath: 'inset(5% 0 0 0 round 24px)',
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          clipPath: 'inset(0% 0 0 0 round 0px)',
          duration: 0.92,
          ease: 'power4.out',
        },
      )
    })
    return () => {
      active = false
    }
  }, [view])
  return ref
}

function AppHeader({ onHome }: { onHome: () => void }) {
  return (
    <header className="app-header">
      <button aria-label="返回首页" className="brand-button" onClick={onHome}>
        <BrandMark />
      </button>
    </header>
  )
}

function HomePage({
  onStart,
  onProfile,
  onSettings,
}: {
  onStart: () => void
  onProfile: () => void
  onSettings: () => void
}) {
  const heroRef = useRef<HTMLElement>(null)
  const interiorRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const paperWorldRef = useRef<HTMLDivElement>(null)
  const houseRef = useRef<HTMLImageElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const taglineRef = useRef<HTMLParagraphElement>(null)
  const startRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const hero = heroRef.current
    const interior = interiorRef.current
    const windowView = windowRef.current
    const paperWorld = paperWorldRef.current
    const house = houseRef.current
    const title = titleRef.current
    const tagline = taglineRef.current
    const start = startRef.current
    if (!hero || !interior || !windowView || !paperWorld || !house || !title || !tagline || !start) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      interior.style.display = 'none'
      paperWorld.style.opacity = '1'
      house.style.opacity = '1'
      title.style.opacity = '.16'
      tagline.style.opacity = '1'
      start.style.opacity = '1'
      hero.dataset.intro = 'complete'
      return
    }

    let timeline: GSAPTimeline | undefined
    let active = true
    void import('gsap').then(({ gsap }) => {
      if (!active) return
      timeline = gsap.timeline({
        onComplete: () => {
          gsap.set(house, { clearProps: 'transform,filter' })
          house.style.opacity = '1'
          hero.dataset.intro = 'complete'
        },
      })
      timeline
        .set([title, tagline, start, house], { opacity: 0 })
        .set(paperWorld, { scale: 1.06, filter: 'blur(5px)' })
        .fromTo(
          windowView,
          { scale: 0.92, y: 14, filter: 'blur(2px)' },
          { scale: 1.34, y: -8, filter: 'blur(0px)', duration: 1.65, ease: 'power2.inOut' },
        )
        .to(windowView, { scale: 4.8, y: -34, duration: 1.15, ease: 'power3.in' })
        .to(interior, { opacity: 0, duration: 0.42, ease: 'power2.out' }, '-=.38')
        .to(paperWorld, { scale: 1, filter: 'blur(0px)', duration: 2.05, ease: 'power3.out' }, '-=.42')
        .fromTo(
          house,
          {
            opacity: 0,
            scale: 1.06,
            x: 24,
            y: 34,
            rotate: 0,
            filter: 'blur(10px)',
            transformOrigin: '78% 50%',
          },
          {
            opacity: 1,
            scale: 1,
            x: 0,
            y: 0,
            rotate: 0,
            filter: 'blur(0px)',
            duration: 1.28,
            ease: 'power3.out',
          },
          '-=.46',
        )
        .fromTo(title, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.82, ease: 'power3.out' }, '-=.36')
        .fromTo(tagline, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.68, ease: 'power3.out' }, '-=.58')
        .fromTo(start, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.62, ease: 'power3.out' }, '-=.5')
    })
    return () => {
      active = false
      timeline?.kill()
    }
  }, [])

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const pointerX = event.clientX / window.innerWidth - 0.5
    const pointerY = event.clientY / window.innerHeight - 0.5
    heroRef.current?.style.setProperty('--far-x', `${pointerX * -7}px`)
    heroRef.current?.style.setProperty('--far-y', `${pointerY * -4}px`)
    heroRef.current?.style.setProperty('--mid-x', `${pointerX * -15}px`)
    heroRef.current?.style.setProperty('--mid-y', `${pointerY * -8}px`)
    heroRef.current?.style.setProperty('--near-x', `${pointerX * -27}px`)
    heroRef.current?.style.setProperty('--near-y', `${pointerY * -12}px`)
  }

  return (
    <main className="home" data-intro="pending" onPointerMove={onPointerMove} ref={heroRef}>
      <div className="home__interior" ref={interiorRef} aria-hidden="true">
        <div className="home__interior-glow" />
        <div className="home__interior-window" ref={windowRef} />
        <div className="home__interior-wall home__interior-wall--left" />
        <div className="home__interior-wall home__interior-wall--right" />
      </div>
      <div className="home__paper-world" ref={paperWorldRef} aria-hidden="true">
        <div className="home__paper-sky">
          <i className="home__paper-sun" />
          <i className="home__paper-cloud home__paper-cloud--one" />
          <i className="home__paper-cloud home__paper-cloud--two" />
        </div>
        <div className="home__paper-hill home__paper-hill--back" />
        <div className="home__paper-hill home__paper-hill--middle" />
        <div className="home__paper-hill home__paper-hill--front" />
      </div>
      <div className="home__scene" aria-hidden="true">
        <img alt="" className="home__house" ref={houseRef} src="/assets/red-house-hero-v2.png" />
      </div>
      <header className="home__header">
        <BrandMark iconOnly />
        <div className="home__header-actions">
          <button aria-label="打开设置" className="settings-button" onClick={onSettings}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 8.25A3.75 3.75 0 1 0 12 15.75 3.75 3.75 0 0 0 12 8.25Z" />
              <path d="M19.1 13.2a7.6 7.6 0 0 0 .04-2.31l2-1.56-2-3.47-2.5 1a7.4 7.4 0 0 0-2-1.16L14.26 3h-4.02l-.39 2.7a7.4 7.4 0 0 0-2 1.16l-2.5-1-2 3.47 2 1.56a7.6 7.6 0 0 0 .04 2.31l-2.04 1.58 2 3.47 2.57-1.03c.58.46 1.23.83 1.94 1.1l.38 2.68h4.02l.38-2.68a7.4 7.4 0 0 0 1.94-1.1l2.57 1.03 2-3.47-2.04-1.58Z" />
            </svg>
          </button>
          <button className="glass-button" onClick={onProfile}>登录</button>
        </div>
      </header>
      <section className="home__content">
        <h1 className="home__title" ref={titleRef}>Red House</h1>
        <p className="home__tagline" ref={taglineRef}>关注视力好帮手！</p>
        <button className="primary-button primary-button--hero" onClick={onStart} ref={startRef}>
          <span>开始</span><span aria-hidden="true">→</span>
        </button>
      </section>
      <footer className="home__footer">
        <span>仅作趋势参考，不能替代专业眼科检查</span>
      </footer>
    </main>
  )
}

function SettingsDialog({
  feedbackSoundsEnabled,
  referenceWordsEnabled,
  onClose,
  onToggleFeedbackSounds,
  onToggleReferenceWords,
}: {
  feedbackSoundsEnabled: boolean
  referenceWordsEnabled: boolean
  onClose: () => void
  onToggleFeedbackSounds: () => void
  onToggleReferenceWords: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="settings-title" aria-modal="true" className="settings-card" role="dialog">
        <button aria-label="关闭设置" className="close-button" onClick={onClose}>×</button>
        <h2 id="settings-title">显示</h2>
        <button
          aria-checked={referenceWordsEnabled}
          aria-label="显示英文参考词"
          className="settings-switch"
          onClick={onToggleReferenceWords}
          role="switch"
        >
          <span><strong>英文参考词</strong></span>
          <i aria-hidden="true" />
        </button>
        <button
          aria-checked={feedbackSoundsEnabled}
          aria-label="播放答题音效"
          className="settings-switch"
          onClick={onToggleFeedbackSounds}
          role="switch"
        >
          <span><strong>答题音效</strong></span>
          <i aria-hidden="true" />
        </button>
      </section>
    </div>
  )
}

function ConsentDialog({ onAccept, onClose }: { onAccept: () => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="consent-title" aria-modal="true" className="consent-card" role="dialog">
        <p className="eyebrow">开始前请确认</p>
        <h2 id="consent-title">这是筛查，不是诊断</h2>
        <p>结果受距离、光线与疲劳影响，只用于家庭趋势参考。</p>
        <ul>
          <li>记录仅保存在当前浏览器，不保存原始录音</li>
          <li>默认 Vosk 本地识别；在线备用可能由浏览器处理音频</li>
        </ul>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>暂不开始</button>
          <button className="primary-button" onClick={onAccept}>同意并继续</button>
        </div>
      </section>
    </div>
  )
}

function SetupPage({
  voiceLabel,
  voiceState,
  voiceEngine,
}: {
  voiceLabel: string
  voiceState: string
  voiceEngine: string
}) {
  return (
    <main className="setup-page-minimal">
      <div className="setup-measure-track" aria-hidden="true"><i /></div>
      <section className="setup-distance-copy">
        <h1>站到 2 米</h1>
      </section>
      <div
        aria-hidden="true"
        className="setup-voice-orb"
        data-engine={voiceEngine}
        data-state={voiceState}
      ><i aria-hidden="true" /></div>
      <p
        className="voice-status-copy"
        data-feedback={voiceLabel.startsWith('已听到') ? 'heard' : voiceState === 'fallback' ? 'missed' : 'listening'}
        data-state={voiceState}
        role="status"
      >
        <i aria-hidden="true" />
        <span>{voiceLabel}</span>
      </p>
    </main>
  )
}

function CountdownPage({ count, eye }: { count: number; eye: Eye }) {
  return (
    <main className="countdown-page" aria-live="assertive">
      <p>{eye === 'right' ? '右眼' : '左眼'} · 保持两米</p>
      <strong key={count}>{count}</strong>
      <span>看向屏幕中央</span>
    </main>
  )
}

function TestPage({
  eye,
  state,
  direction,
  calibrationPx,
  answerIndex,
  onAnswer,
  onReady,
  showDirectionPad,
  voiceState,
  voiceStatus,
  referenceWord,
  showReferenceWord,
}: {
  eye: Eye
  state: EyeTestState
  direction: Direction
  calibrationPx: number
  answerIndex: number
  onAnswer: (direction: Direction) => void
  onReady: () => void
  showDirectionPad: boolean
  voiceState: string
  voiceStatus: VoiceState
  referenceWord: ReferenceWord
  showReferenceWord: boolean
}) {
  const displaySize = getCalibratedOptotypeCssPx(state.level, calibrationPx)
  const referenceWordFontSize = getReferenceWordFontCssPx(referenceWord.en, displaySize)
  const referenceWordStyle: CSSProperties = {
    color: '#1c211d',
    fontFamily: REFERENCE_WORD_FONT_FAMILY,
    fontSize: `${referenceWordFontSize}px`,
    fontWeight: REFERENCE_WORD_FONT_WEIGHT,
    letterSpacing: '.04em',
  }
  return (
    <main className="test-page">
      <div className="test-meta">
        <span>{eye === 'right' ? '右眼' : '左眼'}</span>
        <span
          aria-label={`当前视力级别 ${state.level.toFixed(1)}`}
          className="optotype-level"
        >
          {state.level.toFixed(1)}
        </span>
      </div>
      <div
        className="symbol-stage"
        key={`${eye}-${answerIndex}`}
        onAnimationEnd={(event) => {
          if ((event.target as HTMLElement).classList.contains('optotype--animated')) onReady()
        }}
      >
        <Optotype calibrationPx={calibrationPx} className="optotype--animated" direction={direction} level={state.level} />
        {showReferenceWord && (
          <div className="reference-word-group">
            <span
              aria-label={`英文参考词：${referenceWord.en}`}
              className="reference-word"
              data-size={displaySize.toFixed(2)}
              data-target-height={displaySize.toFixed(4)}
              style={referenceWordStyle}
            >
              {referenceWord.en}
            </span>
            <span className="reference-word-meaning" style={referenceWordStyle}>{referenceWord.zh}</span>
          </div>
        )}
      </div>
      <p
        aria-live="polite"
        className="voice-state"
        data-feedback={voiceState.startsWith('已听到') ? 'heard' : voiceStatus === 'fallback' ? 'missed' : 'listening'}
        data-state={voiceStatus}
        role="status"
      >
        <i aria-hidden="true" />
        <span>{voiceState}</span>
      </p>
      {showDirectionPad && (
        <div className="direction-pad" aria-label="方向回答">
          {(['up', 'left', 'down', 'right'] as const).map((answer) => (
            <button
              aria-label={`缺口向${directionName[answer]}`}
              className={`direction-pad__${answer}`}
              key={answer}
              onClick={() => onAnswer(answer)}
            >
              <span aria-hidden="true">{answer === 'up' ? '↑' : answer === 'right' ? '→' : answer === 'down' ? '↓' : '←'}</span>
            </button>
          ))}
        </div>
      )}
      <p className="test-hint">
        {showDirectionPad ? '说出方向 · 或使用键盘方向键' : '请直接说出缺口方向'}
      </p>
    </main>
  )
}

function EyeGuidePage({
  eye,
  voiceLabel,
  voiceState,
  voiceEngine,
}: {
  eye: Eye
  voiceLabel: string
  voiceState: string
  voiceEngine: string
}) {
  const isRight = eye === 'right'
  return (
    <main className="eye-guide-page">
      <div className="eye-guide-visual" aria-hidden="true">
        <div className={`eye-guide-arrow eye-guide-arrow--${eye}`}><i /></div>
        {(['left', 'right'] as const).map((side) => {
          const covered = isRight ? side === 'left' : side === 'right'
          return (
            <span
              className={`eye-guide-eye eye-guide-eye--${side}${covered ? ' eye-guide-eye--covered' : ''}`}
              key={side}
            >
              👁️
            </span>
          )
        })}
      </div>
      <section className="eye-guide-copy">
        <p>{isRight ? '遮住左眼' : '遮住右眼'}</p>
        <h1>{isRight ? '测试右眼' : '测试左眼'}</h1>
      </section>
      <div
        aria-hidden="true"
        className="setup-voice-orb"
        data-engine={voiceEngine}
        data-state={voiceState}
      ><i aria-hidden="true" /></div>
      <p
        className="voice-status-copy"
        data-feedback={voiceLabel.startsWith('已听到') ? 'heard' : voiceState === 'fallback' ? 'missed' : 'listening'}
        data-state={voiceState}
        role="status"
      >
        <i aria-hidden="true" />
        <span>{voiceLabel}</span>
      </p>
    </main>
  )
}

export function AnalysisPage() {
  return (
    <main className="analysis-page">
      <div aria-label="分析进度" className="analysis-progress" role="progressbar">
        <svg aria-hidden="true" viewBox="0 0 240 240">
          <circle className="analysis-progress__track" cx="120" cy="120" r="92" />
          <circle className="analysis-progress__ring" cx="120" cy="120" r="92" />
        </svg>
        <img
          alt="红房子"
          className="analysis-progress__house"
          src="/assets/red-house-cutout-v3.png"
        />
      </div>
      <div className="analysis-copy">
        <h1>正在分析</h1>
        <p>双眼数据</p>
      </div>
    </main>
  )
}

function ReportPage({ data, onHistory, onRestart }: { data: AppData; onHistory: () => void; onRestart: () => void }) {
  const current = data.sessions[0]
  const priorChronological = data.sessions.slice(1).reverse()
  const rightTrend = analyzeTrend(current.rightEye, priorChronological.map((item) => item.rightEye))
  const leftTrend = analyzeTrend(current.leftEye, priorChronological.map((item) => item.leftEye))
  const overallStatus: TrendStatus =
    rightTrend.status === 'retest' || leftTrend.status === 'retest'
      ? 'retest'
      : rightTrend.status === 'observe' || leftTrend.status === 'observe'
        ? 'observe'
        : rightTrend.status === 'insufficient' || leftTrend.status === 'insufficient'
          ? 'insufficient'
          : 'stable'
  const guidance = riskCopy[overallStatus]

  return (
    <main className="page report-page">
      <section className="report-summary">
        <div className="report-summary__heading">
          <p>{new Date(current.completedAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          <h1>本次结果</h1>
          <span>{guidance.title}</span>
        </div>
        <div className="score-pair">
          <article><span>右眼</span><strong>{current.rightEye.toFixed(1)}</strong></article>
          <article><span>左眼</span><strong>{current.leftEye.toFixed(1)}</strong></article>
        </div>
      </section>
      <section className="chart-card report-trend">
        <div className="section-heading"><div><p className="eyebrow">7 DAYS</p><h2>近期趋势</h2></div><button className="text-link" onClick={onHistory}>详情 →</button></div>
        <TrendChart compact sessions={data.sessions} />
      </section>
      <footer className="report-footer">
        <p>仅作趋势参考，不替代专业检查。</p>
        <button className="text-link" onClick={onRestart}>重新测试</button>
      </footer>
    </main>
  )
}

function HistoryPage({ sessions, onBack }: { sessions: readonly ScreeningSession[]; onBack: () => void }) {
  return (
    <main className="page history-page">
      <button className="back-button" onClick={onBack}>← 返回报告</button>
      <div className="history-heading"><p className="eyebrow">本地档案</p><h1>视力变化记录</h1><p>最近 30 次筛查，按日期连续呈现。演示数据已明确标记。</p></div>
      <section className="history-chart-card"><TrendChart sessions={sessions} /></section>
      <section className="history-table-wrap">
        <table>
          <thead><tr><th>日期</th><th>右眼</th><th>左眼</th><th>距离</th><th>来源</th></tr></thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>{new Date(session.completedAt).toLocaleDateString('zh-CN')}</td>
                <td>{session.rightEye.toFixed(1)}</td><td>{session.leftEye.toFixed(1)}</td><td>2.00 m</td>
                <td>{session.id.startsWith('demo-') ? <span className="demo-pill">演示数据</span> : '本次记录'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}

function ProfileDrawer({ data, onSave, onClose }: { data: AppData; onSave: (nickname: string) => void; onClose: () => void }) {
  const [nickname, setNickname] = useState(data.profile.nickname)
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="presentation">
      <aside aria-labelledby="profile-title" aria-modal="true" className="profile-drawer" role="dialog">
        <button aria-label="关闭档案" className="close-button" onClick={onClose}>×</button>
        <h2 id="profile-title">档案</h2>
        <label htmlFor="nickname">昵称</label>
        <input id="nickname" maxLength={24} onChange={(event) => setNickname(event.target.value)} placeholder="昵称" value={nickname} />
        <div className="profile-stat"><span>记录</span><strong>{data.sessions.length}</strong></div>
        <button className="primary-button" onClick={() => onSave(nickname)}>保存</button>
      </aside>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>('home')
  const [data, setData] = useState<AppData>(() => loadAppData())
  const [showConsent, setShowConsent] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [referenceWordsEnabled, setReferenceWordsEnabled] = useState(
    () => loadPreferences().referenceWordsEnabled,
  )
  const [feedbackSoundsEnabled, setFeedbackSoundsEnabled] = useState(
    () => loadPreferences().feedbackSoundsEnabled,
  )
  const calibrationPx = DEFAULT_CALIBRATION_CSS_PX
  const [count, setCount] = useState(3)
  const [eye, setEye] = useState<Eye>('right')
  const [eyeState, setEyeState] = useState<EyeTestState>(() => createEyeTestState())
  const [direction, setDirection] = useState<Direction>(() => selectNextDirection([]))
  const [directionHistory, setDirectionHistory] = useState<Direction[]>([])
  const [referenceWord, setReferenceWord] = useState(() => selectNextReferenceWord([]))
  const referenceWordHistoryRef = useRef<string[]>([])
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [results, setResults] = useState<Partial<Record<Eye, number>>>({})
  const [symbolReady, setSymbolReady] = useState(false)
  const [promptPlaying, setPromptPlaying] = useState(false)
  const inputModeRef = useRef<'voice' | 'keyboard'>('keyboard')
  const promptedViewRef = useRef<string | null>(null)
  const promptRunRef = useRef(0)
  const confirmationReadyRef = useRef(false)
  const pageRef = usePageMotion(view)

  const startCountdown = useCallback(() => {
    setCount(3)
    setView('countdown')
  }, [])

  const advanceReferenceWord = useCallback(() => {
    const nextWord = selectNextReferenceWord(referenceWordHistoryRef.current)
    referenceWordHistoryRef.current = [...referenceWordHistoryRef.current, nextWord.en]
    setReferenceWord(nextWord)
  }, [])

  const resetTest = useCallback(() => {
    setEye('right')
    setEyeState(createEyeTestState())
    setDirection(selectNextDirection([]))
    setDirectionHistory([])
    const firstWord = selectNextReferenceWord([])
    setReferenceWord(firstWord)
    referenceWordHistoryRef.current = [firstWord.en]
    setAnswers([])
    setResults({})
    setSymbolReady(false)
    promptedViewRef.current = null
    confirmationReadyRef.current = false
    stopInstruction()
  }, [])

  const confirmCurrentStep = useCallback(() => {
    if (view === 'setup') {
      setView('eyeGuide')
      return
    }
    if (view === 'eyeGuide') {
      stopInstruction()
      startCountdown()
    }
  }, [startCountdown, view])

  const handleAnswer = useCallback(
    (answer: Direction) => {
      if (view !== 'test' || eyeState.status !== 'active' || !symbolReady) return
      setSymbolReady(false)
      const feedbackKind = feedbackKindForAnswer(direction, answer)
      const correct = feedbackKind === 'pass'
      void playFeedbackSound(feedbackKind, feedbackSoundsEnabled)
      const nextState = applyEyeAnswer(eyeState, correct)
      setAnswers((current) => [...current, { eye, level: eyeState.level, shown: direction, answered: answer, correct }])
      setEyeState(nextState)

      if (nextState.status === 'complete') {
        const score = Math.min(5.2, nextState.bestCorrectLevel ?? 4.0)
        if (eye === 'right') {
          setResults({ right: score })
          setEye('left')
          setEyeState(createEyeTestState())
          setDirection(selectNextDirection([direction]))
          setDirectionHistory([])
          advanceReferenceWord()
          setSymbolReady(false)
          setView('eyeGuide')
        } else {
          const session: ScreeningSession = {
            id: createSessionId(),
            completedAt: new Date().toISOString(),
            rightEye: results.right ?? 4.0,
            leftEye: score,
            distanceMm: 2000,
            mode: inputModeRef.current,
          }
          setResults((current) => ({ ...current, left: score }))
          setData(saveSession(session))
          setView('analysis')
        }
        return
      }

      const nextHistory = [...directionHistory, direction]
      setDirectionHistory(nextHistory)
      setDirection(selectNextDirection(nextHistory))
      advanceReferenceWord()
    },
    [advanceReferenceWord, direction, directionHistory, eye, eyeState, feedbackSoundsEnabled, results.right, symbolReady, view],
  )

  const onVoiceCommand = useCallback(
    (command: VoiceCommand) => {
      if (promptPlaying) return
      inputModeRef.current = 'voice'
      if (command === 'confirm' && (view === 'setup' || view === 'eyeGuide')) {
        if (!confirmationReadyRef.current) return
        confirmationReadyRef.current = false
        confirmCurrentStep()
      }
      if (command !== 'confirm' && view === 'test') handleAnswer(command)
    },
    [confirmCurrentStep, handleAnswer, promptPlaying, view],
  )
  const voiceScope: VoiceScope = view === 'test' ? 'direction-test' : 'distance-confirmation'
  const voice = useVoiceInput(onVoiceCommand, voiceScope)
  const stopVoice = voice.stop
  const pauseVoice = voice.pause
  const resumeVoice = voice.resume
  const clearVoiceFeedback = voice.clearTransientFeedback

  const playPrompt = useCallback(async (text: string) => {
    const promptRun = promptRunRef.current + 1
    promptRunRef.current = promptRun
    confirmationReadyRef.current = false
    setPromptPlaying(true)
    await pauseVoice()
    await speakInstruction(text)
    await new Promise<void>((resolve) => window.setTimeout(resolve, 400))
    if (promptRun !== promptRunRef.current) return
    await resumeVoice()
    if (promptRun === promptRunRef.current) {
      confirmationReadyRef.current = true
      setPromptPlaying(false)
    }
  }, [pauseVoice, resumeVoice])

  useEffect(() => {
    if (
      voice.state !== 'listening' ||
      (view !== 'setup' && view !== 'eyeGuide')
    ) {
      return
    }
    const promptKey = view === 'eyeGuide' ? `${view}:${eye}` : view
    if (promptedViewRef.current === promptKey) return
    promptedViewRef.current = promptKey
    const prompt = view === 'setup'
      ? DISTANCE_PROMPT
      : eye === 'right'
        ? RIGHT_EYE_PROMPT
        : LEFT_EYE_PROMPT
    void playPrompt(prompt)
  }, [eye, playPrompt, view, voice.state])

  useEffect(() => {
    clearVoiceFeedback()
  }, [answers.length, clearVoiceFeedback, eye, view])

  useEffect(() => {
    if (view === 'home' || view === 'analysis' || view === 'report' || view === 'history') {
      void stopVoice()
    }
  }, [stopVoice, view])

  useEffect(() => {
    if (view !== 'countdown') return
    const delay = isTestMode() ? 80 : 1000
    const timer = window.setTimeout(() => {
      if (count <= 1) setView('test')
      else setCount((current) => current - 1)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [count, view])

  useEffect(() => {
    if (view !== 'analysis') return
    const timer = window.setTimeout(() => setView('report'), isTestMode() ? 1_500 : 2600)
    return () => window.clearTimeout(timer)
  }, [view])

  useEffect(() => {
    if (view !== 'test') return
    const onKeyDown = (event: KeyboardEvent) => {
      const answer = directionKey[event.key]
      if (!answer || event.repeat) return
      event.preventDefault()
      inputModeRef.current = 'keyboard'
      handleAnswer(answer)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleAnswer, view])

  useEffect(() => {
    if (view !== 'setup' && view !== 'eyeGuide') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat) return
      if (promptPlaying || (view === 'setup' && voice.state === 'loading')) return
      event.preventDefault()
      inputModeRef.current = 'keyboard'
      confirmCurrentStep()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmCurrentStep, promptPlaying, view, voice.state])

  const voiceLabel = useMemo(() => {
    if (promptPlaying) return '正在播报提示…'
    if (voice.state === 'listening') {
      if (voice.detail.startsWith('已听到')) return voice.detail
      const instruction = view === 'test'
        ? '请说“上、下、左、右”'
        : '说“准备好了”'
      if (voice.engine === 'vosk') return `离线语音已就绪 · ${instruction}`
      if (voice.engine === 'web-speech') return `在线语音已就绪 · ${instruction}`
      return `本地语音已就绪 · ${instruction}`
    }
    if (voice.state === 'loading') {
      return voice.detail || '正在加载离线语音模型 · 首次约需 30–60 秒'
    }
    if (voice.state === 'fallback' && voice.detail.startsWith('没听清')) {
      return view === 'test'
        ? '没听清 · 请重新说当前方向'
        : '没听清 · 请再说“准备好了”'
    }
    if (
      !voice.configured ||
      voice.state === 'error' ||
      voice.state === 'fallback' ||
      voice.state === 'unavailable'
    ) {
      return voice.detail || '离线语音不可用 · 已切换键盘方向键'
    }
    return '离线语音待启动'
  }, [promptPlaying, view, voice.configured, voice.detail, voice.engine, voice.state])

  const beginFromHome = () => {
    primeFeedbackAudio(feedbackSoundsEnabled)
    if (!data.profile.consentAcceptedAt) setShowConsent(true)
    else {
      resetTest()
      setView('setup')
      void voice.activate(voicePreferenceFromUrl())
    }
  }

  const content = (() => {
    switch (view) {
      case 'home':
        return <HomePage onProfile={() => setShowProfile(true)} onSettings={() => setShowSettings(true)} onStart={beginFromHome} />
      case 'setup':
        return <SetupPage voiceEngine={voice.engine} voiceLabel={voiceLabel} voiceState={voice.state} />
      case 'countdown':
        return <CountdownPage count={count} eye={eye} />
      case 'test':
        return <TestPage answerIndex={answers.length} calibrationPx={calibrationPx} direction={direction} eye={eye} onAnswer={handleAnswer} onReady={() => setSymbolReady(true)} referenceWord={referenceWord} showDirectionPad={voice.engine === 'keyboard' || voice.state === 'error' || voice.state === 'unavailable'} showReferenceWord={referenceWordsEnabled} state={eyeState} voiceState={voice.detail || (symbolReady ? (voice.state === 'listening' ? '正在听 · 请说当前方向' : '键盘方向键已就绪') : '视标准备中')} voiceStatus={voice.state} />
      case 'eyeGuide':
        return <EyeGuidePage eye={eye} voiceEngine={voice.engine} voiceLabel={voiceLabel} voiceState={voice.state} />
      case 'analysis':
        return <AnalysisPage />
      case 'report':
        return <ReportPage data={data} onHistory={() => setView('history')} onRestart={() => { primeFeedbackAudio(feedbackSoundsEnabled); resetTest(); setView('setup'); void voice.activate(voicePreferenceFromUrl()) }} />
      case 'history':
        return <HistoryPage onBack={() => setView('report')} sessions={data.sessions} />
    }
  })()

  const showHeader = !['home', 'setup', 'eyeGuide', 'countdown', 'test', 'analysis'].includes(view)

  return (
    <div className={`app app--${view}`}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      {showHeader && <AppHeader onHome={() => setView('home')} />}
      <section id="main-content" key={view} ref={pageRef as React.RefObject<HTMLElement>} style={{ minHeight: '100%' } as CSSProperties}>
        {content}
      </section>
      {showConsent && (
        <ConsentDialog
          onAccept={() => {
            primeFeedbackAudio(feedbackSoundsEnabled)
            const accepted = updateProfile({ consentAcceptedAt: new Date().toISOString() })
            setData(accepted)
            setShowConsent(false)
            resetTest()
            setView('setup')
            void voice.activate(voicePreferenceFromUrl())
          }}
          onClose={() => setShowConsent(false)}
        />
      )}
      {showProfile && (
        <ProfileDrawer
          data={data}
          onClose={() => setShowProfile(false)}
          onSave={(nickname) => {
            setData(updateProfile({ nickname }))
            setShowProfile(false)
          }}
        />
      )}
      {showSettings && (
        <SettingsDialog
          feedbackSoundsEnabled={feedbackSoundsEnabled}
          onClose={() => setShowSettings(false)}
          onToggleFeedbackSounds={() => {
            const next = !feedbackSoundsEnabled
            setFeedbackSoundsEnabled(next)
            saveFeedbackSoundsEnabled(next)
          }}
          onToggleReferenceWords={() => {
            const next = !referenceWordsEnabled
            setReferenceWordsEnabled(next)
            saveReferenceWordsEnabled(next)
          }}
          referenceWordsEnabled={referenceWordsEnabled}
        />
      )}
    </div>
  )
}
