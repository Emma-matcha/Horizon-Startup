# Rhino 离线普通话模型

这里不提交 AccessKey 或私有模型。键盘方向键模式无需任何配置，可完整演示全部流程。

启用语音时：

1. 在 Picovoice Console 用 `docs/voice/vision-commands.yml` 训练中文 Rhino Web (WASM) context。
2. 将生成的 `vision-commands-zh.rhn` 和中文 `rhino_params_zh.pv` 放入本目录。
3. 复制 `.env.example` 为 `.env.local` 并填写 AccessKey 与两个公开路径。
4. 用 HTTPS 或 localhost 启动；首次初始化读取模型，之后推理在本机完成。

AccessKey 只用于 SDK 授权，绝不能提交到 Git。正式部署应由后端签发短期配置或按 Picovoice 的生产安全建议处理。
