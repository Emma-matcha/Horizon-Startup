# 红房子 · 家庭视力趋势筛查 MVE

面向 Windows 10/11 与 macOS 桌面 Chrome 的本地优先视力筛查演示。使用卷尺确认 2 米距离，并用实体尺完成 50 mm 屏幕校准后，分左右眼显示随机方向的标准 5×5 E 视标，并把结果与趋势保存在当前浏览器。

> 本项目用于家庭筛查与趋势跟踪，不用于验光配镜、疾病诊断，也不能替代专业眼科检查。

## Windows 双击启动

1. 在 Windows 10/11 上安装 [Node.js 20.19+ 或 22.12+](https://nodejs.org/)。
2. 双击项目根目录的 `start-windows.bat`。
3. 首次启动会安装依赖并构建，随后自动打开 Chrome 和 <http://127.0.0.1:4173/>。请保持终端窗口开启。

如果没有安装 Chrome，启动器会使用 Windows 默认浏览器；正式演示仍建议使用最新稳定版 Chrome。

## macOS 与命令行启动

```bash
pnpm install
pnpm dev
```

打开终端提示的 localhost 地址。首次进入会看到本地存储与非诊断说明。

在 macOS Finder 中也可双击项目根目录的 `启动红房子.command`。终端窗口需要保持开启；关闭窗口后本地网址会停止，这是本地网站的正常工作方式。

生产预览固定地址：

```bash
pnpm build
pnpm start
```

然后访问 <http://127.0.0.1:4173/>。

## 输入方式

- 默认语音：内置 Vosk WASM 中文小模型，无需账号或 AccessKey，识别在本机完成。
- 在线备用：环境页点击“使用在线语音备用”，调用 Chrome/Web Speech。该路径需要联网，语音可能发送给浏览器的识别服务；本应用不保存原始录音。
- 最终保底：键盘方向键始终可用；语音连续两次未理解后才显示鼠标方向按钮。
- 兼容保留：Picovoice Rhino 代码仍在分支内，可通过 `.env.local` 和 `public/models/README.md` 恢复启用。
- 未在实际演示设备、2 米、1000 条命令上完成验收前，不得宣传“本项目识别率 99%”。Windows 与 macOS 设备的结果必须分开统计。验收方案见 `docs/voice/benchmark-protocol.md`。

## 质量检查

```bash
pnpm test
pnpm test:coverage
pnpm lint
pnpm build
pnpm e2e
```

`pnpm e2e` 使用本机 Chrome 完成首页与左右眼全流程。核心算法与数据层覆盖率门槛为 80%。

## 生成档案

```bash
pnpm generate:optotypes
pnpm generate:voice-cases
```

- `public/optotypes/`：4.0–5.3、四方向共 56 个 SVG 视标及像素清单。
- `docs/data/optotype-sizes-2m-224ppi.csv`：两米尺寸完整计算表。
- `docs/voice/mandarin-command-test-cases.csv`：1000 条正样本与 200 条负样本。

## 当前 MVE 边界

- 支持 Windows 10/11 与 macOS 的桌面 Chrome；每块新屏幕都必须用实体尺重新完成 50 mm 校准。
- 视差法暂不实现，距离使用卷尺确定。
- 5.3 只作探索展示，报告和趋势计算封顶 5.2。
- 数据默认只在 localStorage；清除浏览器数据会删除档案。
