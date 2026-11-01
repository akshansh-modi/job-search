#!/bin/sh
# Install the 5-minute MongoDB worker (online setup) for the current user. macOS only.
# ponytail: launchd only; add a crontab branch like install-scan-schedule.sh when Linux needs it.
set -eu

LABEL=io.career-ops.mongo-worker

[ "$(id -u)" -ne 0 ] || { echo "must not run as root" >&2; exit 1; }
[ "$(uname -s)" = Darwin ] || { echo "macOS only for now" >&2; exit 1; }

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
[ -f "$ROOT/web/.env.local" ] || { echo "web/.env.local with MONGODB_URI is missing" >&2; exit 1; }
[ -d "$ROOT/web/.next" ] || { echo "build the web app first: (cd web && npm run build)" >&2; exit 1; }

NODE=$(command -v node || true)
[ -n "$NODE" ] || { echo "node not found on PATH" >&2; exit 1; }
# Pin the real binary: version-manager shims do not survive reboot.
NODE=$("$NODE" -e 'process.stdout.write(process.execPath)')

xml_escape() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
}

LOG="$ROOT/data/mongo-worker.log"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
mkdir -p "$(dirname "$PLIST")" "$ROOT/data"

# launchd starts with a bare PATH; runs need claude, pdflatex and python3, so keep this shell's.
cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(xml_escape "$NODE")</string>
    <string>$(xml_escape "$ROOT/web/scripts/mongo-worker.mjs")</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$(xml_escape "$ROOT")</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$(xml_escape "$PATH:/Library/TeX/texbin")</string>
  </dict>
  <key>StartInterval</key>
  <integer>300</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$(xml_escape "$LOG")</string>
  <key>StandardErrorPath</key>
  <string>$(xml_escape "$LOG")</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
for ATTEMPT in 1 2 3 4 5; do
  if launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null; then
    echo "Installed $LABEL (every 5 minutes). Log: data/mongo-worker.log"
    exit 0
  fi
  sleep 1
done
rm -f "$PLIST"
echo "launchctl bootstrap failed; a logged-in GUI session is required" >&2
exit 1
