# 红房子单文件交付能力契约

## 目标

将现有 React/Vite 视力参考测试完整打包为仓库根目录的 `red-house-vision.html`。用户可以复制这一个文件到 Windows 10/11 或 macOS，并使用桌面版 Chrome/Edge 直接打开演示。

## 必须保持的能力

- 首页、两米卷尺教学、左右眼分测、随机 E 字视标、倒计时、分析、报告与历史趋势保持现有交互。
- 所有 CSS、JavaScript、GSAP 动效、教堂绿地照片和 Vosk 中文离线模型均内嵌在 HTML 内。
- 单文件运行时不得读取旁边的 `/assets`、`/models` 或 JavaScript 分块。
- 本地历史数据继续保存在浏览器 `localStorage`；数据不会自动跨浏览器或跨电脑同步。
- 经本地 HTTP 服务器打开时优先使用内嵌 Vosk 离线识别；直接双击 `file://` 时优先使用浏览器 Web Speech，键盘/条件式鼠标仍作为备用。
- 保留“参考测试、非医疗诊断”的明确声明。

## 平台边界

- 目标浏览器：Windows 10/11 的最新版 Chrome 或 Edge，以及 macOS 的最新版 Chrome。
- 页面和键盘流程必须在 `file://` 直接打开时工作。
- `vosk-browser` 的 Worker 无法从不透明的 `file://` 来源稳定读取 42 MB 模型，因此双击模式明确使用浏览器在线语音；需要全离线语音时使用现有 Windows 本地启动脚本打开服务器版。
- 13.6 英寸屏幕仍须先完成 50 mm 实物校准；CSS 像素不能直接等同于设备物理像素。

## 构建接口

- `pnpm build:single`：类型检查、构建、资源内联、完整性校验并生成 `red-house-vision.html`。
- 构建过程使用临时目录，完成后删除临时目录，只保留最终 HTML。
- 生成器必须拒绝残留的本地脚本、样式、图片或模型 URL。
- HTML 内嵌模型节点固定为 `#embedded-vosk-model`，经 HTTP 打开时按需解码为 Blob URL，避免页面初次展示时解码 42MB 模型。
- 若浏览器在 20 秒内无法完成模型初始化，必须自动退出加载态，并继续尝试在线语音或键盘备用。

## 验收标准

1. `pnpm lint`、`pnpm typecheck`、单元测试和覆盖率通过。
2. `pnpm build:single` 成功，并确认产物只有一个 HTML 文件依赖自身内容。
3. Playwright 通过 `file://.../red-house-vision.html?test=1` 打开，首页照片可见，左右眼流程可完成并生成报告。
4. 在阻断 HTTP/HTTPS 网络请求时，上述本地页面和键盘流程仍可完成。
5. 内嵌模型能转换为 Blob URL；`file://` 模式会跳过不兼容的 Vosk 路径并直接启用在线语音或键盘。

## 非目标

- 不把参考结果解释为医学诊断或处方。
- 不实现账号、云端同步或服务器存储。
- 不承诺所有浏览器都允许 `file://` 麦克风；比赛现场需要语音时应准备现有 Windows 本地启动脚本。
