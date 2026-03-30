# GitHub Actions Workflow 수정 가이드

Claude Code Action은 **default branch(main)의 workflow 파일**과 PR 브랜치의 workflow가 동일한지 검증한다. 따라서 workflow 파일(`.github/workflows/`)은 일반 코드의 git flow와 다르게 취급해야 한다.

## 수정 절차

1. `main`에서 `chore/workflow-*` 브랜치 생성
2. workflow 수정 후 `main` 대상 PR 생성 → 머지
3. `main`을 `develop`에 merge하여 동기화: `git checkout develop && git merge main`
4. 진행 중인 feature 브랜치가 있다면 develop을 merge: `git merge develop`

## 주의

workflow를 develop이나 feature에서만 수정하면 main과 불일치가 발생하여 Claude 리뷰 Action이 실패한다.

## Draft PR 활용

Draft PR에서는 Claude 자동 리뷰가 스킵된다. 리뷰 피드백 반영 중 중간 저장이 필요할 때 활용:

- `gh pr ready --undo <PR번호>` → draft 전환 (이후 push에 리뷰 안 돌아감)
- `gh pr ready <PR번호>` → ready 전환 (리뷰 트리거)
