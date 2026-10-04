#!/usr/bin/env bash
# preflight.sh — URL to Ads by Paneet: check and install what the skill needs (macOS / Linux).
# Plain shell on purpose: it must run on a machine that has no Node yet.
#
#   bash preflight.sh check            one line per item: "ok <item> <detail>" or "missing <item> <how>"
#                                      exit 0 when everything is present, 1 otherwise
#   bash preflight.sh install <item>   install one item: node | ffmpeg | browser
#                                      exit non-zero, with the failing command, when it fails
#   URL_TO_ADS_NO_BREW=1               skip Homebrew even when it is usable
#
# Items: node (22 or newer) · ffmpeg (ffmpeg + ffprobe) · browser (HyperFrames' headless Chrome).
# macOS: Homebrew when it is installed and writable by this user; otherwise a no-password install
# into ~/.url-to-ads (Node's official tarball from nodejs.org, checked against its SHASUMS256;
# static FFmpeg 6.0 builds from eugeneware/ffmpeg-static b6.1.1, checked against pinned SHA-256).
# Linux: apt (Debian / Ubuntu).

set -u
OS="$(uname -s)"
NODE_MIN=22
LOCAL="$HOME/.url-to-ads"
BIN="$LOCAL/bin"
FFS_URL="https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1"


# Homebrew may be installed but not on PATH in a non-login shell.
if [ "${URL_TO_ADS_NO_BREW:-}" != 1 ]; then
  for b in /opt/homebrew/bin /usr/local/bin; do
    [ -x "$b/brew" ] && case ":$PATH:" in *":$b:"*) ;; *) PATH="$b:$PATH" ;; esac
  done
fi
# Tools this script installed into ~/.url-to-ads always come first.
case ":$PATH:" in *":$BIN:"*) ;; *) PATH="$BIN:$PATH" ;; esac
export PATH

have() { command -v "$1" >/dev/null 2>&1; }

node_ok() {
  have node || return 1
  local major
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)" || return 1
  [ "${major:-0}" -ge "$NODE_MIN" ]
}

brew_usable() {
  [ "${URL_TO_ADS_NO_BREW:-}" = 1 ] && return 1 # force the no-password ~/.url-to-ads install
  have brew || return 1
  # A Homebrew prefix owned by another macOS user is present but not writable.
  [ -w "$(brew --prefix)/bin" ]
}

how() { # how <item> → the install command for this platform, or a reason it cannot run
  case "$OS:$1" in
    Darwin:node) if brew_usable; then echo "brew install node"; else echo "user-local: Node $NODE_MIN from nodejs.org into ~/.url-to-ads (no password)"; fi ;;
    Darwin:ffmpeg) if brew_usable; then echo "brew install ffmpeg"; else echo "user-local: static FFmpeg 6.0 + ffprobe into ~/.url-to-ads (no password)"; fi ;;
    Linux:node) echo "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs" ;;
    Linux:ffmpeg) echo "sudo apt-get update && sudo apt-get install -y ffmpeg" ;;
    *:browser) echo "npx -y hyperframes browser ensure" ;;
    *) echo "unsupported platform $OS" ;;
  esac
}

check() {
  local missing=0
  if node_ok; then echo "ok node $(node -v)"; else
    echo "missing node $(how node)"; missing=1
  fi
  if have ffmpeg && have ffprobe; then echo "ok ffmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3)"; else
    echo "missing ffmpeg $(how ffmpeg)"; missing=1
  fi
  if node_ok && npx -y hyperframes browser path >/dev/null 2>&1; then
    echo "ok browser $(npx -y hyperframes browser path 2>/dev/null | tail -1)"
  else
    echo "missing browser $(how browser)"; missing=1
  fi
  [ -d "$BIN" ] && echo "path $BIN — put it first on PATH in every command: export PATH=\"$BIN:\$PATH\""
  return $missing
}

fail() { echo "✗ install failed: $1" >&2; return 1; }

# Make ~/.url-to-ads/bin permanent for new shells (zsh is the macOS default; bash for the rest).
persist_path() {
  local line='export PATH="$HOME/.url-to-ads/bin:$PATH"  # added by URL to Ads by Paneet'
  for rc in "$HOME/.zprofile" "$HOME/.bash_profile"; do
    grep -qs "url-to-ads/bin" "$rc" || printf '\n%s\n' "$line" >>"$rc"
  done
}

mac_arch() { case "$(uname -m)" in arm64) echo arm64 ;; x86_64) echo x64 ;; *) return 1 ;; esac; }

local_node() {
  local arch tmp sums file sum
  arch="$(mac_arch)" || { fail "node: unsupported CPU $(uname -m)"; return 1; }
  tmp="$(mktemp -d)"
  echo "→ download Node $NODE_MIN (darwin-$arch) from nodejs.org into $LOCAL"
  sums="$(curl -fsSL https://nodejs.org/dist/latest-v$NODE_MIN.x/SHASUMS256.txt)" || { fail "node: could not fetch https://nodejs.org/dist/latest-v$NODE_MIN.x/SHASUMS256.txt"; return 1; }
  file="$(printf '%s\n' "$sums" | awk -v a="darwin-$arch.tar.gz" '$2 ~ a"$" {print $2}')"
  sum="$(printf '%s\n' "$sums" | awk -v a="darwin-$arch.tar.gz" '$2 ~ a"$" {print $1}')"
  [ -n "$file" ] || { fail "node: no darwin-$arch tarball listed"; return 1; }
  curl -fsSL -o "$tmp/$file" "https://nodejs.org/dist/latest-v$NODE_MIN.x/$file" || { fail "node: download of $file failed"; return 1; }
  [ "$(shasum -a 256 "$tmp/$file" | cut -d' ' -f1)" = "$sum" ] || { fail "node: checksum mismatch for $file"; return 1; }
  mkdir -p "$LOCAL" "$BIN" && tar -xzf "$tmp/$file" -C "$LOCAL" || { fail "node: could not unpack $file into $LOCAL"; return 1; }
  local dir="$LOCAL/${file%.tar.gz}"
  for t in node npm npx; do ln -sf "$dir/bin/$t" "$BIN/$t"; done
  rm -rf "$tmp"
  persist_path
}

local_ffmpeg() {
  local arch tool expected
  arch="$(mac_arch)" || { fail "ffmpeg: unsupported CPU $(uname -m)"; return 1; }
  mkdir -p "$BIN"
  echo "→ download static FFmpeg 6.0 + ffprobe (darwin-$arch) from $FFS_URL into $BIN"
  for tool in ffmpeg ffprobe; do
    case "$tool-$arch" in
      ffmpeg-arm64) expected=8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa ;;
      ffprobe-arm64) expected=d986a8ec7b030899fe66a8a288ed809a3543338705a3ce178cfb85869c5d80be ;;
      ffmpeg-x64) expected=929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106 ;;
      ffprobe-x64) expected=d4da574d6e2e197bd259b47d69cf262df9e312af24ad960444f6d806d3d4c186 ;;
    esac
    curl -fsSL -o "$BIN/$tool.gz" "$FFS_URL/$tool-darwin-$arch.gz" || { fail "ffmpeg: download of $tool-darwin-$arch.gz failed"; return 1; }
    [ "$(shasum -a 256 "$BIN/$tool.gz" | cut -d' ' -f1)" = "$expected" ] || { rm -f "$BIN/$tool.gz"; fail "ffmpeg: checksum mismatch for $tool-darwin-$arch.gz"; return 1; }
    gunzip -f "$BIN/$tool.gz" && chmod +x "$BIN/$tool" || { fail "ffmpeg: could not unpack $tool"; return 1; }
  done
  persist_path
}

install_item() {
  local item="$1" cmd
  case "$item" in
    node|ffmpeg) ;;
    browser)
      node_ok || { echo "✗ cannot install browser: Node $NODE_MIN+ is required first" >&2; return 2; } ;;
    *) echo "✗ unknown item '$item' (node | ffmpeg | browser)" >&2; return 2 ;;
  esac
  cmd="$(how "$item")"
  case "$cmd" in
    unsupported*) echo "✗ $cmd" >&2; return 2 ;;
    user-local*)
      if [ "$item" = node ]; then local_node || return 1; else local_ffmpeg || return 1; fi ;;
    *)
      echo "→ $cmd"
      bash -c "$cmd" || { fail "$item — command: $cmd"; return 1; } ;;
  esac
  hash -r
  case "$item" in
    node) node_ok || { echo "✗ node installed but $(node -v 2>/dev/null || echo 'no node') is not ${NODE_MIN}+ on PATH" >&2; return 1; } ;;
    ffmpeg) { have ffmpeg && have ffprobe; } || { echo "✗ ffmpeg/ffprobe still not on PATH after install" >&2; return 1; } ;;
    browser) npx -y hyperframes browser path >/dev/null 2>&1 || { echo "✗ browser still not found after install" >&2; return 1; } ;;
  esac
  echo "✓ $item installed"
}

case "${1:-}" in
  check) check ;;
  install) [ -n "${2:-}" ] || { echo "usage: preflight.sh install node|ffmpeg|browser" >&2; exit 2; }; install_item "$2" ;;
  *) echo "usage: preflight.sh check | install node|ffmpeg|browser" >&2; exit 2 ;;
esac
