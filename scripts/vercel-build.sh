#!/bin/bash
# Expo web export for Vercel.
#
# Metro and its jest-worker pool detach from the parent process group, so
# simple pkill / trap "kill 0" approaches don't reach them. The fix:
#   1. set -m gives each background job its own process group (PGID = PID).
#   2. Running expo export with & puts it in PGID = $EXPO_PID.
#   3. All Metro children (jest-workers, etc.) inherit that PGID.
#   4. kill -- -$EXPO_PID kills the whole group; -9 cleans up survivors.
set -m

npx expo export --platform web &
EXPO_PID=$!

wait "$EXPO_PID"
EXIT_CODE=$?

kill -- -"${EXPO_PID}" 2>/dev/null || true
sleep 2
kill -9 -- -"${EXPO_PID}" 2>/dev/null || true

exit "${EXIT_CODE}"
