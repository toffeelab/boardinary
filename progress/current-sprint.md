# Sprint: 하네스 엔지니어링 구조 도입

## 계약
- 시작일: 2026-03-30
- 목표: OpenAI/Anthropic 하네스 엔지니어링 원칙에 따른 프로젝트 뼈대 구축
- 브랜치: develop (docs/ 변경은 예외 허용)

## 완료 기준 (Definition of Done)
1. [x] docs/ 디렉터리 재구성 (agent_docs → 루트 승격)
2. [x] CLAUDE.md ~100줄 맵으로 리팩토링
3. [x] ARCHITECTURE.md 신규 생성
4. [x] scripts/ 자동화 스크립트 4종
5. [x] progress/ 진행 추적 시스템
6. [x] ESLint boardinary-rules.js (아키텍처 불변 조건)
7. [x] Husky + lint-staged 설정
8. [x] docs/references/ LLM 참조 문서
9. [x] CI/CD 강화 (doc-check.yml, e2e.yml 수정)
10. [x] pnpm build 성공
11. [x] pnpm lint 성공

## 제약사항
- 코드 로직 변경 없음 (하네스/문서/도구만)
- 기존 CI 워크플로우 호환성 유지

## 진행 상태
- [x] 디렉터리 구조 생성
- [x] agent_docs → docs/ 루트 승격
- [x] product-specs 이동
- [x] CLAUDE.md 리팩토링
- [x] ARCHITECTURE.md
- [x] design-docs, exec-plans 문서
- [x] scripts/
- [x] husky + lint-staged
- [x] ESLint rules
- [x] references llms.txt
- [x] CI/CD
