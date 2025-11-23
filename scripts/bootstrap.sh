#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE}")/..' && pwd)"
SCRIPTS_DIR="$REPO_ROOT/scripts"
CONFIGS_DIR="$REPO_ROOT/configs"
SERVERS_DIR="$REPO_ROOT/servers"
BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR" "$CONFIGS_DIR" "$SERVERS_DIR"

log(){ echo "[MCP-BOOT] $*"; }

detect_os() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux) echo "linux" ;;
    *) echo "other" ;;
  esac
}

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    VER=$(node -v | sed 's/v//')
    MAJOR=${VER%%.*}
    if [ "$MAJOR" -ge 22 ]; then log "Node $VER OK"; return; fi
  fi
  OS=$(detect_os)
  log "Installing Node.js 22 (OS=$OS)"
  if [ "$OS" = "macos" ]; then
    if ! command -v brew >/dev/null; then /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; fi
    brew install node@22
    brew link --overwrite node@22
  elif [ "$OS" = "linux" ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs || true
  fi
}

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then log "pnpm $(pnpm -v) OK"; return; fi
  log "Installing pnpm"
  corepack enable || true
  corepack prepare pnpm@latest --activate || npm i -g pnpm
}

ensure_ffmpeg() {
  if command -v ffmpeg >/dev/null 2>&1; then return; fi
  OS=$(detect_os)
  log "Installing ffmpeg"
  if [ "$OS" = "macos" ]; then brew install ffmpeg; else sudo apt-get install -y ffmpeg; fi
}

write_env_example() {
  [ -f "$REPO_ROOT/.env.example" ] && return
  cat > "$REPO_ROOT/.env.example" <<'EOF'
GITHUB_TOKEN=
OMNIENGINE_REPO=GlacierEQ/OmniEngine
OMNIENGINE_DEFAULT_BRANCH=main
ASPEN_GROVE_URL=https://api.supermemory.ai
ASPEN_GROVE_API_KEY=
WHISPERX_MODEL=base.en
SLACK_BOT_TOKEN=
LINEAR_API_KEY=
NOTION_API_KEY=
NOTION_WORKSPACE_ID=
GMAIL_OAUTH_JSON=
EOF
}

write_config() {
  [ -f "$CONFIGS_DIR/glaciereq-mcpconfig.json" ] && return
  cat > "$CONFIGS_DIR/glaciereq-mcpconfig.json" <<'EOF'
{
  "mcpServers": {
    "supermemory": {
      "command": "npx",
      "args": ["-y", "@supermemory/mcp-server"],
      "env": {
        "SUPERMEMORY_API_URL": "https://api.supermemory.ai",
        "SUPERMEMORY_API_KEY": "${ASPEN_GROVE_API_KEY}"
      }
    },
    "glaciereq-legal": {
      "command": "node",
      "args": ["./servers/glaciereq-legal-server.js"],
      "env": { "NODE_ENV": "production" }
    },
    "glaciereq-notion-github": {
      "command": "node",
      "args": ["./servers/notion-github-bridge.js"]
    },
    "glaciereq-omniengine": {
      "command": "node",
      "args": ["./servers/omniengine-server.js"]
    },
    "glaciereq-fileboss": {
      "command": "node",
      "args": ["./servers/fileboss-whisperx-server.js"]
    }
  }
}
EOF
}

install_deps_and_build() {
  log "Installing dependencies"
  (cd "$REPO_ROOT" && pnpm install)
  log "Building extension"
  (cd "$REPO_ROOT" && pnpm build)
}

install_cli() {
  local CLI="$BIN_DIR/mcp"
  cat > "$CLI" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE}")/../.." && pwd 2>/dev/null || echo "$PWD")"
if [ -d "$ROOT/configs" ]; then REPO="$ROOT"; else REPO="$PWD"; fi
CFG="$REPO/configs/glaciereq-mcpconfig.json"
LOG_DIR="$REPO/.logs"; mkdir -p "$LOG_DIR"
PID_FILE="$LOG_DIR/mcp.pid"

proxy_cmd() {
  npx @srbhptl39/mcp-superassistant-proxy@latest --config "$CFG" ${PORT:+--port "$PORT"} ${@:1}
}
case "${1:-}" in
  up)
    PORT="${PORT:-3006}"
    echo "Starting MCP proxy on http://localhost:$PORT/sse"
    (cd "$REPO"; proxy_cmd > "$LOG_DIR/proxy.out" 2>&1 & echo $! > "$PID_FILE")
    echo "OK. Endpoint: http://localhost:$PORT/sse"
    ;;
  down)
    if [ -f "$PID_FILE" ]; then kill "$(cat "$PID_FILE")" || true; rm -f "$PID_FILE"; echo "Stopped."; else echo "Not running."; fi
    ;;
  status)
    if [ -f "$PID_FILE" ] && ps -p "$(cat "$PID_FILE")" >/dev/null 2>&1; then echo "Running: PID $(cat "$PID_FILE")"; else echo "Not running"; fi
    ;;
  logs)
    tail -n 200 -f "$LOG_DIR/proxy.out"
    ;;
  refresh)
    (cd "$REPO" && pnpm build)
    echo "Built. Reload extension from ./dist"
    ;;
  config)
    ${EDITOR:-nano} "$CFG"
    ;;
  *)
    echo "Usage: mcp {up|down|status|logs|refresh|config}"
    ;;
esac
EOF
  chmod +x "$CLI"
  if ! echo "$PATH" | grep -q "$BIN_DIR"; then
    log "Add to PATH: export PATH=\"$BIN_DIR:\$PATH\""
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc" 2>/dev/null || true
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc" 2>/dev/null || true
  fi
}

print_instructions() {
  echo
  echo "✅ MCP SuperAssistant installed."
  echo "- Build output: $REPO_ROOT/dist"
  echo "- Config: $CONFIGS_DIR/glaciereq-mcpconfig.json"
  echo "- CLI: $BIN_DIR/mcp"
  echo
  echo "Next:"
  echo "1) Copy .env.example to .env and fill secrets (GITHUB_TOKEN, ASPEN_GROVE_API_KEY, NOTION_API_KEY)."
  echo "2) Start everything: mcp up"
  echo "3) In the extension sidebar: connect to http://localhost:3006/sse"
  echo "4) Auto-submit and auto-execute enabled by default."
}

main() {
  ensure_node
  ensure_pnpm
  ensure_ffmpeg
  write_env_example
  write_config
  install_deps_and_build
  install_cli
  print_instructions
}
main "$@"
