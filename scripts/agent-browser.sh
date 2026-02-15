#!/bin/bash
# OpenCode Agent-Browser Testing Configuration
# This script sets up agent-browser for OpenCode testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 OpenCode Agent-Browser Setup${NC}"
echo "================================"

# Check if agent-browser is installed
if ! command -v agent-browser &> /dev/null; then
    echo -e "${YELLOW}⚠️  agent-browser not found. Installing...${NC}"
    npm install -g agent-browser
    agent-browser install
fi

# Create necessary directories
mkdir -p .agent-browser/profiles
mkdir -p .agent-browser/sessions
mkdir -p .agent-browser/screenshots
mkdir -p .agent-browser/traces

# Set environment variables for OpenCode
export AGENT_BROWSER_PROFILE="$(pwd)/.agent-browser/profiles/default"
export AGENT_BROWSER_SESSION="opencode"
export AGENT_BROWSER_STREAM_PORT="9223"

echo -e "${GREEN}✓ Directories created${NC}"

# Function to check if dev server is running
check_dev_server() {
    if curl -s http://localhost:3000 > /dev/null; then
        echo -e "${GREEN}✓ Dev server running on http://localhost:3000${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Dev server not running on http://localhost:3000${NC}"
        echo "   Start it with: npm run dev"
        return 1
    fi
}

# Function to check if Firebase emulators are running
check_emulators() {
    if curl -s http://localhost:4000 > /dev/null; then
        echo -e "${GREEN}✓ Firebase emulators running on http://localhost:4000${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Firebase emulators not running${NC}"
        echo "   Start them with: npm run emulators"
        return 1
    fi
}

# Main commands
case "${1:-}" in
    setup)
        echo -e "\n${BLUE}Setting up agent-browser for OpenCode...${NC}"
        check_dev_server
        check_emulators
        echo -e "\n${GREEN}✓ Setup complete!${NC}"
        echo ""
        echo "Available commands:"
        echo "  ./scripts/agent-browser.sh open [url]     - Open a URL"
        echo "  ./scripts/agent-browser.sh snapshot       - Get page snapshot"
        echo "  ./scripts/agent-browser.sh test [name]    - Run a named test"
        echo "  ./scripts/agent-browser.sh debug          - Interactive debug mode"
        echo "  ./scripts/agent-browser.sh login          - Login as admin"
        echo "  ./scripts/agent-browser.sh close          - Close browser"
        ;;
    
    open)
        URL="${2:-http://localhost:3000}"
        echo -e "${BLUE}Opening $URL...${NC}"
        agent-browser --profile "$AGENT_BROWSER_PROFILE" --session "$AGENT_BROWSER_SESSION" open "$URL"
        ;;
    
    snapshot)
        echo -e "${BLUE}Getting page snapshot...${NC}"
        agent-browser --profile "$AGENT_BROWSER_PROFILE" --session "$AGENT_BROWSER_SESSION" snapshot -i -c
        ;;
    
    login)
        echo -e "${BLUE}Logging in as admin...${NC}"
        agent-browser --profile "$AGENT_BROWSER_PROFILE" --session "$AGENT_BROWSER_SESSION" open http://localhost:3000/login
        sleep 1
        agent-browser --session "$AGENT_BROWSER_SESSION" fill "input[type='email']" "admin@courtmaster.local"
        agent-browser --session "$AGENT_BROWSER_SESSION" fill "input[type='password']" "admin123"
        agent-browser --session "$AGENT_BROWSER_SESSION" click "button[type='submit']"
        sleep 2
        echo -e "${GREEN}✓ Logged in${NC}"
        ;;
    
    test)
        TEST_NAME="${2:-full}"
        echo -e "${BLUE}Running test: $TEST_NAME${NC}"
        
        case "$TEST_NAME" in
            login)
                ./scripts/agent-browser.sh open http://localhost:3000/login
                ./scripts/agent-browser.sh snapshot
                ;;
            tournaments)
                ./scripts/agent-browser.sh open http://localhost:3000/tournaments
                sleep 1
                ./scripts/agent-browser.sh snapshot
                ;;
            create)
                ./scripts/agent-browser.sh open http://localhost:3000/tournaments/create
                sleep 1
                ./scripts/agent-browser.sh snapshot
                ;;
            full)
                echo "Running full tournament lifecycle test..."
                ./scripts/agent-browser.sh login
                ./scripts/agent-browser.sh open http://localhost:3000/tournaments
                sleep 1
                ./scripts/agent-browser.sh snapshot
                ;;
            *)
                echo -e "${RED}Unknown test: $TEST_NAME${NC}"
                echo "Available tests: login, tournaments, create, full"
                exit 1
                ;;
        esac
        ;;
    
    debug)
        echo -e "${BLUE}Starting debug mode...${NC}"
        echo "Commands:"
        echo "  snapshot    - Get page snapshot"
        echo "  click @eN   - Click element by ref"
        echo "  fill @eN    - Fill input by ref"
        echo "  open URL    - Navigate to URL"
        echo "  exit        - Quit debug mode"
        echo ""
        
        # Start with login page
        agent-browser --profile "$AGENT_BROWSER_PROFILE" --session "$AGENT_BROWSER_SESSION" open http://localhost:3000/login
        
        while true; do
            echo -n -e "\n${BLUE}agent-browser>${NC} "
            read -r cmd
            
            case "$cmd" in
                exit|quit)
                    break
                    ;;
                snapshot)
                    agent-browser --session "$AGENT_BROWSER_SESSION" snapshot -i -c
                    ;;
                *)
                    agent-browser --session "$AGENT_BROWSER_SESSION" $cmd
                    ;;
            esac
        done
        ;;
    
    close)
        echo -e "${BLUE}Closing browser...${NC}"
        agent-browser --session "$AGENT_BROWSER_SESSION" close
        echo -e "${GREEN}✓ Browser closed${NC}"
        ;;
    
    status)
        echo -e "${BLUE}Checking status...${NC}"
        check_dev_server
        check_emulators
        echo ""
        echo -e "${BLUE}Agent-Browser Configuration:${NC}"
        echo "  Profile: $AGENT_BROWSER_PROFILE"
        echo "  Session: $AGENT_BROWSER_SESSION"
        echo "  Stream Port: $AGENT_BROWSER_STREAM_PORT"
        ;;
    
    *)
        echo "OpenCode Agent-Browser Testing Tool"
        echo ""
        echo "Usage: ./scripts/agent-browser.sh [command] [options]"
        echo ""
        echo "Commands:"
        echo "  setup                  - Initial setup and checks"
        echo "  open [url]             - Open a URL (default: http://localhost:3000)"
        echo "  snapshot               - Get interactive page snapshot"
        echo "  login                  - Login as admin user"
        echo "  test [name]            - Run named test (login|tournaments|create|full)"
        echo "  debug                  - Interactive debug mode"
        echo "  close                  - Close browser session"
        echo "  status                 - Check server and emulator status"
        echo ""
        echo "Examples:"
        echo "  ./scripts/agent-browser.sh setup"
        echo "  ./scripts/agent-browser.sh open http://localhost:3000/tournaments"
        echo "  ./scripts/agent-browser.sh test full"
        echo "  ./scripts/agent-browser.sh debug"
        ;;
esac
