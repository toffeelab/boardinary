#!/bin/bash
# health-check.sh — 개발 환경 상태 확인
# 사용: sh scripts/health-check.sh

set -uo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

section() { echo -e "\n${GREEN}=== $1 ===${NC}"; }

section "Git Status"
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "not a git repo")
echo "Branch: $BRANCH"
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [ "$DIRTY" -gt 0 ]; then
  echo -e "${YELLOW}Uncommitted changes: $DIRTY files${NC}"
else
  echo -e "${GREEN}Working tree clean${NC}"
fi

section "Docker"
if command -v docker &>/dev/null && docker compose ps --format json 2>/dev/null | head -1 | grep -q '{'; then
  docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || echo "No containers running"
else
  echo -e "${YELLOW}Docker not available or no compose file${NC}"
fi

section "Dependencies"
if [ -d "node_modules" ]; then
  echo -e "${GREEN}node_modules exists${NC}"
else
  echo -e "${RED}node_modules missing — run your package manager install${NC}"
fi

section "Recent Commits"
git log --oneline -5 2>/dev/null || echo "No commits"

section "Open PRs"
if command -v gh &>/dev/null; then
  gh pr list --state open --limit 5 2>/dev/null || echo "Could not fetch PRs"
else
  echo -e "${YELLOW}gh CLI not installed — skipping${NC}"
fi

echo ""
exit 0
