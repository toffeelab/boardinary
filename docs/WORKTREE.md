# Worktree 기반 병렬 작업 가이드

모든 코드 구현은 worktree에서 수행한다. 메인 디렉토리는 develop의 클린 상태를 유지.

## 관련 스킬

- `using-git-worktrees`: worktree 생성 및 격리 환경 설정
- `dispatching-parallel-agents`: 독립 태스크 병렬 실행

## 메인 디렉토리 vs Worktree

| 작업                 | 위치          | 이유                    |
| -------------------- | ------------- | ----------------------- |
| brainstorming / 스펙 | 메인 디렉토리 | 다른 세션에서 참조 가능 |
| 플랜 작성            | 메인 디렉토리 | 구현 세션이 읽어야 함   |
| 코드 구현            | worktree      | 병렬 격리 필수          |

## Worktree 생명주기

1. feature 브랜치 생성 → worktree 생성 (격리 환경)
2. `node_modules` 심링크 (모노레포이므로 여러 위치에 필요):
   ```bash
   ln -s <메인>/node_modules ./node_modules
   ln -s <메인>/apps/web/node_modules ./apps/web/node_modules
   ln -s <메인>/apps/docs/node_modules ./apps/docs/node_modules
   ln -s <메인>/packages/ui/node_modules ./packages/ui/node_modules
   ln -s <메인>/packages/eslint-config/node_modules ./packages/eslint-config/node_modules
   ```
3. 구현 + 테스트 + 커밋 (worktree 내에서)
4. push + PR 생성
5. **PR push 완료 후 즉시 worktree 정리**: `git worktree remove <path>`
6. 이후 PR 수정이 필요하면 feature 브랜치를 직접 체크아웃하여 작업

## 포트 충돌 방지

각 앱의 고유 포트:
- `apps/web`: 4000
- `apps/api`: 4001
- `apps/docs`: 4002

여러 worktree에서 동시에 dev 서버를 실행할 경우:

```bash
lsof -i :4000              # 포트 사용 여부 확인
pnpm --filter web dev --port 4010   # 빈 포트로 실행
```

## 검증 방법

상세 체크리스트 → [QUALITY_SCORE.md](QUALITY_SCORE.md)
