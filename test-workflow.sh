#!/bin/bash
set -e

echo "=========================================="
echo "Courtmaster Testing Workflow"
echo "=========================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}[1/5] Starting dev environment...${NC}"
./start-dev-terminal.sh

echo -e "${YELLOW}Waiting for services (30s)...${NC}"
sleep 30

echo -e "${YELLOW}Checking services...${NC}"
if curl -s http://127.0.0.1:3000 > /dev/null; then
    echo -e "${GREEN}✓ App server ready${NC}"
else
    echo -e "${RED}✗ App server not ready${NC}"
    exit 1
fi

if curl -s http://127.0.0.1:5001 > /dev/null; then
    echo -e "${GREEN}✓ Firebase functions ready${NC}"
else
    echo -e "${RED}✗ Firebase functions not ready${NC}"
fi

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}Dev environment is running!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Open browser to http://localhost:3000"
echo "2. Login with: admin@courtmaster.local / admin123"
echo "3. Click on 'Simple Test Tournament'"
echo "4. Follow the test workflow in TEST-WORKFLOW.md"
echo ""
echo "To stop: pkill -f 'firebase\|vite'"
