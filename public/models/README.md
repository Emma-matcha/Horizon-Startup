# 离线普通话模型

默认使用 Vosk，不需要账号或 AccessKey。键盘方向键模式无需任何配置，可完整演示全部流程。

## Vosk（默认）

1. 下载官方 `vosk-model-small-cn-0.22.zip`。
2. 解压后把顶层目录改名为 `model`，再 gzip 打包并以 `vosk-model-small-cn-0.22.tar` 发布。保留 `.tar` URL 是为了避免 Vite 把 `.tar.gz` 错当成 HTTP Content-Encoding 后提前解压。
3. 将压缩包放入本目录，保持 `.env.example` 中的默认公开路径。
4. 首次加载后关闭网络重载，确认模型和 Worker 均从本地站点读取。

当前仓库已经包含转换后的模型：

- 来源：`https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip`
- 许可证：Apache-2.0
- 浏览器包 SHA-256：`f7ae9a233b7e503d6807020f4ea81cb2f578d61e8d0b46a3a2bcc0a99e4f53bf`

浏览器适配器只接受“上、下、左、右、确认”和 `[unk]` 语法，并对最终文本做精确匹配；“上学”“左右”“确认一下”等不会作为命令。

## Web Speech（联网备用）

环境页的“使用在线语音备用”不需要模型文件或密钥，但需要 Chrome、网络和麦克风权限。语音可能由浏览器运营的识别服务处理；网站不保存原始录音。该路径同样只接受五个精确命令。

## Rhino（保留的可选适配器）

如团队后续恢复 Picovoice 权限：

1. 在 Picovoice Console 用 `docs/voice/vision-commands.yml` 训练中文 Rhino Web (WASM) context。
2. 将生成的 `vision-commands-zh.rhn` 和中文 `rhino_params_zh.pv` 放入本目录。
3. 复制 `.env.example` 为 `.env.local` 并填写 AccessKey 与两个公开路径。
4. 用 HTTPS 或 localhost 启动；首次初始化读取模型，之后推理在本机完成。

将 `VITE_VOICE_ENGINE` 改为 `rhino` 后才会启用。AccessKey 绝不能提交到 Git；当前 MVE 不依赖 Rhino。
