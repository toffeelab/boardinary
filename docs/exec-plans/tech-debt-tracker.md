# 기술 부채 추적

## 현재 목록

| ID | 설명 | 우선순위 | 관련 파일 | 상태 |
|----|------|----------|----------|------|
| TD-001 | e2e.yml DB명 `intervuddy_test` → `boardinary_test` | High | `.github/workflows/e2e.yml` | 완료 (하네스 도입 시 수정) |
| TD-002 | Unit 테스트 부족 (data-access, lib) | Medium | `apps/web/src/` | 대기 |
| TD-003 | e2e.yml 경로 필터가 모노레포 구조와 불일치 | Low | `.github/workflows/e2e.yml` | 대기 |

## 해결 규칙

- 기술 부채 발견 시 이 파일에 추가
- 해결 시 상태를 "완료"로 변경하고 해결 커밋 해시 기록
- 주기적으로 High 우선순위 항목을 Sprint에 포함
