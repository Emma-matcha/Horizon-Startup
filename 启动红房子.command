#!/bin/zsh
set -e

cd "${0:A:h}"

CODEX_NODE_BIN="${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
CODEX_TOOL_BIN="${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback"
if [[ -d "$CODEX_NODE_BIN" && -d "$CODEX_TOOL_BIN" ]]; then
  export PATH="$CODEX_NODE_BIN:$CODEX_TOOL_BIN:$PATH"
fi

if command -v pnpm >/dev/null 2>&1; then
  if [[ ! -d node_modules ]]; then
    pnpm install
  fi
  pnpm build
  pnpm start
elif command -v npm >/dev/null 2>&1; then
  if [[ ! -d node_modules ]]; then
    npm install
  fi
  npm run build
  npm start
else
  echo "未找到 Node.js。请先安装 Node.js 20 或更高版本。"
  read -r "?按回车关闭窗口。"
  exit 1
fi
