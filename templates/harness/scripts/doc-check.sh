#!/bin/bash
# doc-check.sh — CLAUDE.md 참조 경로 무결성 검사
# 사용: sh scripts/doc-check.sh
# exit 0: all valid, exit 1: broken references found

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

CLAUDE_MD="CLAUDE.md"
TOTAL=0
VALID=0
BROKEN=0

if [ ! -f "$CLAUDE_MD" ]; then
  echo -e "${RED}CLAUDE.md not found${NC}"
  exit 1
fi

echo "Checking references in $CLAUDE_MD..."

# Extract paths from backticks and markdown links
while IFS= read -r path; do
  # Skip empty, URLs, placeholders, and common false positives
  [[ -z "$path" ]] && continue
  [[ "$path" == http* ]] && continue
  [[ "$path" == *"{{"* ]] && continue
  [[ "$path" == *"..."* ]] && continue
  [[ "$path" == "#"* ]] && continue
  [[ "$path" != */* ]] && continue  # skip single words

  TOTAL=$((TOTAL + 1))
  if [ -e "$path" ]; then
    VALID=$((VALID + 1))
  else
    BROKEN=$((BROKEN + 1))
    echo -e "  ${RED}✗${NC} $path"
  fi
done < <(grep -oE '`[^`]+`' "$CLAUDE_MD" | sed 's/`//g' | sort -u)

echo ""
echo "Results: $TOTAL references checked, $VALID valid, $BROKEN broken"

if [ "$BROKEN" -gt 0 ]; then
  echo -e "${RED}Found $BROKEN broken references${NC}"
  exit 1
else
  echo -e "${GREEN}All references valid${NC}"
  exit 0
fi
