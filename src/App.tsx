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
  loadAppData,
  saveSession,
  updateProfile,
  type AppData,
  type ScreeningSession,
} from './data/storage'
import {
  loadPreferences,
  saveReferenceWordsEnabled,
} from './data/preferences'
import { analyzeTrend, type TrendStatus } from './domain/risk'
import {
  DEFAULT_CALIBRATION_CSS_PX,
  clampCalibrationCssPx,
  getCalibratedOptotypeCssPx,
} from './domain/calibration'
import {
  applyEyeAnswer,
  createEyeTestState,
  selectNextDirection,
  type EyeTestState,
} from './domain/testMachine'
import type { Direction } from './domain/optotype'
import { selectNextReferenceWord } from './domain/referenceWords'
import type { VoiceCommand, VoiceScope } from './voice/contracts'
import { useVoiceInput } from './voice/useVoiceInput'

type View =
  | 'home'
  | 'setup'
  | 'countdown'
  | 'test'
  | 'eyeSwitch'
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

function createSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? `screening-${Date.now()}`
}

function usePageMotion(view: View) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let active = true
    void import('gsap').then(({ gsap }) => {
      if (!active) return
      gsap.fromTo(
        element,
        { opacity: 0, y: 18, filter: 'blur(8px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.72, ease: 'expo.out' },
      )
    })
    return () => {
      active = false
    }
  }, [view])
  return ref
}

function AppHeader({ onHome, onProfile }: { onHome: () => void; onProfile: () => void }) {
  return (
    <header className="app-header">
      <button aria-label="返回首页" className="brand-button" onClick={onHome}>
        <BrandMark />
      </button>
      <button className="text-button" onClick={onProfile}>登录</button>
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
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const x = (event.clientX / window.innerWidth - 0.5) * -10
    const y = (event.clientY / window.innerHeight - 0.5) * -7
    heroRef.current?.style.setProperty('--scene-x', `${x}px`)
    heroRef.current?.style.setProperty('--scene-y', `${y}px`)
  }

  return (
    <main className="home" onPointerMove={onPointerMove} ref={heroRef}>
      <div className="home__scene" aria-hidden="true" />
      <div className="home__veil" aria-hidden="true" />
      <header className="home__header">
        <BrandMark inverse />
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
        <p className="eyebrow eyebrow--light">TWO METRES · LOCAL FIRST</p>
        <h1>让每一次看清，<br />都有迹可循。</h1>
        <p className="home__lead">家庭视力筛查与趋势跟踪，分左右眼完成。<br />数据只保存在当前浏览器。</p>
        <button className="primary-button primary-button--hero" onClick={onStart}>
          <span>开始筛查</span><span aria-hidden="true">→</span>
        </button>
      </section>
      <footer className="home__footer">
        <span>Windows 10/11 或 macOS · Chrome · 2 米</span>
        <span>筛查结果不能替代专业眼科检查或医学诊断</span>
      </footer>
    </main>
  )
}

function SettingsDialog({
  referenceWordsEnabled,
  onClose,
  onToggleReferenceWords,
}: {
  referenceWordsEnabled: boolean
  onClose: () => void
  onToggleReferenceWords: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="settings-title" aria-modal="true" className="settings-card" role="dialog">
        <button aria-label="关闭设置" className="close-button" onClick={onClose}>×</button>
        <p className="eyebrow">DISPLAY</p>
        <h2 id="settings-title">测试显示设置</h2>
        <p>选择正式测试时是否在 E 字视标下方显示生活参考词。</p>
        <button
          aria-checked={referenceWordsEnabled}
          aria-label="显示生活参考词"
          className="settings-switch"
          onClick={onToggleReferenceWords}
          role="switch"
        >
          <span><strong>生活参考词</strong><small>与当前视标使用相同尺寸</small></span>
          <i aria-hidden="true" />
        </button>
        <small className="settings-note">此选项只影响显示，不会改变测试分数。设置仅保存在当前浏览器。</small>
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
        <p>结果会受屏幕、距离、光线、疲劳和操作影响，仅用于居家趋势参考。若出现突然视力变化、眼痛或持续模糊，请及时就医。</p>
        <ul>
          <li>昵称、筛查结果与历史趋势仅保存在此浏览器</li>
          <li>经本地服务器打开时默认使用设备本地 Vosk；直接双击 HTML 时使用在线语音备用，音频可能发送给浏览器识别服务</li>
          <li>本应用不保存原始录音，键盘模式始终可用</li>
          <li>清除浏览器数据会同时清除本地档案</li>
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
  calibrationPx,
  onCalibration,
  onStart,
  onVoice,
  onOnlineVoice,
  voiceLabel,
}: {
  calibrationPx: number
  onCalibration: (value: number) => void
  onStart: () => void
  onVoice: () => void
  onOnlineVoice: () => void
  voiceLabel: string
}) {
  return (
    <main className="page setup-page">
      <section className="setup-intro">
        <p className="eyebrow">环境校准 · 约 1 分钟</p>
        <h1>先量好两米</h1>
        <p>用卷尺从屏幕表面量出 2 米，在地面贴一小段胶带。坐直或站直，双眼与屏幕中央大致同高。</p>
      </section>
      <section className="setup-grid">
        <article className="instruction-card instruction-card--distance">
          <span className="step-number">01</span>
          <h2>卷尺定位</h2>
          <div className="distance-visual" aria-hidden="true">
            <span className="screen-shape" /><span className="measure-line" /><span className="person-shape" />
          </div>
          <strong>屏幕表面至双眼：200 cm</strong>
          <p>本次 MVE 固定使用两米；视差定位将在后续版本加入。</p>
        </article>
        <article className="instruction-card">
          <span className="step-number">02</span>
          <h2>校准屏幕比例</h2>
          <p>用实体尺测量下方红线，使它刚好等于 50 mm。校准后不依赖屏幕型号或分辨率。</p>
          <div className="calibration-ruler">
            <div className="calibration-line" style={{ width: `${calibrationPx}px` }} />
            <span>50 mm</span>
          </div>
          <div className="calibration-controls" aria-label="调整校准线长度">
            <button aria-label="缩短校准线" onClick={() => onCalibration(clampCalibrationCssPx(calibrationPx - 2))}>−</button>
            <output>{calibrationPx.toFixed(0)} px</output>
            <button aria-label="加长校准线" onClick={() => onCalibration(clampCalibrationCssPx(calibrationPx + 2))}>＋</button>
          </div>
        </article>
        <article className="instruction-card">
          <span className="step-number">03</span>
          <h2>遮挡左眼</h2>
          <div className="eye-visual" aria-hidden="true"><span /><i /></div>
          <p>先测右眼。轻轻遮住左眼，不要按压眼球。保持环境光均匀、屏幕无反光。</p>
          <div className="device-checks">
            <span><i />Chrome 桌面端</span><span><i />Windows 显示缩放 100%</span><span><i />浏览器缩放 100%</span>
          </div>
        </article>
        <article className="instruction-card instruction-card--reference">
          <span className="step-number">04</span>
          <div>
            <h2>生活单词参考</h2>
            <p>测试时，E 字视标正下方会出现一个每次变化的双字生活词。单词字号与 E 字视标使用完全相同的尺寸数值，帮助你感受真实生活中的阅读效果。</p>
            <strong>它只用于直观参考，不会参与评分。可返回主页，通过齿轮设置随时关闭或开启。</strong>
          </div>
          <div className="reference-guide-demo" aria-hidden="true"><span>远山</span><i /></div>
        </article>
      </section>
      <div className="setup-actions">
        <button className="secondary-button voice-button" onClick={onVoice}>
          <span className="mic-dot" aria-hidden="true" />{voiceLabel}
        </button>
        <button className="secondary-button online-voice-button" onClick={onOnlineVoice}>
          使用在线语音备用
        </button>
        <button className="primary-button" onClick={onStart}>我已站好，开始右眼测试</button>
      </div>
      <p className="setup-note">在线备用需联网，语音可能由浏览器服务处理；本应用不保存录音。也可使用键盘方向键。</p>
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
  referenceWord: string
  showReferenceWord: boolean
}) {
  const displaySize = getCalibratedOptotypeCssPx(state.level, calibrationPx)
  return (
    <main className="test-page">
      <div className="test-meta">
        <span>{eye === 'right' ? '右眼' : '左眼'}</span>
        <span>{state.level.toFixed(1)}</span>
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
          <span
            aria-label={`生活参考词：${referenceWord}`}
            className="reference-word"
            data-size={displaySize.toFixed(2)}
            style={{ fontSize: `${displaySize}px` }}
          >
            {referenceWord}
          </span>
        )}
      </div>
      <p aria-live="polite" className="voice-state">{voiceState}</p>
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

function EyeSwitchPage({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="eye-switch-page">
      <div className="switch-icon" aria-hidden="true"><span>R</span><i /><span>L</span></div>
      <p className="eyebrow">右眼已完成</p>
      <h1>现在交换遮挡</h1>
      <p>轻轻遮住右眼，保持身体位置不变。准备好后继续测试左眼。</p>
      <button className="primary-button" onClick={onContinue}>开始左眼测试</button>
    </main>
  )
}

function AnalysisPage() {
  return (
    <main className="analysis-page">
      <div className="analysis-photo" aria-hidden="true" />
      <div className="analysis-copy">
        <div className="analysis-loader" aria-hidden="true"><i /><i /><i /></div>
        <p className="eyebrow eyebrow--light">双眼测试完成</p>
        <h1>正在分析本次数据</h1>
        <p>对比近期中位水平 · 检查左右眼差异 · 生成趋势建议</p>
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
      <section className="report-hero">
        <div>
          <p className="eyebrow">本次筛查 · {new Date(current.completedAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          <h1>看见变化，<br />也看见安心。</h1>
          <p>{guidance.copy}</p>
        </div>
        <div className="score-pair">
          <article><span>右眼</span><strong>{current.rightEye.toFixed(1)}</strong><small>五分记录法</small></article>
          <article><span>左眼</span><strong>{current.leftEye.toFixed(1)}</strong><small>五分记录法</small></article>
        </div>
      </section>
      <section className={`guidance-card guidance-card--${overallStatus}`}>
        <div className="status-mark" aria-hidden="true" />
        <div><p>趋势提示</p><h2>{guidance.title}</h2></div>
        <p>{overallStatus === 'retest' ? '建议 24 小时内在相同条件复测' : '保持两米距离与相同设备，数据才更可比较'}</p>
      </section>
      <section className="report-grid">
        <article className="chart-card">
          <div className="section-heading"><div><p className="eyebrow">最近 7 次</p><h2>双眼变化趋势</h2></div><button className="text-link" onClick={onHistory}>查看详情 →</button></div>
          <TrendChart compact sessions={data.sessions} />
        </article>
        <article className="facts-card">
          <p className="eyebrow">本次条件</p>
          <dl>
            <div><dt>观察距离</dt><dd>2.00 m</dd></div>
            <div><dt>输入方式</dt><dd>{current.mode === 'voice' ? '离线语音' : '键盘'}</dd></div>
            <div><dt>有效上限</dt><dd>5.2</dd></div>
            <div><dt>数据位置</dt><dd>仅此浏览器</dd></div>
          </dl>
          <button className="secondary-button" onClick={onRestart}>重新筛查</button>
        </article>
      </section>
      <aside className="medical-note"><strong>重要说明</strong><p>本报告用于家庭筛查与趋势记录，不能用于验光配镜、疾病诊断或替代专业眼科检查。结果异常或伴随不适时，请咨询医生。</p></aside>
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
        <p className="eyebrow">LOCAL PROFILE</p><h2 id="profile-title">本地档案</h2>
        <p>本次 MVE 不创建云端账号。“登录”仅打开保存在此浏览器中的演示档案。</p>
        <label htmlFor="nickname">昵称</label>
        <input id="nickname" maxLength={24} onChange={(event) => setNickname(event.target.value)} value={nickname} />
        <div className="profile-stat"><span>历史记录</span><strong>{data.sessions.length} 次</strong></div>
        <button className="primary-button" onClick={() => onSave(nickname)}>保存昵称</button>
        <small>为保护隐私，请不要填写真实姓名、学校或联系方式。</small>
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
  const [calibrationPx, setCalibrationPx] = useState(DEFAULT_CALIBRATION_CSS_PX)
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
  const inputModeRef = useRef<'voice' | 'keyboard'>('keyboard')
  const pageRef = usePageMotion(view)

  const startCountdown = useCallback(() => {
    setCount(3)
    setView('countdown')
  }, [])

  const advanceReferenceWord = useCallback(() => {
    const nextWord = selectNextReferenceWord(referenceWordHistoryRef.current)
    referenceWordHistoryRef.current = [...referenceWordHistoryRef.current, nextWord]
    setReferenceWord(nextWord)
  }, [])

  const resetTest = useCallback(() => {
    setEye('right')
    setEyeState(createEyeTestState())
    setDirection(selectNextDirection([]))
    setDirectionHistory([])
    const firstWord = selectNextReferenceWord([])
    setReferenceWord(firstWord)
    referenceWordHistoryRef.current = [firstWord]
    setAnswers([])
    setResults({})
    setSymbolReady(false)
  }, [])

  const handleAnswer = useCallback(
    (answer: Direction) => {
      if (view !== 'test' || eyeState.status !== 'active' || !symbolReady) return
      setSymbolReady(false)
      const correct = answer === direction
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
          setView('eyeSwitch')
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
    [advanceReferenceWord, direction, directionHistory, eye, eyeState, results.right, symbolReady, view],
  )

  const onVoiceCommand = useCallback(
    (command: VoiceCommand) => {
      inputModeRef.current = 'voice'
      if (command === 'confirm' && (view === 'setup' || view === 'eyeSwitch')) startCountdown()
      if (command !== 'confirm' && view === 'test') handleAnswer(command)
    },
    [handleAnswer, startCountdown, view],
  )
  const voiceScope: VoiceScope = view === 'test' ? 'direction-test' : 'distance-confirmation'
  const voice = useVoiceInput(onVoiceCommand, voiceScope)
  const stopVoice = voice.stop

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
    const timer = window.setTimeout(() => setView('report'), isTestMode() ? 120 : 2600)
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

  const voiceLabel = useMemo(() => {
    if (voice.state === 'listening') {
      if (voice.engine === 'vosk') return 'Vosk 本地语音已开启'
      if (voice.engine === 'web-speech') return '在线语音备用已开启'
      return 'Rhino 本地语音已开启'
    }
    if (voice.state === 'loading') return voice.detail || '正在加载离线模型'
    if (!voice.configured) return '语音未配置 · 使用键盘'
    if (voice.state === 'error') return voice.detail || '语音暂不可用'
    if (voice.engine === 'web-speech') return '启用在线语音备用'
    return '启用离线语音'
  }, [voice.configured, voice.detail, voice.engine, voice.state])

  const beginFromHome = () => {
    if (!data.profile.consentAcceptedAt) setShowConsent(true)
    else {
      resetTest()
      setView('setup')
    }
  }

  const content = (() => {
    switch (view) {
      case 'home':
        return <HomePage onProfile={() => setShowProfile(true)} onSettings={() => setShowSettings(true)} onStart={beginFromHome} />
      case 'setup':
        return <SetupPage calibrationPx={calibrationPx} onCalibration={setCalibrationPx} onOnlineVoice={() => void voice.activate('web-speech')} onStart={startCountdown} onVoice={() => void voice.activate()} voiceLabel={voiceLabel} />
      case 'countdown':
        return <CountdownPage count={count} eye={eye} />
      case 'test':
        return <TestPage answerIndex={answers.length} calibrationPx={calibrationPx} direction={direction} eye={eye} onAnswer={handleAnswer} onReady={() => setSymbolReady(true)} referenceWord={referenceWord} showDirectionPad={voice.state !== 'listening'} showReferenceWord={referenceWordsEnabled} state={eyeState} voiceState={symbolReady ? (voice.detail || (voice.state === 'listening' ? '离线语音已开启' : '键盘方向键已就绪')) : '视标准备中'} />
      case 'eyeSwitch':
        return <EyeSwitchPage onContinue={startCountdown} />
      case 'analysis':
        return <AnalysisPage />
      case 'report':
        return <ReportPage data={data} onHistory={() => setView('history')} onRestart={() => { resetTest(); setView('setup') }} />
      case 'history':
        return <HistoryPage onBack={() => setView('report')} sessions={data.sessions} />
    }
  })()

  const showHeader = !['home', 'countdown', 'test', 'analysis'].includes(view)

  return (
    <div className={`app app--${view}`}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      {showHeader && <AppHeader onHome={() => setView('home')} onProfile={() => setShowProfile(true)} />}
      <section id="main-content" key={view} ref={pageRef as React.RefObject<HTMLElement>} style={{ minHeight: '100%' } as CSSProperties}>
        {content}
      </section>
      {showConsent && (
        <ConsentDialog
          onAccept={() => {
            const accepted = updateProfile({ consentAcceptedAt: new Date().toISOString() })
            setData(accepted)
            setShowConsent(false)
            resetTest()
            setView('setup')
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
          onClose={() => setShowSettings(false)}
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
