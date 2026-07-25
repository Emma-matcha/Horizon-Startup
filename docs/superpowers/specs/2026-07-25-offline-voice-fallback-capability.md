# 红房子语音双通道能力契约

状态：已实施（Vosk 离线主通道 + Web Speech 在线备用 + 键盘保底）
日期：2026-07-25
适用版本：一天半黑客松 MVP，Windows 10/11 或 macOS 演示机，桌面 Chrome

## CAPABILITY

当 Picovoice 账号、AccessKey 或 Rhino 中文 context 无法使用时，受测者默认使用站点内置的 Vosk WASM 中文小模型，也可显式选择 Chrome/Web Speech 联网识别“上、下、左、右、确认”。两条语音路径都使用同一 Adapter 接口，失败时转入键盘方向键，不中断测试、不把拒识计为答错。任何“99%”表述只能来自目标设备、2 米距离和规定样本集的本地实测。

## CONSTRAINTS

### 固定产品规则

- 默认 Vosk 路径不依赖云端 API、大语言模型、账户或密钥；模型放入站点静态资源。在线 Web Speech 只是用户显式选择的备用通道。
- 只识别五个业务命令：`上`、`下`、`左`、`右`、`确认`。测试页不接受“确认”，环境页不接受方向。
- 麦克风权限只能由用户点击触发；本应用不保存或回放原始音频。选择在线备用时，界面必须提前说明语音可能发送给浏览器的识别服务。
- `rejected`、超时、输入过轻、模型未就绪和动画未完成时的口令都不计错。
- 语音连续两次未理解或引擎初始化失败后显示键盘方向键；键盘结果与语音结果走同一测试状态机。
- UI 和报告默认写“离线命令词实验功能”。只有完整验收通过后才可写“本机实测 ≥99%”。
- 测试结果是非诊断性“视力参考估测”，语音备用方案不得改变这一声明。

### 技术与交付边界

- **首选技术闸门：sherpa-onnx KWS。** 它支持自定义关键词、boosting score 与触发阈值，并提供约 3–3.3M 参数的中英文/中文 KWS 模型，适合封闭词表；但官方当前浏览器 KWS 路径没有达到可直接接入的证据，因此只允许投入 2 小时验证。[官方 KWS 文档](https://k2-fsa.github.io/sherpa/onnx/kws/index.html)
- **确定性备用：Vosk WASM。** 使用官方 `vosk-model-small-cn-0.22`（约 42 MB），通过语法/动态词表限制到五个命令与未知词；官方给出的通用中文 WER 明显不足以证明本场景 99%，所以必须以本地命令词测试为准。[Vosk 模型表](https://alphacephei.com/vosk/models) [Vosk 能力说明](https://alphacephei.com/vosk/)
- 浏览器 Vosk 封装属于第三方维护面；必须固定确切版本和文件哈希，完成断网重载测试，不在比赛当天在线安装依赖。[vosk-browser 仓库](https://github.com/ccoreilly/vosk-browser)
- Web Speech API 不作为离线主路径；它作为明确标注的联网备用，限定 `zh-CN`、最终结果和一个候选，并严格精确匹配五个命令。[MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- 不在一天半内采集数据并训练 TensorFlow.js 自定义声音模型；这无法在目标人群、两米距离和噪声条件下可靠完成验证。

### 时间闸门

1. `T+0 至 T+2h`：验证 sherpa-onnx KWS 的 Chrome 麦克风 → AudioWorklet/Worker → WASM → 五命令结果完整链路。
2. 通过条件：断网重载可用、五词均能触发、连续 100 条快速样本准确率 ≥95%、误接受率 ≤2%、p95 端点后延迟 ≤1000 ms，且不阻塞页面动效。
3. 任一条件失败：停止继续钻研，切换 Vosk WASM，不延长闸门。
4. 距演示 6 小时时冻结语音引擎；若快速验收仍未达标，默认键盘，语音仅保留为显式“实验”入口。

## IMPLEMENTATION CONTRACT

### Actors and surfaces

- **受测者**：在环境页说“确认”，在测试页说方向；必要时使用键盘。
- **测试引擎**：只消费标准化命令，不知道底层是 sherpa、Vosk 还是键盘。
- **语音 Adapter**：负责模型、麦克风、端点检测、命令归一化与拒识；不负责判分。
- **环境页**：显示模型加载、麦克风授权、监听、重说和键盘接管状态。
- **测试页**：只在 `READY` 状态接收方向；视标切换期间丢弃输入，不缓存到下一题。

### States and transitions

```text
UNAVAILABLE
  └─ init() → MODEL_LOADING
                 ├─ success → REQUESTING_MIC → READY → LISTENING
                 │                              ├─ accepted → READY
                 │                              └─ rejected/timeout → LISTENING
                 └─ failure/retry exhausted → KEYBOARD_FALLBACK

permission denied / worker crash / model hash mismatch → KEYBOARD_FALLBACK
page hidden / test not READY → PAUSED_INPUT
```

- 模型加载只重试一次；模型哈希不匹配不执行。
- 进入 `KEYBOARD_FALLBACK` 后保留当前眼、当前等级和当前题，不制造一次错误。
- 页面恢复后重新播放当前题入场动效，动效完成才恢复输入。

### Stable interface

```ts
type VoiceCommand = "up" | "down" | "left" | "right" | "confirm";
type VoiceEngineId = "vosk" | "web-speech" | "rhino" | "keyboard";
type VoiceScope = "distance-confirmation" | "direction-test";
type VoiceState =
  | "unavailable"
  | "loading-model"
  | "requesting-mic"
  | "ready"
  | "listening"
  | "rejected"
  | "paused"
  | "fallback"
  | "error";

type VoiceEvent = {
  command: VoiceCommand;
  engine: VoiceEngineId;
  acceptedAt: number;
  latencyMs: number | null;
  confidence?: number;
};

interface VoiceAdapter {
  readonly engine: VoiceEngineId;
  init(): Promise<void>;
  start(scope: VoiceScope, emit: (event: VoiceEvent) => void): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}
```

- 现有 `createRhinoController`/`useRhinoVoice` 改为厂商无关的 `createVoiceAdapter`/`useVoiceInput`；UI 不得导入具体引擎 SDK。
- 构建开关：`VITE_VOICE_ENGINE=auto|vosk|web-speech|rhino|keyboard`。默认 `auto` 先启动 Vosk，失败后尝试 Web Speech，最后保留键盘。
- Vosk grammar：`["上", "下", "左", "右", "确认", "[unk]"]`；识别文本必须精确归一化，不能用包含匹配把“上学”等短语当作“上”。
- sherpa keyword 文件只包含五个命令；阈值与 boosting score 必须记录在模型版本元数据中。

### Data implications

每条试次补充以下字段；不保存音频：

```ts
type VoiceTelemetry = {
  requestedEngine: VoiceEngineId;
  effectiveEngine: VoiceEngineId;
  modelVersion: string | null;
  modelSha256: string | null;
  accepted: boolean;
  rejectedReason: "unknown" | "low-level" | "timeout" | "wrong-scope" | null;
  latencyMs: number | null;
  offlineVerified: boolean;
  fallbackReason: "not-configured" | "load-failed" | "permission-denied" | "accuracy-gate" | null;
};
```

- 模型文件使用 Cache Storage 或 IndexedDB；模型版本和 SHA-256 进入本地元数据。
- 统计只写事件和耗时，不写 PCM、录音文件或完整自由文本。
- 语音引擎切换不迁移历史测试记录；旧记录缺少字段时按 `null` 读取。

### Verification and observability

- 保留 `docs/voice/mandarin-command-test-cases.csv` 的 1000 条正样本与 200 条负样本正式验收。
- 快速闸门只决定能否现场展示语音，不等于 99% 证明。
- 正式 99% 门槛：总体准确率 ≥99%，每方向 ≥98%，负样本误接受率 ≤1%，p95 ≤1000 ms，并完成缓存后断网抽样。
- 页面提供仅开发环境可见的诊断面板：引擎、模型版本、状态、最近一次拒识原因、延迟和离线缓存状态；不显示目标答案。
- 自动化测试覆盖：错误 scope、动画未完成、连续拒识、权限拒绝、Worker 崩溃、断网重载、模型损坏和键盘接管。

### Security and privacy

- 不再需要 Picovoice AccessKey，也不得把任何供应商密钥放入前端 bundle。
- Web Speech 不记录自由文本、不保存音频；界面仅传递归一化后的业务命令，错误信息不暴露浏览器内部服务细节。
- 模型和 Worker 必须同源加载；生产响应配置 `Cross-Origin-Opener-Policy` 与 `Cross-Origin-Embedder-Policy` 时先验证现有部署兼容性。
- 麦克风 stream 在暂停、完成、路由离开和页面隐藏时停止 track；Worker 在 `dispose()` 后终止。

## NON-GOALS

- 不做连续普通话听写、自然语言理解、声纹识别或说话人身份验证。
- 不保证所有浏览器、手机、平板、外接麦克风和方言环境。
- 不在本轮自行训练或微调语音模型。
- 不把快速 100 条预检包装成“99% 准确率”。
- 不让语音模块决定方向是否正确、测试等级或风险结论。
- 本能力契约不改变视标尺寸、两米卷尺法、双眼流程和报告算法。

## OPEN QUESTIONS

以下均已给出默认值，不阻塞开发：

1. sherpa-onnx 浏览器 KWS 打包方式仍需技术验证；默认只投入 2 小时，失败即用 Vosk。
2. Vosk 浏览器封装的长期维护与许可证需要上线前复核；黑客松默认固定已验证版本并把产物随站点发布。
3. 42 MB 模型首载体验可能受网络影响；现场默认提前加载并验证缓存，不在台上首次下载。
4. “99%”是否对外宣传由正式 1200 条验收决定；默认不宣传。

## HANDOFF

能力契约已足够进入实现，无需再等待 Picovoice 权限：

1. 用 `tdd-workflow` 先把当前 Rhino 类型改成厂商无关 Adapter，并补齐状态机与 fallback 测试。
2. 执行 2 小时 sherpa-onnx 浏览器 KWS spike；按闸门自动决定 sherpa 或 Vosk。
3. 接入选定引擎并运行 100 条快速预检；未达标时将 `VITE_VOICE_ENGINE` 固定为 `keyboard`。
4. 用 `verification-loop` 在目标 Windows 与 macOS 演示机、2 米距离、断网条件下分别完成正式 1000+200 条验收。

交付定义：无论语音引擎是否通过，本轮必须交付可完整完成双眼测试的键盘路径；只有通过本机正式验收，语音才升级为默认输入并允许声明实测准确率。
