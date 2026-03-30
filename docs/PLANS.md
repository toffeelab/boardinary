# 계획 수립 및 실행 가이드

## Generator-Evaluator 패턴

Anthropic 하네스 디자인 원칙에 따라 에이전트 역할을 분리:

| 역할 | Superpowers 스킬 | 하네스 연동 |
|------|------------------|------------|
| **Planner** | `brainstorming` → `writing-plans` | Sprint 계약 생성 → `progress/current-sprint.md` |
| **Generator** | `test-driven-development` | `progress/features.json` 참조 → 체크리스트 소진 |
| **Evaluator** | `verification-before-completion` | `features.json` passes 업데이트 → 품질 검증 |

## Sprint 계약

코드 작성 전 "완료(done)"의 정의에 합의한다.

### 계약 템플릿 (`progress/current-sprint.md`)

```markdown
# Sprint: [기능명]

## 계약
- 시작일: YYYY-MM-DD
- 목표: [1문장 요약]
- 브랜치: feature/YYYY-MM-DD/[이름]

## 완료 기준 (Definition of Done)
1. [ ] 구체적 산출물 1
2. [ ] 구체적 산출물 2
3. [ ] pnpm build 성공
4. [ ] pnpm check-types 성공
5. [ ] E2E 테스트 통과
6. [ ] QUALITY_SCORE.md 검증 체크리스트 완료

## 제약사항
- 이 Sprint에서 하지 않을 것
- 다른 Sprint에 의존하는 부분

## 진행 상태
(작업하면서 체크박스 갱신)
```

## 실행 계획 관리

| 위치 | 용도 |
|------|------|
| `docs/exec-plans/active/` | 진행 중인 계획 |
| `docs/exec-plans/completed/` | 완료된 계획 (아카이브) |
| `docs/exec-plans/tech-debt-tracker.md` | 기술 부채 목록 |
| `docs/superpowers/plans/` | Superpowers 스킬 산출물 (기존 유지) |
| `docs/superpowers/specs/` | 기능 명세서 (기존 유지) |

## 작업 순서

1. **요구사항 분석** → `brainstorming` 스킬 (메인 디렉토리)
2. **계획 수립** → `writing-plans` (메인 디렉토리) → Sprint 계약 작성
3. **worktree 생성** → `using-git-worktrees` 스킬
4. **TDD 개발** → `test-driven-development` (worktree에서)
5. **검증** → `verification-before-completion` → [QUALITY_SCORE.md](QUALITY_SCORE.md) 참조
6. **코드 리뷰** → `requesting-code-review`
7. **완료** → `finishing-a-development-branch`로 PR 생성 (`--base develop`)
