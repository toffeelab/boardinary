#!/bin/bash
# doc-check.sh — CLAUDE.md 참조 경로 무결성 검사
# 사용: bash scripts/doc-check.sh
# exit 0: all valid, exit 1: broken references found

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

CLAUDE_MD="CLAUDE.md"

if [ ! -f "$CLAUDE_MD" ]; then
  printf "${RED}CLAUDE.md not found${NC}\n"
  exit 1
fi

printf "Checking references in %s...\n" "$CLAUDE_MD"

# Extract paths to temp file
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

grep -oE '`[^`]+`' "$CLAUDE_MD" | sed 's/`//g' | sort -u > "$TMPFILE"

TOTAL=0
VALID=0
BROKEN=0

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
    printf "  ${RED}✗${NC} %s\n" "$path"
  fi
done < "$TMPFILE"

printf "\nResults: %d references checked, %d valid, %d broken\n" "$TOTAL" "$VALID" "$BROKEN"

if [ "$BROKEN" -gt 0 ]; then
  printf "${RED}Found %d broken references${NC}\n" "$BROKEN"
  exit 1
else
  printf "${GREEN}All references valid${NC}\n"
  exit 0
fi
