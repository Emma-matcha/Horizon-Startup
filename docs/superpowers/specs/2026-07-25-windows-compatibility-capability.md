# 红房子 Windows 兼容能力契约

状态：可直接实施
日期：2026-07-25
适用版本：PC Chrome 视力参考筛查 MVE

## CAPABILITY

Windows 10/11 用户可从项目根目录双击启动程序，在 Chrome 中通过 `http://127.0.0.1:4173/` 完成与 macOS 相同的卷尺定位、屏幕物理尺寸校准、左右眼测试、Vosk 离线语音、Web Speech 在线备用和本地趋势记录。跨屏幕兼容的依据是用实体尺把页面校准线调整到 50 mm，不是假设 Windows 设备具有某个固定 PPI。

## CONSTRAINTS

- 支持 Windows 10/11 64 位、Node.js 20.19+ 或 22.12+、最新稳定版 Chrome；Edge 可作兼容性尝试，但不是黑客松默认验收浏览器。
- 浏览器缩放和 Windows 显示缩放保持 100%；无论分辨率或标称 PPI 如何，都必须用实体尺完成 50 mm 校准。
- 校准宽度范围扩展为 120–360 CSS px，覆盖常见 Windows 笔记本与外接显示器；范围外设备只允许体验，不作趋势对比。
- 观察距离仍固定为从屏幕表面到受测者双眼 2.00 m。
- 不改变非诊断声明、标准 E 视标几何、分眼流程、语音隐私边界和本地数据归属。
- Windows 启动器不下载未固定的可执行文件，不修改系统设置，不要求管理员权限。

## IMPLEMENTATION CONTRACT

### Surfaces

- `start-windows.bat`：Windows 双击入口，仅调用同仓库 PowerShell 脚本。
- `scripts/start-windows.ps1`：校验 Node.js，选择 `pnpm.cmd` 或 `npm.cmd`，必要时安装锁定依赖，构建后启动本地预览，等待 HTTP 200 再打开默认浏览器。
- 环境页：不再把 `2560×1664` 写成必要条件，而是明确要求 Windows 显示缩放、Chrome 缩放与 50 mm 实物校准。
- 首页与 README：同时声明 Windows 10/11 和 macOS 支持，分别给出双击启动方法。

### Physical-size interface

```text
calibrationMm = 50
calibrationCssPx = 用户调整后的红线宽度
cssPxPerMm = calibrationCssPx / calibrationMm
optotypeCssPx(level) = theoreticalOuterMm(level) × cssPxPerMm
```

现有 MacBook 默认值 `220.47 CSS px / 50 mm` 仅作初始值。Windows 上用户调整后的比例会覆盖初始值，因此运行时视标物理尺寸不依赖设备名称或分辨率。

### Failure and recovery

- 未安装 Node.js：显示中文提示和官方下载地址，不闪退。
- 依赖安装或构建失败：保留终端错误并等待用户按键，不打开空白网址。
- 4173 端口已有正确站点：直接打开；被其他程序占用：显示错误，不杀死未知进程。
- 离线 Vosk 失败：保留 Web Speech 联网备用、键盘和条件触发的鼠标输入。

## NON-GOALS

- 不打包原生 `.exe`、不做 Windows 安装器、不请求管理员权限。
- 不声称任意未校准显示器都具有临床级物理精度。
- 不支持 IE、老版 EdgeHTML、32 位 Windows 或手机浏览器。

## OPEN QUESTIONS

无阻塞项。黑客松默认支持 Windows 10/11 + Chrome + Node.js 20.19+ 或 22.12+，且每台新显示器都必须重新完成 50 mm 校准。

## HANDOFF

直接进入 TDD 实施：先增加 Windows 页面文案、校准范围与启动器合约测试，再实现脚本和 UI 改动，最后运行单元、构建和 Chrome 端到端验收。
