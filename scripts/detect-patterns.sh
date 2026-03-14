#!/bin/bash

# CourtMastr Pattern Detection Script
# Detects violations of coding patterns CP-016, CP-017, CP-018
# Usage: ./scripts/detect-patterns.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
cp016_count=0
cp017_count=0
cp018_count=0

echo "=== CourtMastr Pattern Detection Report ==="
echo "Generated: $(date)"
echo "Project: $PROJECT_ROOT"
echo ""

# ============================================================================
# CP-016: Inline v-dialog (should use BaseDialog)
# ============================================================================
echo -e "${BLUE}=== CP-016: Inline v-dialog (should use BaseDialog) ===${NC}"
echo "Pattern: Inline <v-dialog> blocks that should use <BaseDialog> component"
echo ""

cp016_violations=$(grep -rn "<v-dialog" src/ --include="*.vue" 2>/dev/null | grep -v "BaseDialog" | grep -v "<!-- " || true)

if [ -z "$cp016_violations" ]; then
  echo -e "${GREEN}✓ No violations found${NC}"
  cp016_count=0
else
  echo -e "${RED}✗ Found violations:${NC}"
  echo "$cp016_violations" | while IFS=: read -r file line_num rest; do
    echo "  $file:$line_num"
    cp016_count=$((cp016_count + 1))
  done
  cp016_count=$(echo "$cp016_violations" | wc -l)
fi

echo ""

# ============================================================================
# CP-017: Inline empty states (should use EmptyState)
# ============================================================================
echo -e "${BLUE}=== CP-017: Inline empty states (should use EmptyState) ===${NC}"
echo "Pattern: Inline empty state markup that should use <EmptyState> component"
echo ""

cp017_violations=$(grep -rn "text-center py-8" src/ --include="*.vue" 2>/dev/null || true)

if [ -z "$cp017_violations" ]; then
  echo -e "${GREEN}✓ No violations found${NC}"
  cp017_count=0
else
  echo -e "${RED}✗ Found violations:${NC}"
  echo "$cp017_violations" | while IFS=: read -r file line_num rest; do
    echo "  $file:$line_num"
    cp017_count=$((cp017_count + 1))
  done
  cp017_count=$(echo "$cp017_violations" | wc -l)
fi

echo ""

# ============================================================================
# CP-018: Manual async (should use useAsyncOperation)
# ============================================================================
echo -e "${BLUE}=== CP-018: Manual async (should use useAsyncOperation) ===${NC}"
echo "Pattern: Manual async state management (loading/error refs) instead of useAsyncOperation"
echo ""

# Find files with manual async patterns
cp018_violations=$(grep -rn "loading.value = true" src/ --include="*.vue" --include="*.ts" 2>/dev/null | grep -v "useAsyncOperation" | grep -v "// " || true)

if [ -z "$cp018_violations" ]; then
  echo -e "${GREEN}✓ No violations found${NC}"
  cp018_count=0
else
  echo -e "${RED}✗ Found violations:${NC}"
  echo "$cp018_violations" | while IFS=: read -r file line_num rest; do
    echo "  $file:$line_num"
    cp018_count=$((cp018_count + 1))
  done
  cp018_count=$(echo "$cp018_violations" | wc -l)
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo -e "${BLUE}=== Summary ===${NC}"
echo ""

total_violations=$((cp016_count + cp017_count + cp018_count))

echo "CP-016 (Inline v-dialog):        $cp016_count violations"
echo "CP-017 (Inline empty states):    $cp017_count violations"
echo "CP-018 (Manual async):           $cp018_count violations"
echo ""
echo "Total violations:                $total_violations"
echo ""

if [ $total_violations -eq 0 ]; then
  echo -e "${GREEN}✓ All patterns compliant!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠ Found $total_violations violations. Review and refactor as needed.${NC}"
  exit 1
fi
