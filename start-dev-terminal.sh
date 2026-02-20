#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        🏸 COURTMASTER DEVELOPMENT LAUNCHER               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

LOGS_DIR="logs/dev-session-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOGS_DIR"
ABS_LOGS_DIR="$(cd "$LOGS_DIR" && pwd)"

echo -e "${YELLOW}📁 Logs: $LOGS_DIR${NC}"
echo ""

echo -e "${BLUE}🧹 Cleaning up old logs (keeping last 2)...${NC}"
cd logs && ls -t | tail -n +3 | xargs rm -rf 2>/dev/null || true
cd ..

echo -e "${BLUE}🧹 Stopping existing processes...${NC}"
for port in 3002 5001 8080 9099 5002 4000; do
  pids=$(lsof -ti:$port 2>/dev/null)
  [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null
done
pkill -f "firebase emulators" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2
echo -e "${GREEN}  ✓ Cleanup done${NC}"
echo ""

echo -e "${BLUE}🔨 Building Cloud Functions...${NC}"
cd functions && npm run build 2>&1 | tee "$ABS_LOGS_DIR/build.log"
if [ $? -ne 0 ]; then
  echo -e "${RED}  ✗ Build failed${NC}"
  exit 1
fi
cd ..
echo -e "${GREEN}  ✓ Built${NC}"
echo ""

echo -e "${BLUE}🚀 Starting Emulators in new Terminal...${NC}"
EMULATORS_LOG="$ABS_LOGS_DIR/emulators.log"
osascript <<EOF
tell application "Terminal"
  do script "cd '$SCRIPT_DIR' && echo '📦 FIREBASE EMULATORS' && echo '📝 Logs: $EMULATORS_LOG' && echo '' && ./node_modules/.bin/firebase emulators:start --project demo-courtmaster 2>&1 | tee '$EMULATORS_LOG'"
  set custom title of front window to "Emulators"
end tell
EOF
echo -e "${GREEN}  ✓ Emulators Terminal opened${NC}"
echo ""

echo -e "${BLUE}⏳ Waiting for emulators...${NC}"
attempts=0
while ! curl -s http://127.0.0.1:5001 > /dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ $attempts -ge 60 ]; then
    echo -e "${RED}  ✗ Timeout${NC}"
    exit 1
  fi
  printf "."
  sleep 1
done
echo ""
echo -e "${GREEN}  ✓ Functions ready${NC}"

echo -e "${BLUE}⏳ Waiting for Auth emulator...${NC}"
attempts=0
while ! curl -s http://127.0.0.1:9099 > /dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ $attempts -ge 30 ]; then
    echo -e "${RED}  ✗ Timeout${NC}"
    exit 1
  fi
  printf "."
  sleep 1
done
echo ""
echo -e "${GREEN}  ✓ Auth ready${NC}"
echo ""

echo -e "${BLUE}🌐 Starting Dev Server in new Terminal...${NC}"
osascript <<EOF
tell application "Terminal"
  do script "cd '$SCRIPT_DIR' && echo '🌐 DEV SERVER' && echo '' && ./node_modules/.bin/vite 2>&1 | tee '$ABS_LOGS_DIR/site.log'"
  set custom title of front window to "Dev Server"
end tell
EOF
echo -e "${GREEN}  ✓ Dev Server Terminal opened${NC}"
echo ""

echo -e "${BLUE}⏳ Waiting for dev server...${NC}"
attempts=0
while ! curl -s http://127.0.0.1:3000 > /dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ $attempts -ge 30 ]; then
    echo -e "${RED}  ✗ Timeout${NC}"
    exit 1
  fi
  printf "."
  sleep 1
done
echo ""
echo -e "${GREEN}  ✓ Ready${NC}"
echo ""

echo -e "${BLUE}🌱 Seeding...${NC}"
npx tsx scripts/seed/local.ts 2>&1 | tee "$ABS_LOGS_DIR/seed.log"
SEED_EXIT=${PIPESTATUS[0]}
if [ $SEED_EXIT -eq 0 ]; then
  echo -e "${GREEN}  ✓ Seeded${NC}"
else
  echo -e "${RED}  ✗ Seed failed${NC}"
fi
echo ""

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}              ✅ ALL SYSTEMS RUNNING                      ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📦${NC} http://127.0.0.1:4000 (Firebase UI)"
echo -e "${GREEN}🌐${NC} http://localhost:3000 (Dev Site)"
echo ""
echo -e "${YELLOW}📁 Logs: $LOGS_DIR${NC}"
echo -e "   tail -f $LOGS_DIR/*.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop monitoring${NC}"
echo ""

while true; do
  echo -ne "\r${CYAN}$(date '+%H:%M:%S')${NC} Running..."
  sleep 5
  if ! pgrep -f "firebase emulators" > /dev/null && ! pgrep -f "vite" > /dev/null; then
    echo -e "\n${RED}⚠️  Processes stopped${NC}"
    break
  fi
done
