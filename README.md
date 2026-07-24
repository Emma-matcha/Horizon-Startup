# 红房子 · 家庭视力趋势筛查 MVE

面向 PC Chrome 的本地优先视力筛查演示。固定使用 13.6 英寸 MacBook Air（2560×1664、224ppi）和 2 米卷尺距离，分左右眼显示随机方向的标准 5×5 E 视标，并把结果与趋势保存在当前浏览器。

> 本项目用于家庭筛查与趋势跟踪，不用于验光配镜、疾病诊断，也不能替代专业眼科检查。

## 本地启动

```bash
pnpm install
pnpm dev
```

打开终端提示的 localhost 地址。首次进入会看到本地存储与非诊断说明。

也可以在 Finder 中双击项目根目录的 `启动红房子.command`。终端窗口需要保持开启；关闭窗口后本地网址会停止，这是本地网站的正常工作方式。

生产预览固定地址：

```bash
pnpm build
pnpm start
```

然后访问 <http://127.0.0.1:4173/>。

## 输入方式

- 默认：键盘方向键，能够完整演示所有页面。
- 离线语音：Picovoice Rhino Web。模型和 AccessKey 不会提交到 Git；按 `public/models/README.md` 配置 `.env.local` 后重新构建。
- 未完成目标 MacBook、2 米、1000 条命令的本地验收前，不得宣传“本项目识别率 99%”。验收方案见 `docs/voice/benchmark-protocol.md`。

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

- 仅对指定 MacBook Air + Chrome + 2 米条件负责；其他屏幕需重新校准并只作为体验。
- 视差法暂不实现，距离使用卷尺确定。
- 5.3 只作探索展示，报告和趋势计算封顶 5.2。
- 数据默认只在 localStorage；清除浏览器数据会删除档案。
