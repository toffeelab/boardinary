#!/bin/bash
# Boardinary 개발 환경 초기화
# 사용법: ./scripts/init.sh
set -euo pipefail

echo "=== Boardinary Init ==="

# 1. Node 버전 확인
NODE_VERSION=$(node -v 2>/dev/null || echo "none")
if [[ "$NODE_VERSION" == "none" ]]; then
  echo "ERROR: Node.js가 설치되어 있지 않습니다"
  exit 1
fi
echo "[Node] $NODE_VERSION"

# 2. pnpm 확인
if ! command -v pnpm &>/dev/null; then
  echo "ERROR: pnpm이 설치되어 있지 않습니다. npm install -g pnpm"
  exit 1
fi
echo "[pnpm] $(pnpm -v)"

# 3. 의존성 설치
echo "[Install] pnpm install..."
pnpm install

# 4. Docker PostgreSQL 확인/기동
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q boardinary; then
  echo "[DB] PostgreSQL: 이미 실행 중"
else
  echo "[DB] PostgreSQL 컨테이너 시작..."
  docker compose up -d
  echo "[DB] 3초 대기..."
  sleep 3
fi

# 5. DB 마이그레이션
echo "[DB] 마이그레이션 실행..."
pnpm --filter @repo/db db:migrate

# 6. .env.local 확인
if [ ! -f apps/web/.env.local ]; then
  echo "WARNING: apps/web/.env.local 파일이 없습니다"
  echo "  .env.example을 복사하거나 직접 생성하세요"
fi

# 7. 빌드 검증
echo "[Build] pnpm build..."
pnpm build

echo ""
echo "=== Init Complete ==="
