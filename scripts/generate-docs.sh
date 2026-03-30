#!/bin/bash
# docs/generated/ 자동 생성 스크립트
# 사용법: ./scripts/generate-docs.sh
set -uo pipefail

GENERATED_DIR="docs/generated"
mkdir -p "$GENERATED_DIR"

echo "=== Generating Docs ==="

# 1. DB 스키마 문서 생성
echo ""
echo "[1] db-schema.md 생성..."
SCHEMA_FILE="packages/db/src/schema.ts"
if [ -f "$SCHEMA_FILE" ]; then
  {
    echo "# Database Schema"
    echo ""
    echo "> 자동 생성 문서 — 직접 수정하지 마세요."
    echo "> 소스: \`$SCHEMA_FILE\`"
    echo "> 생성일: $(date +%Y-%m-%d)"
    echo ""
    echo '```typescript'
    cat "$SCHEMA_FILE"
    echo '```'
  } > "$GENERATED_DIR/db-schema.md"
  echo "  생성 완료"
else
  echo "  스킵 — $SCHEMA_FILE 없음"
fi

# 2. API 엔드포인트 문서 생성
echo ""
echo "[2] api-endpoints.md 생성..."
{
  echo "# API Endpoints"
  echo ""
  echo "> 자동 생성 문서 — 직접 수정하지 마세요."
  echo "> 생성일: $(date +%Y-%m-%d)"
  echo ""
  echo "## Route Handlers"
  echo ""
  # Next.js App Router의 route.ts 파일 탐색
  if find apps/web/src/app -name "route.ts" -o -name "route.tsx" 2>/dev/null | head -1 | grep -q .; then
    find apps/web/src/app -name "route.ts" -o -name "route.tsx" 2>/dev/null | sort | while read -r route; do
      # 파일 경로에서 API 경로 추출
      API_PATH=$(echo "$route" | sed 's|apps/web/src/app||' | sed 's|/route\.tsx\?$||')
      # export된 HTTP 메서드 추출
      METHODS=$(grep -oP '(?<=export (?:async )?function )(GET|POST|PUT|PATCH|DELETE)' "$route" 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
      if [ -n "$METHODS" ]; then
        echo "- \`$API_PATH\` — $METHODS"
      fi
    done
  else
    echo "_Route handlers 없음_"
  fi
  echo ""
  echo "## Server Actions"
  echo ""
  # 'use server' 파일 탐색
  if grep -rl "'use server'" apps/web/src/ 2>/dev/null | head -1 | grep -q .; then
    grep -rl "'use server'" apps/web/src/ 2>/dev/null | sort | while read -r action; do
      RELATIVE=$(echo "$action" | sed 's|apps/web/src/||')
      FUNCTIONS=$(grep -oP '(?<=export async function )\w+' "$action" 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
      if [ -n "$FUNCTIONS" ]; then
        echo "- \`$RELATIVE\` — $FUNCTIONS"
      fi
    done
  else
    echo "_Server Actions 없음_"
  fi
} > "$GENERATED_DIR/api-endpoints.md"
echo "  생성 완료"

# 3. 컴포넌트 인벤토리 생성
echo ""
echo "[3] component-inventory.md 생성..."
{
  echo "# Component Inventory"
  echo ""
  echo "> 자동 생성 문서 — 직접 수정하지 마세요."
  echo "> 생성일: $(date +%Y-%m-%d)"
  echo ""
  COMP_DIR="apps/web/src/components"
  if [ -d "$COMP_DIR" ]; then
    for subdir in "$COMP_DIR"/*/; do
      if [ -d "$subdir" ]; then
        DIRNAME=$(basename "$subdir")
        echo "## $DIRNAME/"
        echo ""
        find "$subdir" -name "*.tsx" -maxdepth 1 2>/dev/null | sort | while read -r comp; do
          BASENAME=$(basename "$comp" .tsx)
          echo "- \`$BASENAME\`"
        done
        echo ""
      fi
    done
  else
    echo "_컴포넌트 디렉토리 없음_"
  fi
  # 공유 UI 패키지
  UI_DIR="packages/ui/src"
  if [ -d "$UI_DIR" ]; then
    echo "## @repo/ui (공유)"
    echo ""
    find "$UI_DIR" -name "*.tsx" 2>/dev/null | sort | while read -r comp; do
      BASENAME=$(basename "$comp" .tsx)
      echo "- \`$BASENAME\`"
    done
    echo ""
  fi
} > "$GENERATED_DIR/component-inventory.md"
echo "  생성 완료"

# 4. 의존성 그래프 생성
echo ""
echo "[4] dependency-graph.md 생성..."
{
  echo "# Dependency Graph"
  echo ""
  echo "> 자동 생성 문서 — 직접 수정하지 마세요."
  echo "> 생성일: $(date +%Y-%m-%d)"
  echo ""
  echo "## Workspace Packages"
  echo ""
  # 각 패키지의 workspace 의존성 추출
  for pkg in apps/web apps/api apps/docs packages/*/; do
    if [ -f "$pkg/package.json" ]; then
      NAME=$(python3 -c "import json; print(json.load(open('$pkg/package.json')).get('name', 'unknown'))" 2>/dev/null || echo "$pkg")
      DEPS=$(python3 -c "
import json
d = json.load(open('$pkg/package.json'))
deps = {**d.get('dependencies', {}), **d.get('devDependencies', {})}
workspace = [k for k, v in deps.items() if k.startswith('@repo/') or v.startswith('workspace:')]
print(', '.join(workspace) if workspace else 'none')
" 2>/dev/null || echo "parse error")
      echo "- **$NAME** → $DEPS"
    fi
  done
} > "$GENERATED_DIR/dependency-graph.md"
echo "  생성 완료"

echo ""
echo "=== Done — $(ls "$GENERATED_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ') files generated ==="
