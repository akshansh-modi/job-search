#!/bin/sh
# Remove the 5-minute MongoDB worker. Keeps MongoDB data and the log.
set -eu

LABEL=io.career-ops.mongo-worker
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
existed=0
[ -f "$PLIST" ] && existed=1
launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
rm -f "$PLIST"
if [ "$existed" -eq 1 ]; then echo "Removed $LABEL."; else echo "$LABEL is not installed."; fi
